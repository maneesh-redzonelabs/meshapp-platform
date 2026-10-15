import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { runComplianceScan } from './compliance.service';

const router = Router();

const scanSchema = z.object({
  content_type: z.enum(['doctor_achievement', 'doctor_publication', 'post', 'equipment_listing']),
  text: z.string().min(1).max(10000),
  has_image: z.boolean().optional(),
});

router.post(
  '/scan',
  authenticate(),
  validateBody(scanSchema),
  asyncHandler(async (req, res) => {
    const result = await runComplianceScan({ userId: req.authUser!.userId, entityType: req.body.content_type, text: req.body.text });
    created(res, result);
  }),
);

router.get(
  '/scans/:scan_id',
  authenticate(),
  asyncHandler(async (req, res) => {
    const scan = await prisma.content_compliance_scans.findUnique({ where: { scan_id: req.params.scan_id } });
    if (!scan || (scan.user_id !== req.authUser!.userId && !req.authUser!.roles.includes('super_admin'))) {
      throw ApiError.notFound();
    }
    ok(res, {
      scan_id: scan.scan_id,
      entity_type: scan.entity_type,
      verdict: scan.verdict,
      violations: scan.matched_rules,
      scanned_at: scan.scanned_at,
    });
  }),
);

export default router;

/* ---------------------------- Admin rule management ----------------------------
 * Mounted separately at /v1/admin/compliance by server.ts (per spec paths
 * GET/POST /admin/compliance/rules, PATCH /admin/compliance/rules/:rule_id,
 * GET /admin/compliance/scans), kept in this file since it's the same domain. */

export const adminComplianceRouter = Router();

const ruleSchema = z.object({
  category: z.string().min(1).max(150),
  pattern: z.string().min(1),
  severity: z.enum(['block', 'warn']),
  guidance: z.string().min(1),
  source_ref: z.string().max(255).optional(),
});

adminComplianceRouter.get(
  '/rules',
  authenticate(),
  requirePermission('compliance_rules:manage'),
  asyncHandler(async (_req, res) => {
    const rules = await prisma.content_compliance_rules.findMany({ orderBy: { rule_id: 'asc' } });
    ok(res, rules);
  }),
);

adminComplianceRouter.post(
  '/rules',
  authenticate(),
  requirePermission('compliance_rules:manage'),
  validateBody(ruleSchema),
  asyncHandler(async (req, res) => {
    // Validate the pattern compiles as a JS regex before persisting it.
    try {
      // eslint-disable-next-line no-new
      new RegExp(req.body.pattern);
    } catch {
      throw ApiError.badRequest('pattern is not a valid regular expression');
    }
    const rule = await prisma.content_compliance_rules.create({ data: req.body });
    created(res, rule);
  }),
);

adminComplianceRouter.patch(
  '/rules/:rule_id',
  authenticate(),
  requirePermission('compliance_rules:manage'),
  asyncHandler(async (req, res) => {
    const ruleId = Number(req.params.rule_id);
    if (!Number.isInteger(ruleId)) throw ApiError.badRequest('rule_id must be an integer');
    if (req.body.pattern) {
      try {
        // eslint-disable-next-line no-new
        new RegExp(req.body.pattern);
      } catch {
        throw ApiError.badRequest('pattern is not a valid regular expression');
      }
    }
    const rule = await prisma.content_compliance_rules.update({
      where: { rule_id: ruleId },
      data: { ...req.body, updated_at: new Date() },
    });
    ok(res, rule);
  }),
);

adminComplianceRouter.get(
  '/scans',
  authenticate(),
  requirePermission('compliance_rules:manage'),
  asyncHandler(async (req, res) => {
    const { verdict, entity_type, user_id } = req.query as Record<string, string | undefined>;
    const scans = await prisma.content_compliance_scans.findMany({
      where: {
        verdict: verdict as any,
        entity_type: entity_type as any,
        user_id,
      },
      orderBy: { scanned_at: 'desc' },
      take: 100,
    });
    ok(res, scans);
  }),
);
