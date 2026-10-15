import { Router } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateQuery } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { ok } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { searchNearbyDoctors } from '../../lib/geo';
import { searchDoctorsQuerySchema } from '../doctors/doctors.schemas';

const router = Router();

router.get(
  '/doctors',
  authenticate(),
  requireRole(['patient']),
  validateQuery(searchDoctorsQuerySchema),
  asyncHandler(async (req, res) => {
    const q = (req as any).validatedQuery as z.infer<typeof searchDoctorsQuerySchema>;
    let { lat, lng } = q;

    if (lat === undefined || lng === undefined) {
      const address = await prisma.patient_addresses.findFirst({ where: { patient_id: req.authUser!.userId, is_primary: true } });
      if (!address?.latitude || !address?.longitude) {
        throw ApiError.badRequest('Provide lat+lng, or set a primary address with coordinates first');
      }
      lat = Number(address.latitude);
      lng = Number(address.longitude);
    }

    const rows = await searchNearbyDoctors({
      lat,
      lng,
      radiusMeters: q.radius_km * 1000,
      specialityId: q.speciality_id,
      subspecialityId: q.subspeciality_id,
      limit: q.limit,
      offset: q.offset,
    });
    ok(res, rows, { next_cursor: rows.length === q.limit ? String(q.offset + q.limit) : null });
  }),
);

router.get(
  '/specialities',
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.medical_specialities.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }));
  }),
);

router.get(
  '/specialities/:speciality_id/subspecialities',
  asyncHandler(async (req, res) => {
    const specialityId = Number(req.params.speciality_id);
    if (!Number.isInteger(specialityId)) throw ApiError.badRequest('speciality_id must be an integer');
    ok(res, await prisma.medical_subspecialities.findMany({ where: { speciality_id: specialityId, is_active: true }, orderBy: { sort_order: 'asc' } }));
  }),
);

export default router;
