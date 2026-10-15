import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { appointmentCreateLimiter } from '../../middleware/rateLimit';
import { idempotencyKey } from '../../middleware/idempotency';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { bookAppointment } from './appointments.service';
import { createAppointmentSchema, cancelAppointmentSchema, rescheduleAppointmentSchema, prescriptionCreateSchema } from './appointments.schemas';

const router = Router();

async function loadOwnedAppointment(req: any) {
  const appt = await prisma.appointments.findUnique({ where: { appointment_id: req.params.appointment_id } });
  if (!appt) throw ApiError.notFound();
  const isPatient = req.authUser.userType === 'patient' && appt.patient_id === req.authUser.userId;
  const isDoctor = req.authUser.userType === 'doctor' && appt.doctor_id === req.authUser.userId;
  if (!isPatient && !isDoctor) throw ApiError.notFound();
  return appt;
}

router.post(
  '/',
  authenticate(),
  requireRole(['patient']),
  appointmentCreateLimiter,
  idempotencyKey(),
  validateBody(createAppointmentSchema),
  asyncHandler(async (req, res) => {
    const { appointment, payment } = await bookAppointment({
      patientId: req.authUser!.userId,
      doctorId: req.body.doctor_id,
      locationId: req.body.location_id,
      familyMemberId: req.body.family_member_id,
      appointmentDate: req.body.appointment_date,
      startTime: req.body.start_time,
      appointmentType: req.body.appointment_type,
      patientNotes: req.body.patient_notes,
    });
    created(res, {
      appointment,
      payment_intent: { payment_id: payment.payment_id, amount: payment.amount, status: payment.status },
    });
  }),
);

router.get(
  '/',
  authenticate(),
  requireRole(['patient', 'doctor']),
  asyncHandler(async (req, res) => {
    const { status, date_from, date_to } = req.query as Record<string, string | undefined>;
    const where: any =
      req.authUser!.userType === 'patient' ? { patient_id: req.authUser!.userId } : { doctor_id: req.authUser!.userId };
    if (status) where.status = status;
    if (date_from || date_to) {
      where.appointment_date = {};
      if (date_from) where.appointment_date.gte = new Date(date_from);
      if (date_to) where.appointment_date.lte = new Date(date_to);
    }
    const rows = await prisma.appointments.findMany({ where, orderBy: [{ appointment_date: 'desc' }, { start_time: 'desc' }] });
    ok(res, rows);
  }),
);

router.get(
  '/:appointment_id',
  authenticate(),
  requireRole(['patient', 'doctor']),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    ok(res, appt);
  }),
);

router.patch(
  '/:appointment_id/confirm',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    if (appt.status !== 'requested') throw ApiError.businessRule(`Cannot confirm an appointment in status ${appt.status}`);
    const updated = await prisma.appointments.update({ where: { appointment_id: appt.appointment_id }, data: { status: 'confirmed' } });
    ok(res, updated);
  }),
);

router.patch(
  '/:appointment_id/cancel',
  authenticate(),
  requireRole(['patient', 'doctor']),
  validateBody(cancelAppointmentSchema),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    if (!['requested', 'confirmed'].includes(appt.status)) {
      throw ApiError.businessRule(`Cannot cancel an appointment in status ${appt.status}`);
    }
    const cancelledBy = req.authUser!.userType === 'patient' ? 'patient' : 'doctor';
    const updated = await prisma.appointments.update({
      where: { appointment_id: appt.appointment_id },
      data: { status: 'cancelled', cancellation_reason: req.body.cancellation_reason, cancelled_by: cancelledBy },
    });

    // Refund workflow trigger: if already paid, flag for refund (mock gateway — see payments module).
    if (appt.payment_status === 'paid' && appt.payment_id) {
      await prisma.payments.update({ where: { payment_id: appt.payment_id }, data: { status: 'refunded', refund_amount: appt.total_amount, refunded_at: new Date() } });
      await prisma.appointments.update({ where: { appointment_id: appt.appointment_id }, data: { payment_status: 'refunded' } });
    }

    ok(res, updated);
  }),
);

router.post(
  '/:appointment_id/reschedule',
  authenticate(),
  requireRole(['patient']),
  validateBody(rescheduleAppointmentSchema),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    if (!['requested', 'confirmed'].includes(appt.status)) {
      throw ApiError.businessRule(`Cannot reschedule an appointment in status ${appt.status}`);
    }

    const { appointment: newAppt } = await bookAppointment({
      patientId: appt.patient_id,
      doctorId: appt.doctor_id,
      locationId: appt.location_id ?? undefined,
      familyMemberId: appt.family_member_id ?? undefined,
      appointmentDate: req.body.appointment_date,
      startTime: req.body.start_time,
      appointmentType: appt.appointment_type,
      patientNotes: appt.patient_notes ?? undefined,
    });

    await prisma.appointments.update({
      where: { appointment_id: newAppt.appointment_id },
      data: { rescheduled_from: appt.appointment_id },
    });
    await prisma.appointments.update({ where: { appointment_id: appt.appointment_id }, data: { status: 'rescheduled' } });

    ok(res, newAppt);
  }),
);

router.patch(
  '/:appointment_id/complete',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    if (appt.status !== 'confirmed') throw ApiError.businessRule('Only a confirmed appointment can be completed');
    const updated = await prisma.appointments.update({ where: { appointment_id: appt.appointment_id }, data: { status: 'completed' } });
    ok(res, updated);
  }),
);

