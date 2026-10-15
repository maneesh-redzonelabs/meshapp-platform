import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { postCreateLimiter } from '../../middleware/rateLimit';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { assertPassedScan } from '../compliance/compliance.service';
import { consumeUpload } from '../uploads/uploads.store';
import { postCreateSchema, commentCreateSchema, networkRequestSchema, communityCreateSchema } from './social.schemas';

const router = Router();

/** The set of user_ids whose posts req.authUser can see under network_only / community_only visibility. */
async function visibleAuthorFilter(userId: string) {
  const [connections, memberships] = await Promise.all([
    prisma.doctor_connections.findMany({
      where: { status: 'accepted', OR: [{ requester_id: userId }, { recipient_id: userId }] },
    }),
    prisma.community_memberships.findMany({ where: { user_id: userId, is_active: true } }),
  ]);
  const networkIds = connections.map((c) => (c.requester_id === userId ? c.recipient_id : c.requester_id));
  const communityIds = memberships.map((m) => m.community_id);
  return { networkIds, communityIds };
}

router.get(
  '/feed',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const userId = req.authUser!.userId;
    const { networkIds, communityIds } = await visibleAuthorFilter(userId);
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(Number(req.query.limit ?? 20), 50);

    const where: Prisma.postsWhereInput = {
      is_active: true,
      OR: [
        { visibility_scope: 'public' },
        { visibility_scope: 'network_only', author_id: { in: [...networkIds, userId] } },
        { visibility_scope: 'community_only', community_id: { in: communityIds } },
        { author_id: userId },
      ],
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    };

    const rows = await prisma.posts.findMany({ where, orderBy: { created_at: 'desc' }, take: limit });
    const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at.toISOString() : null;
    ok(res, rows, { next_cursor: nextCursor });
  }),
);

router.post(
  '/posts',
  authenticate(),
  requireRole(['doctor']),
  postCreateLimiter,
  validateBody(postCreateSchema),
  asyncHandler(async (req, res) => {
    const { compliance_scan_id, media, ...rest } = req.body;
    await assertPassedScan({ scanId: compliance_scan_id, userId: req.authUser!.userId, entityType: 'post', text: rest.content });

    const post = await prisma.$transaction(async (tx) => {
      const p = await tx.posts.create({ data: { author_id: req.authUser!.userId, compliance_scan_id, ...rest } });
      if (media?.length) {
        for (const [i, uploadId] of media.entries()) {
          const localPath = consumeUpload(uploadId, req.authUser!.userId);
          if (!localPath) continue;
          await tx.post_media.create({
            data: { post_id: p.post_id, media_type: 'image', file_path: localPath, sort_order: i },
          });
        }
      }
      return p;
    });

    await prisma.content_compliance_scans.update({ where: { scan_id: compliance_scan_id }, data: { entity_id: post.post_id } });
    created(res, post);
  }),
);

router.get(
  '/posts/:post_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const post = await prisma.posts.findUnique({ where: { post_id: req.params.post_id } });
    if (!post || !post.is_active) throw ApiError.notFound();
    const userId = req.authUser!.userId;
    if (post.author_id !== userId && post.visibility_scope !== 'public') {
      const { networkIds, communityIds } = await visibleAuthorFilter(userId);
      const visible =
        (post.visibility_scope === 'network_only' && networkIds.includes(post.author_id)) ||
        (post.visibility_scope === 'community_only' && post.community_id && communityIds.includes(post.community_id));
      if (!visible) throw ApiError.notFound();
    }
    ok(res, post);
  }),
);

router.delete(
  '/posts/:post_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const post = await prisma.posts.findUnique({ where: { post_id: req.params.post_id } });
    if (!post) throw ApiError.notFound();
    const isAuthor = post.author_id === req.authUser!.userId;
    const isContentAdmin = req.authUser!.roles.includes('admin_content') || req.authUser!.roles.includes('super_admin');
    if (!isAuthor && !isContentAdmin) throw ApiError.forbidden();
    await prisma.posts.update({ where: { post_id: post.post_id }, data: { is_active: false, deleted_at: new Date() } });
    ok(res, { deleted: true });
  }),
);

router.post(
  '/posts/:post_id/likes',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const post = await prisma.posts.findUnique({ where: { post_id: req.params.post_id } });
    if (!post || !post.is_active) throw ApiError.notFound();
    await prisma.post_likes
      .create({ data: { post_id: post.post_id, user_id: req.authUser!.userId } })
      .catch((err) => {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err; // idempotent on dup
      });
    ok(res, { liked: true });
  }),
);

router.delete(
  '/posts/:post_id/likes',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    await prisma.post_likes.deleteMany({ where: { post_id: req.params.post_id, user_id: req.authUser!.userId } });
    ok(res, { liked: false });
  }),
);

router.get(
  '/posts/:post_id/comments',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const rows = await prisma.post_comments.findMany({ where: { post_id: req.params.post_id, is_active: true }, orderBy: { created_at: 'asc' } });
    ok(res, rows);
  }),
);

router.post(
  '/posts/:post_id/comments',
  authenticate(),
  requireRole(['doctor']),
  postCreateLimiter,
  validateBody(commentCreateSchema),
  asyncHandler(async (req, res) => {
    const post = await prisma.posts.findUnique({ where: { post_id: req.params.post_id } });
    if (!post || !post.is_active) throw ApiError.notFound();
    const row = await prisma.post_comments.create({ data: { post_id: post.post_id, author_id: req.authUser!.userId, ...req.body } });
    created(res, row);
  }),
);

