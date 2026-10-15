import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { setPatientAddressGeolocation } from '../../lib/geo';
import { revokeAllSessions } from '../auth/session.service';
import { updatePatientSchema, addressCreateSchema, familyMemberCreateSchema } from './patients.schemas';

const router = Router();

router.get(
  '/me',
  authenticate(),
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    const patient = await prisma.patients.findUnique({ where: { patient_id: req.authUser!.userId } });
    if (!patient) throw ApiError.notFound();
    ok(res, patient);
  }),
);

router.patch(
  '/me',
  authenticate(),
  requireRole(['patient']),
  validateBody(updatePatientSchema),
  asyncHandler(async (req, res) => {
    const patient = await prisma.patients.update({ where: { patient_id: req.authUser!.userId }, data: req.body });
    ok(res, patient);
  }),
);

router.delete(
  '/me',
  authenticate(),
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    await prisma.patients.update({ where: { patient_id: req.authUser!.userId }, data: { deleted_at: new Date() } });
    await prisma.users.update({ where: { user_id: req.authUser!.userId }, data: { deleted_at: new Date(), is_active: false } });
    await revokeAllSessions(req.authUser!.userId, 'logout');
    ok(res, { deleted: true });
  }),
);

/* ============================== ADDRESSES ============================== */

router.get(
  '/me/addresses',
  authenticate(),
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    ok(res, await prisma.patient_addresses.findMany({ where: { patient_id: req.authUser!.userId } }));
  }),
);

router.post(
  '/me/addresses',
  authenticate(),
  requireRole(['patient']),
  validateBody(addressCreateSchema),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, is_primary, ...rest } = req.body;
    if (is_primary) {
      await prisma.patient_addresses.updateMany({ where: { patient_id: req.authUser!.userId }, data: { is_primary: false } });
    }
    const address = await prisma.patient_addresses.create({
      data: { patient_id: req.authUser!.userId, latitude, longitude, is_primary: is_primary ?? false, ...rest },
    });
    if (latitude !== undefined && longitude !== undefined) {
      await setPatientAddressGeolocation(address.address_id, latitude, longitude);
    }
    created(res, address);
  }),
);

router.put(
  '/me/addresses/:address_id',
  authenticate(),
  requireRole(['patient']),
  validateBody(addressCreateSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.patient_addresses.findUnique({ where: { address_id: req.params.address_id } });
    if (!existing || existing.patient_id !== req.authUser!.userId) throw ApiError.notFound();
    const { latitude, longitude, ...rest } = req.body;
    const address = await prisma.patient_addresses.update({
      where: { address_id: req.params.address_id },
      data: { ...rest, latitude, longitude, updated_at: new Date() },
    });
    if (latitude !== undefined && longitude !== undefined) {
      await setPatientAddressGeolocation(address.address_id, latitude, longitude);
    }
    ok(res, address);
  }),
);

router.delete(
  '/me/addresses/:address_id',
  authenticate(),
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.patient_addresses.findUnique({ where: { address_id: req.params.address_id } });
    if (!existing || existing.patient_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.patient_addresses.delete({ where: { address_id: req.params.address_id } });
    ok(res, { deleted: true });
  }),
);

/* ============================== FAMILY MEMBERS ============================== */

router.get(
  '/me/family-members',
  authenticate(),
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    ok(res, await prisma.patient_family_members.findMany({ where: { patient_id: req.authUser!.userId, is_active: true } }));
  }),
);

router.post(
  '/me/family-members',
  authenticate(),
  requireRole(['patient']),
  validateBody(familyMemberCreateSchema),
  asyncHandler(async (req, res) => {
    if (req.body.relationship === 'self') {
      const existingSelf = await prisma.patient_family_members.findFirst({
        where: { patient_id: req.authUser!.userId, relationship: 'self', is_active: true },
      });
      if (existingSelf) throw ApiError.conflict('Only one "self" family member is allowed');
    }
    const row = await prisma.patient_family_members.create({
      data: {
        patient_id: req.authUser!.userId,
        ...req.body,
        date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : undefined,
      },
    });
    created(res, row);
  }),
);

router.put(
  '/me/family-members/:family_member_id',
  authenticate(),
  requireRole(['patient']),
  validateBody(familyMemberCreateSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.patient_family_members.findUnique({ where: { family_member_id: req.params.family_member_id } });
    if (!existing || existing.patient_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.patient_family_members.update({
      where: { family_member_id: req.params.family_member_id },
      data: {
        ...req.body,
        date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : undefined,
        updated_at: new Date(),
      },
    });
    ok(res, row);
  }),
);

router.delete(
  '/me/family-members/:family_member_id',
  authenticate(),
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.patient_family_members.findUnique({ where: { family_member_id: req.params.family_member_id } });
    if (!existing || existing.patient_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.patient_family_members.update({ where: { family_member_id: req.params.family_member_id }, data: { is_active: false } });
    ok(res, { deactivated: true });
  }),
);

/* ============================== PRESCRIPTIONS (read-only, cross-appointment) ============================== */

router.get(
  '/me/prescriptions',
  authenticate(),
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    const rows = await prisma.prescriptions.findMany({ where: { patient_id: req.authUser!.userId }, orderBy: { issued_at: 'desc' } });
    await prisma.user_audit_log.create({
      data: { user_id: req.authUser!.userId, action: 'PHI_ACCESS', entity_type: 'prescriptions', entity_id: null },
    });
    ok(res, rows);
  }),
);

export default router;
