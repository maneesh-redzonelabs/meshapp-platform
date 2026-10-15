import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';

const router = Router();

const ticketCreateSchema = z.object({
  subject: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

router.post(
  '/tickets',
  authenticate(),
  validateBody(ticketCreateSchema),
  asyncHandler(async (req, res) => {
    const row = await prisma.support_tickets.create({ data: { user_id: req.authUser!.userId, ...req.body } });
    created(res, row);
  }),
);

router.get(
  '/tickets',
  authenticate(),
  asyncHandler(async (req, res) => {
    const isAdmin = req.authUser!.roles.some((r) => r.startsWith('admin') || r === 'super_admin');
    const rows = await prisma.support_tickets.findMany({
      where: isAdmin ? {} : { user_id: req.authUser!.userId },
      orderBy: { created_at: 'desc' },
    });
    ok(res, rows);
  }),
);

router.post(
  '/tickets/:ticket_id/messages',
  authenticate(),
  validateBody(z.object({ message_content: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.support_tickets.findUnique({ where: { ticket_id: req.params.ticket_id } });
    if (!ticket) throw ApiError.notFound();
    const isAdmin = req.authUser!.roles.some((r) => r.startsWith('admin') || r === 'super_admin');
    if (ticket.user_id !== req.authUser!.userId && !isAdmin) throw ApiError.forbidden();
    const row = await prisma.support_chat_messages.create({
      data: {
        ticket_id: ticket.ticket_id,
        user_id: req.authUser!.userId,
        message_type: isAdmin ? 'admin' : 'user',
        message_content: req.body.message_content,
      },
    });
    created(res, row);
  }),
);

router.patch(
  '/tickets/:ticket_id/resolve',
  authenticate(),
  requirePermission('support_ticket:manage'),
  asyncHandler(async (req, res) => {
    const row = await prisma.support_tickets.update({ where: { ticket_id: req.params.ticket_id }, data: { status: 'resolved', resolved_at: new Date() } });
    ok(res, row);
  }),
);

/* ============================== SUPPORT BOT ============================== */

router.post(
  '/bot/query',
  authenticate(),
  validateBody(z.object({ message: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const text = req.body.message.toLowerCase();
    const words = text.split(/\W+/).filter(Boolean);

    const templates = await prisma.bot_response_templates.findMany({ where: { is_active: true } });
    let best: { template: (typeof templates)[number]; score: number } | null = null;
    for (const template of templates) {
      const score = template.keyword_triggers.filter((kw) => words.includes(kw.toLowerCase()) || text.includes(kw.toLowerCase())).length;
      if (score > 0 && (!best || score > best.score || (score === best.score && template.priority > best.template.priority))) {
        best = { template, score };
      }
    }

    if (!best) {
      // No confident match — escalate to a human support ticket.
      const ticket = await prisma.support_tickets.create({
        data: { user_id: req.authUser!.userId, subject: 'Bot escalation', description: req.body.message, priority: 'medium' },
      });
      await prisma.support_chat_messages.create({
        data: { ticket_id: ticket.ticket_id, user_id: req.authUser!.userId, message_type: 'user', message_content: req.body.message },
      });
      ok(res, { matched: false, escalated_ticket_id: ticket.ticket_id, response: "I'm not confident I can help with that — I've created a support ticket for our team to follow up." });
      return;
    }

    ok(res, { matched: true, category: best.template.category, response: best.template.response_text });
  }),
);

export default router;