router.delete(
  '/posts/:post_id/comments/:comment_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const comment = await prisma.post_comments.findUnique({ where: { comment_id: req.params.comment_id } });
    if (!comment || comment.author_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.post_comments.update({ where: { comment_id: comment.comment_id }, data: { is_active: false, deleted_at: new Date() } });
    ok(res, { deleted: true });
  }),
);

/* ============================== NETWORK CONNECTIONS ============================== */

router.get(
  '/network',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const { category, status } = req.query as Record<string, string | undefined>;
    const userId = req.authUser!.userId;
    const rows = await prisma.doctor_connections.findMany({
      where: {
        OR: [{ requester_id: userId }, { recipient_id: userId }],
        connection_category: category as any,
        status: (status as any) ?? undefined,
      },
      orderBy: { requested_at: 'desc' },
    });
    ok(res, rows);
  }),
);

router.post(
  '/network/requests',
  authenticate(),
  requireRole(['doctor']),
  validateBody(networkRequestSchema),
  asyncHandler(async (req, res) => {
    const requesterId = req.authUser!.userId;
    const { recipient_id, connection_category } = req.body;
    if (recipient_id === requesterId) throw ApiError.businessRule('Cannot connect with yourself');

    const [a, b] = [requesterId, recipient_id].sort();
    const existing = await prisma.doctor_connections.findFirst({
      where: { OR: [{ requester_id: a, recipient_id: b }, { requester_id: b, recipient_id: a }] },
    });
    if (existing) throw ApiError.conflict('A connection already exists between these users');

    const row = await prisma.doctor_connections.create({
      data: { requester_id: requesterId, recipient_id, connection_category },
    });
    created(res, row);
  }),
);

router.patch(
  '/network/requests/:connection_id/accept',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const conn = await prisma.doctor_connections.findUnique({ where: { connection_id: req.params.connection_id } });
    if (!conn || conn.recipient_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.doctor_connections.update({ where: { connection_id: conn.connection_id }, data: { status: 'accepted', responded_at: new Date() } });
    ok(res, row);
  }),
);

router.patch(
  '/network/requests/:connection_id/reject',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const conn = await prisma.doctor_connections.findUnique({ where: { connection_id: req.params.connection_id } });
    if (!conn || conn.recipient_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.doctor_connections.update({ where: { connection_id: conn.connection_id }, data: { status: 'rejected', responded_at: new Date() } });
    ok(res, row);
  }),
);

router.patch(
  '/network/connections/:connection_id/block',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const conn = await prisma.doctor_connections.findUnique({ where: { connection_id: req.params.connection_id } });
    if (!conn || (conn.requester_id !== req.authUser!.userId && conn.recipient_id !== req.authUser!.userId)) throw ApiError.notFound();
    const row = await prisma.doctor_connections.update({ where: { connection_id: conn.connection_id }, data: { status: 'blocked' } });
    ok(res, row);
  }),
);

/* ============================== COMMUNITIES ============================== */

router.get(
  '/communities',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const specialityId = req.query.speciality_id ? Number(req.query.speciality_id) : undefined;
    const memberships = await prisma.community_memberships.findMany({ where: { user_id: req.authUser!.userId, is_active: true } });
    const ownPrivateIds = memberships.map((m) => m.community_id);
    const rows = await prisma.communities.findMany({
      where: {
        is_active: true,
        speciality_id: specialityId,
        OR: [{ is_public: true }, { community_id: { in: ownPrivateIds } }],
      },
      orderBy: { member_count: 'desc' },
    });
    ok(res, rows);
  }),
);

router.post(
  '/communities',
  authenticate(),
  requireRole(['doctor']),
  validateBody(communityCreateSchema),
  asyncHandler(async (req, res) => {
    const community = await prisma.$transaction(async (tx) => {
      const c = await tx.communities.create({ data: { created_by: req.authUser!.userId, ...req.body } });
      await tx.community_memberships.create({ data: { community_id: c.community_id, user_id: req.authUser!.userId, role: 'admin' } });
      return c;
    });
    created(res, community);
  }),
);

router.post(
  '/communities/:community_id/join',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const community = await prisma.communities.findUnique({ where: { community_id: req.params.community_id } });
    if (!community || !community.is_active) throw ApiError.notFound();
    const existing = await prisma.community_memberships.findUnique({
      where: { community_id_user_id: { community_id: community.community_id, user_id: req.authUser!.userId } },
    }).catch(() => null);
    if (existing) {
      if (existing.is_active) throw ApiError.conflict('Already a member');
      const row = await prisma.community_memberships.update({ where: { membership_id: existing.membership_id }, data: { is_active: true } });
      ok(res, row);
      return;
    }
    const row = await prisma.community_memberships.create({ data: { community_id: community.community_id, user_id: req.authUser!.userId, role: 'member' } });
    created(res, row);
  }),
);

router.delete(
  '/communities/:community_id/leave',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    await prisma.community_memberships.updateMany({
      where: { community_id: req.params.community_id, user_id: req.authUser!.userId },
      data: { is_active: false },
    });
    ok(res, { left: true });
  }),
);

router.get(
  '/communities/:community_id/members',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const community = await prisma.communities.findUnique({ where: { community_id: req.params.community_id } });
    if (!community) throw ApiError.notFound();
    if (!community.is_public) {
      const membership = await prisma.community_memberships.findFirst({ where: { community_id: community.community_id, user_id: req.authUser!.userId, is_active: true } });
      if (!membership) throw ApiError.forbidden('Private community — members only');
    }
    const members = await prisma.community_memberships.findMany({ where: { community_id: community.community_id, is_active: true } });
    ok(res, members);
  }),
);

export default router;
