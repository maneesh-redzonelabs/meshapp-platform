import { z } from 'zod';
import { GENDERS, RELATIONSHIPS } from '@meshapp/shared';

export const updatePatientSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  gender: z.enum(GENDERS).optional(),
  blood_group: z.string().max(5).optional(),
  profile_photo_url: z.string().max(500).optional(),
});

export const addressCreateSchema = z.object({
  locality: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pin_code: z.string().min(4).max(10),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_primary: z.boolean().optional(),
});

export const familyMemberCreateSchema = z.object({
  full_name: z.string().min(1).max(200),
  date_of_birth: z.string().date().optional(),
  age: z.number().int().min(0).max(130).optional(),
  gender: z.enum(GENDERS).optional(),
  relationship: z.enum(RELATIONSHIPS),
  relationship_other: z.string().max(100).optional(),
});
