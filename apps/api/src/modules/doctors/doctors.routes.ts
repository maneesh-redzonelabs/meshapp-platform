import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate, authenticateOptional } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { setClinicGeolocation, insertClinicLocation } from '../../lib/geo';
import { consumeUpload } from '../uploads/uploads.store';
import { assertPassedScan } from '../compliance/compliance.service';
import { recomputeProfileCompleteness } from './profileCompleteness';
import {
  updateDoctorProfileSchema,
  selfieSchema,
  educationCreateSchema,
  affiliationCreateSchema,
  achievementCreateSchema,
  publicationCreateSchema,
  locationCreateSchema,
  availabilitySlotSchema,
  blockedDateSchema,
  verificationDocumentSchema,
  searchDoctorsQuerySchema,
} from './doctors.schemas';

const router = Router();

function publicDoctorView(d: any) {
  return {
    doctor_id: d.doctor_id,
    full_name: d.full_name,
    profile_selfie_url: d.profile_selfie_url,
    speciality_id: d.speciality_id,
    subspeciality_id: d.subspeciality_id,
    bio: d.bio,
    years_of_experience: d.years_of_experience,
    subscription_tier: d.subscription_tier,
    verification_status: d.verification_status,
    rating_avg: d.rating_avg,
    rating_count: d.rating_count,
    backdrop_image_url: d.backdrop_image_url,
  };
}

/* ============================== OWN PROFILE ============================== */

router.get(
  '/me',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const doctor = await prisma.doctors.findUnique({ where: { doctor_id: req.authUser!.userId } });
    if (!doctor) throw ApiError.notFound();
    ok(res, doctor);
  }),
);

router.patch(
  '/me',
  authenticate(),
  requireRole(['doctor']),
  validateBody(updateDoctorProfileSchema),
  asyncHandler(async (req, res) => {
    const current = await prisma.doctors.findUnique({ where: { doctor_id: req.authUser!.userId } });
    if (!current) throw ApiError.notFound();

    const specialityChanged =
      (req.body.speciality_id && req.body.speciality_id !== current.speciality_id) ||
      (req.body.subspeciality_id && req.body.subspeciality_id !== current.subspeciality_id);

    const doctor = await prisma.doctors.update({
      where: { doctor_id: req.authUser!.userId },
      data: {
        ...req.body,
        verification_status: specialityChanged ? 'pending' : undefined,
      },
    });
    await recomputeProfileCompleteness(doctor.doctor_id);
    ok(res, doctor);
  }),
);

router.post(
  '/me/selfie',
  authenticate(),
  requireRole(['doctor']),
  validateBody(selfieSchema),
  asyncHandler(async (req, res) => {
    const localPath = consumeUpload(req.body.upload_id, req.authUser!.userId);
    if (!localPath) throw ApiError.badRequest('Invalid or already-used upload_id');
    const doctor = await prisma.doctors.update({ where: { doctor_id: req.authUser!.userId }, data: { profile_selfie_url: localPath } });
    await recomputeProfileCompleteness(doctor.doctor_id);
    ok(res, { profile_selfie_url: doctor.profile_selfie_url });
  }),
);

router.get(
  '/:doctor_id',
  authenticateOptional(),
  asyncHandler(async (req, res) => {
    const doctor = await prisma.doctors.findUnique({ where: { doctor_id: req.params.doctor_id } });
    if (!doctor || doctor.deleted_at) throw ApiError.notFound();
    const isSelf = req.authUser?.userId === doctor.doctor_id;
    const isAdmin = req.authUser?.roles.includes('super_admin');
    if (!isSelf && !isAdmin && !doctor.is_searchable) throw ApiError.notFound();
    ok(res, publicDoctorView(doctor));
  }),
);

/* ============================== EDUCATION ============================== */

router.get(
  '/:doctor_id/education',
  asyncHandler(async (req, res) => {
    ok(res, await prisma.doctor_education.findMany({ where: { doctor_id: req.params.doctor_id }, orderBy: { passing_year: 'asc' } }));
  }),
);

router.post(
  '/me/education',
  authenticate(),
  requireRole(['doctor']),
  validateBody(educationCreateSchema),
  asyncHandler(async (req, res) => {
    const row = await prisma.doctor_education.create({ data: { doctor_id: req.authUser!.userId, ...req.body } });
    await recomputeProfileCompleteness(req.authUser!.userId);
    created(res, row);
  }),
);

