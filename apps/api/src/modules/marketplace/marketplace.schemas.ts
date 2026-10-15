import { z } from 'zod';

export const listingCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  category_id: z.number().int().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair']).default('good'),
  asking_price: z.number().min(0),
  is_negotiable: z.boolean().default(true),
  location_city: z.string().max(100).optional(),
  location_state: z.string().max(100).optional(),
  media: z.array(z.string().uuid()).optional(),
  compliance_scan_id: z.string().uuid(),
});

export const listingUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  asking_price: z.number().min(0).optional(),
  is_negotiable: z.boolean().optional(),
  listing_status: z.enum(['active', 'sold', 'cancelled', 'under_review']).optional(),
  compliance_scan_id: z.string().uuid().optional(),
});

export const inquiryCreateSchema = z.object({
  message: z.string().min(1).max(2000),
});
