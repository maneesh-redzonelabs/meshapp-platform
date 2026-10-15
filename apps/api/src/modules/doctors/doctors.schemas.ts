import { z } from 'zod';

export const updateDoctorProfileSchema = z.object({
  bio: z.string().max(2000).optional(),
  backdrop_image_url: z.string().max(500).optional(),
  years_of_experience: z.number().int().min(0).max(80).optional(),
  speciality_id: z.number().int().optional(),
  subspeciality_id: z.number().int().optional(),
});

export const selfieSchema = z.object({ upload_id: z.string().uuid() });

export const educationCreateSchema = z.object({
  education_level: z.enum(['graduation', 'post_graduation', 'super_speciality', 'fellowship', 'other']),
  degree_name: z.string().min(1).max(100),
  college_id: z.number().int().optional(),
  college_name_other: z.string().max(255).optional(),
  passing_year: z.number().int().min(1950).max(new Date().getFullYear() + 2),
});

export const affiliationCreateSchema = z.object({
  job_title: z.string().min(1).max(200),
  hospital_name: z.string().min(1).max(255),
  from_year: z.number().int().min(1950).max(new Date().getFullYear() + 2),
  to_year: z.number().int().min(1950).max(new Date().getFullYear() + 2).optional(),
  is_current: z.boolean().optional(),
});

export const achievementCreateSchema = z.object({
  achievement_text: z.string().min(1).max(5000),
  achievement_year: z.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  awarding_body: z.string().max(255).optional(),
  compliance_scan_id: z.string().uuid(),
});

export const publicationCreateSchema = z.object({
  title: z.string().min(1).max(1000),
  journal_name: z.string().max(255).optional(),
  publication_year: z.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  pubmed_id: z.string().max(50).optional(),
  doi: z.string().max(255).optional(),
  publication_url: z.string().max(500).optional(),
  compliance_scan_id: z.string().uuid(),
});

export const locationCreateSchema = z.object({
  clinic_hospital_name: z.string().min(1).max(255),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pin_code: z.string().max(10).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  consultation_fee_inperson: z.number().min(0).optional(),
  consultation_fee_video: z.number().min(0).optional(),
  is_primary: z.boolean().optional(),
});

export const availabilitySlotSchema = z
  .object({
    location_id: z.string().uuid().optional(),
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    slot_duration_minutes: z.number().int().positive().default(30),
    max_patients: z.number().int().positive().default(1),
    slot_type: z.enum(['in_person', 'video_call', 'both']).default('both'),
  })
  .refine((v) => v.end_time > v.start_time, { message: 'end_time must be after start_time' });

export const blockedDateSchema = z.object({
  blocked_date: z.string().date(),
  blocked_type: z.enum(['full_day', 'partial']).default('full_day'),
  blocked_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  blocked_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  reason: z.string().max(255).optional(),
});

export const verificationDocumentSchema = z.object({
  document_type: z.enum(['degree_certificate', 'nmc_registration', 'state_registration', 'govt_photo_id', 'other']),
  nmc_registration_no: z.string().max(100).optional(),
  upload_id: z.string().uuid(),
});

export const searchDoctorsQuerySchema = z.object({
  speciality_id: z.coerce.number().int().optional(),
  subspeciality_id: z.coerce.number().int().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius_km: z.coerce.number().positive().max(100).default(5),
  limit: z.coerce.number().int().positive().max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