router.put(
  '/me/education/:education_id',
  authenticate(),
  requireRole(['doctor']),
  validateBody(educationCreateSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_education.findUnique({ where: { education_id: req.params.education_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.doctor_education.update({ where: { education_id: req.params.education_id }, data: { ...req.body, updated_at: new Date() } });
    ok(res, row);
  }),
);

router.delete(
  '/me/education/:education_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_education.findUnique({ where: { education_id: req.params.education_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.doctor_education.delete({ where: { education_id: req.params.education_id } });
    ok(res, { deleted: true });
  }),
);

/* ============================== AFFILIATIONS ============================== */

router.get(
  '/:doctor_id/affiliations',
  asyncHandler(async (req, res) => {
    ok(res, await prisma.doctor_affiliations.findMany({ where: { doctor_id: req.params.doctor_id }, orderBy: { from_year: 'desc' } }));
  }),
);

router.post(
  '/me/affiliations',
  authenticate(),
  requireRole(['doctor']),
  validateBody(affiliationCreateSchema),
  asyncHandler(async (req, res) => {
    const row = await prisma.doctor_affiliations.create({ data: { doctor_id: req.authUser!.userId, ...req.body } });
    await recomputeProfileCompleteness(req.authUser!.userId);
    created(res, row);
  }),
);

router.put(
  '/me/affiliations/:affiliation_id',
  authenticate(),
  requireRole(['doctor']),
  validateBody(affiliationCreateSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_affiliations.findUnique({ where: { affiliation_id: req.params.affiliation_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.doctor_affiliations.update({ where: { affiliation_id: req.params.affiliation_id }, data: { ...req.body, updated_at: new Date() } });
    ok(res, row);
  }),
);

router.delete(
  '/me/affiliations/:affiliation_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_affiliations.findUnique({ where: { affiliation_id: req.params.affiliation_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.doctor_affiliations.delete({ where: { affiliation_id: req.params.affiliation_id } });
    ok(res, { deleted: true });
  }),
);

/* ============================== ACHIEVEMENTS (compliance-gated) ============================== */

router.get(
  '/:doctor_id/achievements',
  asyncHandler(async (req, res) => {
    ok(res, await prisma.doctor_achievements.findMany({ where: { doctor_id: req.params.doctor_id }, orderBy: { achievement_year: 'desc' } }));
  }),
);

router.post(
  '/me/achievements',
  authenticate(),
  requireRole(['doctor']),
  validateBody(achievementCreateSchema),
  asyncHandler(async (req, res) => {
    const { compliance_scan_id, ...rest } = req.body;
    await assertPassedScan({ scanId: compliance_scan_id, userId: req.authUser!.userId, entityType: 'doctor_achievement', text: rest.achievement_text });
    const row = await prisma.doctor_achievements.create({
      data: { doctor_id: req.authUser!.userId, compliance_scan_id, ...rest },
    });
    await prisma.content_compliance_scans.update({ where: { scan_id: compliance_scan_id }, data: { entity_id: row.achievement_id } });
    await recomputeProfileCompleteness(req.authUser!.userId);
    created(res, row);
  }),
);

router.delete(
  '/me/achievements/:achievement_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_achievements.findUnique({ where: { achievement_id: req.params.achievement_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.doctor_achievements.delete({ where: { achievement_id: req.params.achievement_id } });
    ok(res, { deleted: true });
  }),
);

/* ============================== PUBLICATIONS (compliance-gated) ============================== */

router.get(
  '/:doctor_id/publications',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const rows = q
      ? await prisma.$queryRaw`
          SELECT * FROM meshapp.doctor_publications
          WHERE doctor_id = ${req.params.doctor_id}::uuid
            AND to_tsvector('english', title) @@ plainto_tsquery('english', ${q})
          ORDER BY publication_year DESC`
      : await prisma.doctor_publications.findMany({ where: { doctor_id: req.params.doctor_id }, orderBy: { publication_year: 'desc' } });
    ok(res, rows);
  }),
);

router.post(
  '/me/publications',
  authenticate(),
  requireRole(['doctor']),
  validateBody(publicationCreateSchema),
  asyncHandler(async (req, res) => {
    const { compliance_scan_id, ...rest } = req.body;
    await assertPassedScan({ scanId: compliance_scan_id, userId: req.authUser!.userId, entityType: 'doctor_publication', text: rest.title });
    const row = await prisma.doctor_publications.create({
      data: { doctor_id: req.authUser!.userId, compliance_scan_id, ...rest },
    });
    await prisma.content_compliance_scans.update({ where: { scan_id: compliance_scan_id }, data: { entity_id: row.publication_id } });
    await recomputeProfileCompleteness(req.authUser!.userId);
    created(res, row);
  }),
);

router.delete(
  '/me/publications/:publication_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_publications.findUnique({ where: { publication_id: req.params.publication_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.doctor_publications.delete({ where: { publication_id: req.params.publication_id } });
    ok(res, { deleted: true });
  }),
);

