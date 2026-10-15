import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/apiError';
import { env } from '../../config/env';

/**
 * Books an appointment inside a single DB transaction, using a Postgres
 * advisory lock scoped to (doctor_id, date, start_time) to serialize
 * concurrent booking attempts for the exact same slot — this is what
 * prevents the double-booking race the spec calls out ("re-validates slot
 * availability transactionally (SELECT...FOR UPDATE) to prevent double-
 * booking"). An advisory lock is used instead of a row lock because there
 * is no single row that represents "this slot" until the first appointment
 * exists; the lock key is deterministic so all concurrent requests for the
 * same slot serialize against each other and queue instead of racing.
 */
export async function bookAppointment(params: {
  patientId: string;
  doctorId: string;
  locationId?: string;
  familyMemberId?: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  appointmentType: 'in_person' | 'video_call';
  patientNotes?: string;
}) {
  const date = new Date(`${params.appointmentDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid appointment_date');
  const dayOfWeek = date.getUTCDay();
  const startTime = params.startTime.length === 5 ? `${params.startTime}:00` : params.startTime;

  if (params.familyMemberId) {
    const fm = await prisma.patient_family_members.findUnique({ where: { family_member_id: params.familyMemberId } });
    if (!fm || fm.patient_id !== params.patientId || !fm.is_active) {
      throw ApiError.badRequest('family_member_id does not belong to this patient');
    }
  }

  const doctor = await prisma.doctors.findUnique({ where: { doctor_id: params.doctorId } });
  if (!doctor || doctor.deleted_at) throw ApiError.notFound('Doctor not found');

  const location = params.locationId
    ? await prisma.doctor_clinic_locations.findFirst({ where: { location_id: params.locationId, doctor_id: params.doctorId, is_active: true } })
    : await prisma.doctor_clinic_locations.findFirst({ where: { doctor_id: params.doctorId, is_primary: true, is_active: true } });
  if (!location) throw ApiError.badRequest('No active clinic location found for this doctor');

  const slot = await prisma.doctor_availability_slots.findFirst({
    where: {
      doctor_id: params.doctorId,
      day_of_week: dayOfWeek,
      is_active: true,
      start_time: { lte: new Date(`1970-01-01T${startTime}Z`) },
      end_time: { gt: new Date(`1970-01-01T${startTime}Z`) },
    },
  });
  if (!slot) throw ApiError.slotUnavailable('Doctor has no availability template covering this time');
  if (slot.slot_type !== 'both' && slot.slot_type !== params.appointmentType) {
    throw ApiError.slotUnavailable(`Doctor does not offer ${params.appointmentType} appointments in this slot`);
  }

  const blocked = await prisma.doctor_blocked_dates.findMany({ where: { doctor_id: params.doctorId, blocked_date: date } });
  if (blocked.some((b) => b.blocked_type === 'full_day')) throw ApiError.slotUnavailable('Doctor is unavailable on this date');
  for (const b of blocked) {
    if (b.blocked_type === 'partial' && b.blocked_start && b.blocked_end) {
      const t = startTime;
      if (t >= b.blocked_start.toISOString().substring(11, 19) && t < b.blocked_end.toISOString().substring(11, 19)) {
        throw ApiError.slotUnavailable('This time is blocked by the doctor');
      }
    }
  }

  const consultationFee = Number(
    params.appointmentType === 'video_call' ? location.consultation_fee_video ?? 0 : location.consultation_fee_inperson ?? 0,
  );
  const platformServiceFee = env.PLATFORM_SERVICE_FEE;
  const totalAmount = consultationFee + platformServiceFee;

  // Deterministic lock key for (doctor, date, time) — serializes concurrent bookers of the same slot.
  const lockKeySource = `${params.doctorId}|${params.appointmentDate}|${startTime}`;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKeySource}, 0))`;

    const existingCount = await tx.appointments.count({
      where: {
        doctor_id: params.doctorId,
        appointment_date: date,
        start_time: new Date(`1970-01-01T${startTime}Z`),
        status: { in: ['requested', 'confirmed'] },
      },
    });
    if (existingCount >= slot.max_patients) {
      throw ApiError.slotUnavailable('This slot is already fully booked');
    }

    const payment = await tx.payments.create({
      data: {
        payer_id: params.patientId,
        payment_for: 'appointment',
        amount: totalAmount,
        status: 'initiated',
      },
    });

    const appointment = await tx.appointments.create({
      data: {
        patient_id: params.patientId,
        family_member_id: params.familyMemberId,
        doctor_id: params.doctorId,
        location_id: location.location_id,
        appointment_date: date,
        start_time: new Date(`1970-01-01T${startTime}Z`),
        appointment_type: params.appointmentType,
        status: 'requested',
        consultation_fee: consultationFee,
        platform_service_fee: platformServiceFee,
        total_amount: totalAmount,
        payment_status: 'pending',
        payment_id: payment.payment_id,
        patient_notes: params.patientNotes,
      },
    });

    await tx.payments.update({ where: { payment_id: payment.payment_id }, data: { reference_id: appointment.appointment_id } });

    return { appointment, payment };
  });

  return result;
}

export { Prisma };
