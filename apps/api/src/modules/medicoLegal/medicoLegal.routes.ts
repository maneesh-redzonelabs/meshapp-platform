import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';

const router = Router();

const requestCreateSchema = z.object({
  category: z.enum(['malpractice_allegation', 'consent_review', 'notice_reply', 'hospital_compliance', 'general']).default('general'),
  subject: z.string().min(1).max(500),
  description: z.string().min(1),
});

router.post(
  '/requests',
  authenticate(),
  requireRole(['doctor']),
  validateBody(requestCreateSchema),
  asyncHandler(async (req, res) => {
    const row = await prisma.medico_legal_requests.create({ data: { requester_id: req.authUser!.userId, ...req.body } });
    created(res, row);
  }),
);

router.get(
  '/requests',
  authenticate(),
  requireRole(['doctor', 'medico_legal']),
  asyncHandler(async (req, res) => {
    const where =
      req.authUser!.userType === 'medico_legal'
        ? { assigned_expert_id: req.authUser!.userId }
        : { requester_id: req.authUser!.userId };
    const rows = await prisma.medico_legal_requests.findMany({ where, orderBy: { created_at: 'desc' } });
    ok(res, rows);
  }),
);

router.patch(
  '/requests/:request_id/assign',
  authenticate(),
  requireRole(['admin']),
  validateBody(z.object({ assigned_expert_id: z.string().uuid(), scheduled_call_at: z.string().datetime().optional() })),
  asyncHandler(async (req, res) => {
    const row = await prisma.medico_legal_requests.update({
      where: { request_id: req.params.request_id },
      data: {
        assigned_expert_id: req.body.assigned_expert_id,
        scheduled_call_at: req.body.scheduled_call_at ? new Date(req.body.scheduled_call_at) : undefined,
        status: 'assigned',
      },
    });
    ok(res, row);
  }),
);

router.post(
  '/requests/:request_id/consultations',
  authenticate(),
  requireRole(['medico_legal']),
  validateBody(
    z.object({
      doctor_id: z.string().uuid(),
      consultation_type: z.enum(['phone', 'video', 'written']),
      duration_minutes: z.number().int().min(0).optional(),
      notes: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const request = await prisma.medico_legal_requests.findUnique({ where: { request_id: req.params.request_id } });
    if (!request) throw ApiError.notFound();

    const expert = await prisma.medico_legal_experts.findUnique({ where: { expert_id: req.authUser!.userId } });
    if (!expert) throw ApiError.notFound('Expert profile not found');

    const priorMinutes = await prisma.medico_legal_consultations.aggregate({
      where: { expert_id: expert.expert_id, doctor_id: req.body.doctor_id, is_free_tier: true },
      _sum: { duration_minutes: true },
    });
    const usedFreeMinutes = priorMinutes._sum.duration_minutes ?? 0;
    const isFreeTier = usedFreeMinutes < expert.free_consult_minutes;

    const row = await prisma.medico_legal_consultations.create({
      data: {
        request_id: request.request_id,
        expert_id: expert.expert_id,
        doctor_id: req.body.doctor_id,
        consultation_type: req.body.consultation_type,
        duration_minutes: req.body.duration_minutes,
        notes: req.body.notes,
        is_free_tier: isFreeTier,
        started_at: new Date(),
      },
    });
    await prisma.medico_legal_requests.update({ where: { request_id: request.request_id }, data: { status: 'in_progress' } });
    created(res, row);
  }),
);

router.patch(
  '/requests/:request_id/resolve',
  authenticate(),
  requireRole(['medico_legal']),
  validateBody(z.object({ resolution_notes: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const row = await prisma.medico_legal_requests.update({
      where: { request_id: req.params.request_id },
      data: { resolution_notes: req.body.resolution_notes, status: 'resolved' },
    });
    ok(res, row);
  }),
);

export default router;