router.patch(
  '/:appointment_id/no-show',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    if (appt.status !== 'confirmed') throw ApiError.businessRule('Only a confirmed appointment can be marked no-show');
    const updated = await prisma.appointments.update({ where: { appointment_id: appt.appointment_id }, data: { status: 'no_show' } });
    ok(res, updated);
  }),
);

/* ============================== VIDEO SESSIONS (stub provider) ============================== */

router.post(
  '/:appointment_id/video-session',
  authenticate(),
  requireRole(['patient', 'doctor']),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    if (appt.appointment_type !== 'video_call') throw ApiError.businessRule('This appointment is not a video_call appointment');

    let session = appt.video_session_id ? await prisma.video_call_sessions.findUnique({ where: { session_id: appt.video_session_id } }) : null;
    if (!session) {
      // Stub provider: generate a fake room token instead of calling a real video SDK (Twilio/Agora/etc).
      const fakeRoomToken = randomBytes(24).toString('hex');
      session = await prisma.video_call_sessions.create({
        data: { appointment_id: appt.appointment_id, session_token: fakeRoomToken, session_status: 'scheduled' },
      });
      await prisma.appointments.update({ where: { appointment_id: appt.appointment_id }, data: { video_session_id: session.session_id } });
    }
    created(res, { session_id: session.session_id, session_token: session.session_token, session_status: session.session_status });
  }),
);

router.patch(
  '/video-sessions/:session_id/join',
  authenticate(),
  requireRole(['patient', 'doctor']),
  asyncHandler(async (req, res) => {
    const session = await prisma.video_call_sessions.findUnique({ where: { session_id: req.params.session_id } });
    if (!session || !session.appointment_id) throw ApiError.notFound();
    const appt = await prisma.appointments.findUnique({ where: { appointment_id: session.appointment_id } });
    if (!appt) throw ApiError.notFound();
    const isPatient = req.authUser!.userType === 'patient' && appt.patient_id === req.authUser!.userId;
    const isDoctor = req.authUser!.userType === 'doctor' && appt.doctor_id === req.authUser!.userId;
    if (!isPatient && !isDoctor) throw ApiError.notFound();

    const data: any = { session_status: 'active' };
    if (isDoctor && !session.doctor_joined_at) data.doctor_joined_at = new Date();
    if (isPatient && !session.patient_joined_at) data.patient_joined_at = new Date();
    const updated = await prisma.video_call_sessions.update({ where: { session_id: session.session_id }, data });
    ok(res, updated);
  }),
);

router.patch(
  '/video-sessions/:session_id/end',
  authenticate(),
  requireRole(['patient', 'doctor']),
  asyncHandler(async (req, res) => {
    const session = await prisma.video_call_sessions.findUnique({ where: { session_id: req.params.session_id } });
    if (!session) throw ApiError.notFound();
    const startedAt = session.doctor_joined_at ?? session.patient_joined_at ?? session.created_at;
    const endedAt = new Date();
    const duration = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
    const updated = await prisma.video_call_sessions.update({
      where: { session_id: session.session_id },
      data: { session_status: 'ended', ended_at: endedAt, duration_seconds: duration },
    });
    ok(res, updated);
  }),
);

/* ============================== PRESCRIPTIONS ============================== */

router.post(
  '/:appointment_id/prescription',
  authenticate(),
  requireRole(['doctor']),
  validateBody(prescriptionCreateSchema),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    if (appt.status !== 'completed') throw ApiError.businessRule('Prescriptions can only be issued for completed appointments');

    const existing = await prisma.prescriptions.findUnique({ where: { appointment_id: appt.appointment_id } });
    if (existing) throw ApiError.conflict('A prescription already exists for this appointment');

    // digital_signature: a deterministic hash over the canonical prescription
    // content, standing in for a real RSA/ECDSA signing-key operation (see README).
    const canonical = JSON.stringify({ diagnosis: req.body.diagnosis, medications: req.body.medications, advice: req.body.advice, appt: appt.appointment_id });
    const digital_signature = createHash('sha256').update(canonical).digest('hex');

    const row = await prisma.prescriptions.create({
      data: {
        appointment_id: appt.appointment_id,
        doctor_id: appt.doctor_id,
        patient_id: appt.patient_id,
        family_member_id: appt.family_member_id,
        diagnosis: req.body.diagnosis,
        medications: req.body.medications,
        advice: req.body.advice,
        follow_up_date: req.body.follow_up_date ? new Date(req.body.follow_up_date) : undefined,
        digital_signature,
      },
    });
    created(res, row);
  }),
);

router.get(
  '/:appointment_id/prescription',
  authenticate(),
  requireRole(['patient', 'doctor']),
  asyncHandler(async (req, res) => {
    const appt = await loadOwnedAppointment(req);
    const prescription = await prisma.prescriptions.findUnique({ where: { appointment_id: appt.appointment_id } });
    if (!prescription) throw ApiError.notFound();
    await prisma.user_audit_log.create({
      data: { user_id: req.authUser!.userId, action: 'PHI_ACCESS', entity_type: 'prescriptions', entity_id: prescription.prescription_id },
    });
    ok(res, prescription);
  }),
);

export default router;
