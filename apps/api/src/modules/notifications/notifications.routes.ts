import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { ok } from '../../lib/response';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/apiError';

const router = Router();

router.get(
  '/',
  authenticate(),
  asyncHandler(async (req, res) => {
    const cursor = req.query.cursor as string | undefined;
    const isRead = req.query.is_read as string | undefined;
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const rows = await prisma.notifications.findMany({
      where: {
        recipient_id: req.authUser!.userId,
        is_read: isRead !== undefined ? isRead === 'true' : undefined,
        ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    ok(res, rows, { next_cursor: rows.length === limit ? rows[rows.length - 1].created_at.toISOString() : null });
  }),
);

router.patch(
  '/:notification_id/read',
  authenticate(),
  asyncHandler(async (req, res) => {
    const notif = await prisma.notifications.findUnique({ where: { notification_id: req.params.notification_id } });
    if (!notif || notif.recipient_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.notifications.update({ where: { notification_id: notif.notification_id }, data: { is_read: true, read_at: new Date() } });
    ok(res, row);
  }),
);

router.patch(
  '/read-all',
  authenticate(),
  asyncHandler(async (req, res) => {
    await prisma.notifications.updateMany({ where: { recipient_id: req.authUser!.userId, is_read: false }, data: { is_read: true, read_at: new Date() } });
    ok(res, { marked_all_read: true });
  }),
);

export default router;