/* ============================== CLINIC LOCATIONS ============================== */

router.get(
  '/:doctor_id/locations',
  asyncHandler(async (req, res) => {
    ok(res, await prisma.doctor_clinic_locations.findMany({ where: { doctor_id: req.params.doctor_id, is_active: true } }));
  }),
);

router.post(
  '/me/locations',
  authenticate(),
  requireRole(['doctor']),
  validateBody(locationCreateSchema),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, is_primary, clinic_hospital_name, address_line1, address_line2, city, state, pin_code, consultation_fee_inperson, consultation_fee_video } = req.body;
    if (is_primary) {
      await prisma.doctor_clinic_locations.updateMany({ where: { doctor_id: req.authUser!.userId }, data: { is_primary: false } });
    }
    const loc = await insertClinicLocation({
      doctorId: req.authUser!.userId,
      clinicHospitalName: clinic_hospital_name,
      addressLine1: address_line1,
      addressLine2: address_line2,
      city,
      state,
      pinCode: pin_code,
      latitude,
      longitude,
      consultationFeeInPerson: consultation_fee_inperson,
      consultationFeeVideo: consultation_fee_video,
      isPrimary: is_primary ?? false,
    });
    await recomputeProfileCompleteness(req.authUser!.userId);
    created(res, loc);
  }),
);

router.put(
  '/me/locations/:location_id',
  authenticate(),
  requireRole(['doctor']),
  validateBody(locationCreateSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_clinic_locations.findUnique({ where: { location_id: req.params.location_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();

    const { latitude, longitude, ...rest } = req.body;
    const loc = await prisma.doctor_clinic_locations.update({
      where: { location_id: req.params.location_id },
      data: { ...rest, latitude, longitude, updated_at: new Date() },
    });
    if (latitude !== undefined && longitude !== undefined) {
      await setClinicGeolocation(loc.location_id, latitude, longitude);
    }
    ok(res, loc);
  }),
);

router.delete(
  '/me/locations/:location_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_clinic_locations.findUnique({ where: { location_id: req.params.location_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    // Never hard-delete: appointments may reference this location.
    await prisma.doctor_clinic_locations.update({ where: { location_id: req.params.location_id }, data: { is_active: false } });
    ok(res, { deactivated: true });
  }),
);

/* ============================== AVAILABILITY & BLOCKED DATES ============================== */

router.get(
  '/:doctor_id/availability',
  asyncHandler(async (req, res) => {
    ok(res, await prisma.doctor_availability_slots.findMany({ where: { doctor_id: req.params.doctor_id, is_active: true }, orderBy: { day_of_week: 'asc' } }));
  }),
);

router.post(
  '/me/availability',
  authenticate(),
  requireRole(['doctor']),
  validateBody(availabilitySlotSchema),
  asyncHandler(async (req, res) => {
    const row = await prisma.doctor_availability_slots.create({ data: { doctor_id: req.authUser!.userId, ...req.body } });
    await recomputeProfileCompleteness(req.authUser!.userId);
    created(res, row);
  }),
);

router.put(
  '/me/availability/:slot_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_availability_slots.findUnique({ where: { slot_id: req.params.slot_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.doctor_availability_slots.update({ where: { slot_id: req.params.slot_id }, data: { ...req.body, updated_at: new Date() } });
    ok(res, row);
  }),
);

router.delete(
  '/me/availability/:slot_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_availability_slots.findUnique({ where: { slot_id: req.params.slot_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.doctor_availability_slots.update({ where: { slot_id: req.params.slot_id }, data: { is_active: false } });
    ok(res, { deactivated: true });
  }),
);

router.post(
  '/me/blocked-dates',
  authenticate(),
  requireRole(['doctor']),
  validateBody(blockedDateSchema),
  asyncHandler(async (req, res) => {
    const row = await prisma.doctor_blocked_dates.create({ data: { doctor_id: req.authUser!.userId, ...req.body, blocked_date: new Date(req.body.blocked_date) } });
    created(res, row);
  }),
);

router.delete(
  '/me/blocked-dates/:blocked_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const existing = await prisma.doctor_blocked_dates.findUnique({ where: { blocked_id: req.params.blocked_id } });
    if (!existing || existing.doctor_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.doctor_blocked_dates.delete({ where: { blocked_id: req.params.blocked_id } });
    ok(res, { deleted: true });
  }),
);

/* ============================== COMPUTED AVAILABLE TIMES ============================== */

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function bucket(mins: number): 'morning' | 'afternoon' | 'evening' {
  if (mins < 12 * 60) return 'morning';
  if (mins < 17 * 60) return 'afternoon';
  return 'evening';
}

