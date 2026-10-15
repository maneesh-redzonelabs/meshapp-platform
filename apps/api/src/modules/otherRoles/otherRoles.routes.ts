import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { ok } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';

export const mrRouter = Router();
export const paramedicalRouter = Router();
export const supplierRouter = Router();

mrRouter.get(
  '/me',
  authenticate(),
  requireRole(['mr']),
  asyncHandler(async (req, res) => {
    const row = await prisma.medical_representatives.findUnique({ where: { mr_id: req.authUser!.userId }, include: { pharmaceutical_companies: true } });
    if (!row) throw ApiError.notFound();
    ok(res, row);
  }),
);

mrRouter.patch(
  '/me',
  authenticate(),
  requireRole(['mr']),
  asyncHandler(async (req, res) => {
    const { full_name, territory_coverage, employee_id, profile_photo_url } = req.body;
    const row = await prisma.medical_representatives.update({
      where: { mr_id: req.authUser!.userId },
      data: { full_name, territory_coverage, employee_id, profile_photo_url, updated_at: new Date() },
    });
    ok(res, row);
  }),
);

paramedicalRouter.get(
  '/me',
  authenticate(),
  requireRole(['paramedical']),
  asyncHandler(async (req, res) => {
    const row = await prisma.paramedical_providers.findUnique({ where: { provider_id: req.authUser!.userId } });
    if (!row) throw ApiError.notFound();
    ok(res, row);
  }),
);

paramedicalRouter.patch(
  '/me',
  authenticate(),
  requireRole(['paramedical']),
  asyncHandler(async (req, res) => {
    const { qualification, service_type, service_type_other, years_of_experience, profile_photo_url } = req.body;
    const row = await prisma.paramedical_providers.update({
      where: { provider_id: req.authUser!.userId },
      data: { qualification, service_type, service_type_other, years_of_experience, profile_photo_url, updated_at: new Date() },
    });
    ok(res, row);
  }),
);

supplierRouter.get(
  '/me',
  authenticate(),
  requireRole(['supplier']),
  asyncHandler(async (req, res) => {
    const row = await prisma.medical_suppliers.findUnique({ where: { supplier_id: req.authUser!.userId } });
    if (!row) throw ApiError.notFound();
    ok(res, row);
  }),
);

supplierRouter.patch(
  '/me',
  authenticate(),
  requireRole(['supplier']),
  asyncHandler(async (req, res) => {
    const { company_name, contact_person_name, business_type, profile_photo_url } = req.body;
    const row = await prisma.medical_suppliers.update({
      where: { supplier_id: req.authUser!.userId },
      data: { company_name, contact_person_name, business_type, profile_photo_url, updated_at: new Date() },
    });
    ok(res, row);
  }),
);
