import { z } from 'zod';

export const createAppointmentSchema = z.object({
  doctor_id: z.string().uuid(),
  location_id: z.string().uuid().optional(),
  family_member_id: z.string().uuid().optional(),
  appointment_date: z.string().date(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  appointment_type: z.enum(['in_person', 'video_call']),
  patient_notes: z.string().max(2000).optional(),
});

export const cancelAppointmentSchema = z.object({
  cancellation_reason: z.string().max(1000).optional(),
});

export const rescheduleAppointmentSchema = z.object({
  appointment_date: z.string().date(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

export const prescriptionCreateSchema = z.object({
  diagnosis: z.string().max(5000).optional(),
  medications: z
    .array(
      z.object({
        name: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        duration: z.string().min(1),
        route: z.string().optional(),
      }),
    )
    .optional(),
  advice: z.string().max(5000).optional(),
  follow_up_date: z.string().date().optional(),
});
