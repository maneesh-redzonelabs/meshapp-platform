import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission, requireRole } from '../../middleware/rbac';
import { ok } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { revokeAllSessions } from '../auth/session.service';
import { recomputeProfileCompleteness } from '../doctors/profileCompleteness';

const router = Router();

/**
 * Logs an admin mutation to admin_actions_log, per spec: "all admin
 * mutations ... write to admin_actions_log with action_type,
 * target_user_id/entity_id, reason". requireAdmin2FA() step-up is noted by
 * the spec as mandatory in production; this dev build does not implement a
 * real TOTP flow (see README) and relies on requirePermission()'s role
 * check plus this audit trail as the enforced control for local testing.
 */
async function logAdminAction(adminId: string, actionType: string, opts: { targetUserId?: string; entityType?: string; entityId?: string; reason?: string }) {
  await prisma.admin_actions_log.create({
    data: { admin_id: adminId, action_type: actionType, target_user_id: opts.targetUserId, entity_type: opts.entityType, entity_id: opts.entityId, reason: opts.reason },
  });
}

router.get(
  '/verification-queue',
  authenticate(),
  requirePermission('doctor_verification:review'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.doctor_verification_documents.findMany({
      where: { review_status: 'pending' },
      orderBy: { uploaded_at: 'asc' },
      include: { doctors: { select: { full_name: true, speciality_id: true } } },
    });
    ok(res, rows);
  }),
);

router.patch(
  '/verification-documents/:document_id/approve',
  authenticate(),
  requirePermission('doctor_verification:review'),
  asyncHandler(async (req, res) => {
    const doc = await prisma.doctor_verification_documents.findUnique({ where: { document_id: req.params.document_id } });
    if (!doc) throw ApiError.notFound();

    const updated = await prisma.doctor_verification_documents.update({
      where: { document_id: doc.document_id },
      data: { review_status: 'approved', reviewed_by: req.authUser!.userId, reviewed_at: new Date() },
    });

    // If all of the doctor's submitted documents are now approved AND they
    // hold an active premium subscription, flip verification_status/is_searchable.
    const docs = await prisma.doctor_verification_documents.findMany({ where: { doctor_id: doc.doctor_id } });
    const allApproved = docs.length > 0 && docs.every((d) => d.review_status === 'approved');
    const activePremium = await prisma.user_subscriptions.findFirst({
      where: { user_id: doc.doctor_id, is_active: true, subscription_plans: { tier: 'premium' } },
    });

    if (allApproved && activePremium) {
      await prisma.doctors.update({ where: { doctor_id: doc.doctor_id }, data: { verification_status: 'verified', is_searchable: true, subscription_tier: 'premium' } });
    }
    await recomputeProfileCompleteness(doc.doctor_id);

    await logAdminAction(req.authUser!.userId, 'VERIFY_DOCTOR', { targetUserId: doc.doctor_id, entityType: 'doctor_verification_documents', entityId: doc.document_id });
    ok(res, updated);
  }),
);

router.patch(
  '/verification-documents/:document_id/reject',
  authenticate(),
  requirePermission('doctor_verification:review'),
  validateBody(z.object({ rejection_reason: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const doc = await prisma.doctor_verification_documents.findUnique({ where: { document_id: req.params.document_id } });
    if (!doc) throw ApiError.notFound();
    const updated = await prisma.doctor_verification_documents.update({
      where: { document_id: doc.document_id },
      data: { review_status: 'rejected', reviewed_by: req.authUser!.userId, reviewed_at: new Date(), rejection_reason: req.body.rejection_reason },
    });
    await prisma.notifications.create({
      data: { recipient_id: doc.doctor_id, notification_type: 'system', title: 'Document rejected', message: req.body.rejection_reason, entity_type: 'doctor_verification_documents', entity_id: doc.document_id },
    });
    await logAdminAction(req.authUser!.userId, 'REJECT_DOCUMENT', { targetUserId: doc.doctor_id, entityType: 'doctor_verification_documents', entityId: doc.document_id, reason: req.body.rejection_reason });
    ok(res, updated);
  }),
);

router.patch(
  '/users/:user_id/lock',
  authenticate(),
  requireRole(['admin']),
  requirePermission('user:lock'),
  validateBody(z.object({ reason: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const user = await prisma.users.update({ where: { user_id: req.params.user_id }, data: { is_locked: true, locked_until: null } });
    await revokeAllSessions(user.user_id, 'forced_admin');
    await logAdminAction(req.authUser!.userId, 'LOCK_USER', { targetUserId: user.user_id, reason: req.body.reason });
    ok(res, { user_id: user.user_id, is_locked: true });
  }),
);

router.patch(
  '/users/:user_id/unlock',
  authenticate(),
  requireRole(['admin']),
  requirePermission('user:lock'),
  asyncHandler(async (req, res) => {
    const user = await prisma.users.update({ where: { user_id: req.params.user_id }, data: { is_locked: false, locked_until: null, failed_login_attempts: 0 } });
    await logAdminAction(req.authUser!.userId, 'UNLOCK_USER', { targetUserId: user.user_id });
    ok(res, { user_id: user.user_id, is_locked: false });
  }),
);

router.get(
  '/audit-log',
  authenticate(),
  requirePermission('audit_log:read'),
  asyncHandler(async (req, res) => {
    const { user_id, entity_type, date_from, date_to } = req.query as Record<string, string | undefined>;
    const rows = await prisma.user_audit_log.findMany({
      where: {
        user_id,
        entity_type,
        created_at: date_from || date_to ? { gte: date_from ? new Date(date_from) : undefined, lte: date_to ? new Date(date_to) : undefined } : undefined,
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    ok(res, rows);
  }),
);

router.get(
  '/moderation/posts',
  authenticate(),
  requirePermission('content:moderate'),
  asyncHandler(async (_req, res) => {
    // No "reported" flag exists in the base schema; surfaces the most recent
    // active posts for manual review as a pragmatic stand-in (see README).
    const rows = await prisma.posts.findMany({ where: { is_active: true }, orderBy: { created_at: 'desc' }, take: 50 });
    ok(res, rows);
  }),
);

router.patch(
  '/moderation/posts/:post_id/takedown',
  authenticate(),
  requirePermission('content:moderate'),
  asyncHandler(async (req, res) => {
    const row = await prisma.posts.update({ where: { post_id: req.params.post_id }, data: { is_active: false, deleted_at: new Date() } });
    await logAdminAction(req.authUser!.userId, 'TAKEDOWN_POST', { entityType: 'posts', entityId: row.post_id });
    ok(res, row);
  }),
);

export default router;
