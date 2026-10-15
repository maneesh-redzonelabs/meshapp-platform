import { z } from 'zod';
import { GENDERS } from '@meshapp/shared';

export const mobileNumberSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'mobile_number must be a valid 10-digit Indian mobile number');

export const emailSchema = z.string().email();

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol');

export const deviceTypeSchema = z.enum(['mobile_android', 'mobile_ios', 'web', 'tablet']).optional();

export const doctorRequestOtpSchema = z.object({
  mobile_number: mobileNumberSchema,
  email: emailSchema,
});

export const doctorVerifyMobileOtpSchema = z.object({
  mobile_number: mobileNumberSchema,
  otp: z.string().min(4).max(8),
});

export const doctorVerifyEmailOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().min(4).max(8),
});

export const educationInputSchema = z.object({
  education_level: z.enum(['graduation', 'post_graduation', 'super_speciality', 'fellowship', 'other']),
  degree_name: z.string().min(1).max(100),
  college_id: z.number().int().optional(),
  college_name_other: z.string().max(255).optional(),
  passing_year: z.number().int().min(1950).max(new Date().getFullYear() + 2),
});

export const doctorCompleteProfileSchema = z.object({
  registration_token: z.string(),
  full_name: z.string().min(2).max(200),
  speciality_id: z.number().int(),
  subspeciality_id: z.number().int(),
  education: z.array(educationInputSchema).min(1),
  clinic_location: z.object({
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
  }),
  selfie_upload_id: z.string().uuid().optional(),
  bio: z.string().max(2000).optional(),
  years_of_experience: z.number().int().min(0).max(80).optional(),
});

export const patientRequestOtpSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  date_of_birth: z.string().date().optional(),
  age: z.number().int().min(0).max(130).optional(),
  gender: z.enum(GENDERS).optional(),
  mobile_number: mobileNumberSchema,
  pin_code: z.string().min(4).max(10),
});

export const patientVerifyOtpSchema = z.object({
  mobile_number: mobileNumberSchema,
  otp: z.string().min(4).max(8),
});

export const loginRequestOtpSchema = z.object({
  mobile_number: mobileNumberSchema,
});

export const loginVerifyOtpSchema = z.object({
  mobile_number: mobileNumberSchema,
  otp: z.string().min(4).max(8),
  device_type: deviceTypeSchema,
  device_fingerprint: z.string().max(255).optional(),
});

export const loginPasswordSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
  device_type: deviceTypeSchema,
  device_fingerprint: z.string().max(255).optional(),
});

export const refreshSchema = z.object({
  refresh_token: z.string(),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3),
});

export const resetPasswordSchema = z.object({
  identifier: z.string().min(3),
  otp: z.string().min(4).max(8),
  new_password: passwordSchema,
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordSchema,
});