router.get(
  '/:doctor_id/available-times',
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date as string | undefined;
    if (!dateStr) throw ApiError.badRequest('date query param (YYYY-MM-DD) is required');
    const date = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');
    const dayOfWeek = date.getUTCDay();

    const [slots, blocked, appointments] = await Promise.all([
      prisma.doctor_availability_slots.findMany({ where: { doctor_id: req.params.doctor_id, day_of_week: dayOfWeek, is_active: true } }),
      prisma.doctor_blocked_dates.findMany({ where: { doctor_id: req.params.doctor_id, blocked_date: date } }),
      prisma.appointments.findMany({
        where: { doctor_id: req.params.doctor_id, appointment_date: date, status: { in: ['requested', 'confirmed'] } },
        select: { start_time: true },
      }),
    ]);

    if (blocked.some((b) => b.blocked_type === 'full_day')) {
      ok(res, { morning: [], afternoon: [], evening: [] });
      return;
    }

    const bookedTimes = new Set(appointments.map((a) => a.start_time.toISOString().substring(11, 16)));
    const partialBlocks = blocked.filter((b) => b.blocked_type === 'partial');

    const grouped: Record<'morning' | 'afternoon' | 'evening', string[]> = { morning: [], afternoon: [], evening: [] };

    for (const slot of slots) {
      const startMin = timeToMinutes(slot.start_time.toISOString().substring(11, 16));
      const endMin = timeToMinutes(slot.end_time.toISOString().substring(11, 16));
      for (let t = startMin; t + slot.slot_duration_minutes <= endMin; t += slot.slot_duration_minutes) {
        const label = minutesToTime(t);
        if (bookedTimes.has(label)) continue;
        const blockedOut = partialBlocks.some((b) => {
          if (!b.blocked_start || !b.blocked_end) return false;
          const bs = timeToMinutes(b.blocked_start.toISOString().substring(11, 16));
          const be = timeToMinutes(b.blocked_end.toISOString().substring(11, 16));
          return t >= bs && t < be;
        });
        if (blockedOut) continue;
        grouped[bucket(t)].push(label);
      }
    }

    ok(res, grouped);
  }),
);

/* ============================== VERIFICATION DOCUMENTS ============================== */

router.post(
  '/me/verification-documents',
  authenticate(),
  requireRole(['doctor']),
  validateBody(verificationDocumentSchema),
  asyncHandler(async (req, res) => {
    const localPath = consumeUpload(req.body.upload_id, req.authUser!.userId);
    if (!localPath) throw ApiError.badRequest('Invalid or already-used upload_id');
    const row = await prisma.doctor_verification_documents.create({
      data: {
        doctor_id: req.authUser!.userId,
        document_type: req.body.document_type,
        nmc_registration_no: req.body.nmc_registration_no,
        file_path: localPath,
      },
    });
    await prisma.doctors.update({ where: { doctor_id: req.authUser!.userId }, data: { verification_status: 'pending' } });
    created(res, row);
  }),
);

router.get(
  '/me/verification-documents',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    ok(res, await prisma.doctor_verification_documents.findMany({ where: { doctor_id: req.authUser!.userId }, orderBy: { uploaded_at: 'desc' } }));
  }),
);

router.get(
  '/me/schedule',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date as string | undefined;
    if (!dateStr) throw ApiError.badRequest('date query param (YYYY-MM-DD) is required');
    const rows = await prisma.appointments.findMany({
      where: { doctor_id: req.authUser!.userId, appointment_date: new Date(dateStr), status: { notIn: ['cancelled', 'no_show'] } },
      orderBy: { start_time: 'asc' },
    });
    ok(res, rows);
  }),
);

router.get(
  '/me/verification-documents/:document_id/download-url',
  authenticate(),
  asyncHandler(async (req, res) => {
    const doc = await prisma.doctor_verification_documents.findUnique({ where: { document_id: req.params.document_id } });
    if (!doc) throw ApiError.notFound();
    const isOwner = doc.doctor_id === req.authUser!.userId;
    const isAdmin = req.authUser!.roles.some((r) => r.startsWith('admin') || r === 'super_admin');
    if (!isOwner && !isAdmin) throw ApiError.forbidden();
    await prisma.user_audit_log.create({
      data: { user_id: req.authUser!.userId, action: 'PHI_ACCESS', entity_type: 'doctor_verification_documents', entity_id: doc.document_id },
    });
    // Local-disk dev substitute for a 60s S3 presigned GET.
    ok(res, { url: doc.file_path, expires_in_seconds: 60 });
  }),
);

export default router;
