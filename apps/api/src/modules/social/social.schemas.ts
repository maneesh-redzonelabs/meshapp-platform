import { z } from 'zod';

export const postCreateSchema = z.object({
  content: z.string().min(1).max(10000),
  visibility_scope: z.enum(['public', 'network_only', 'community_only', 'private']).default('public'),
  community_id: z.string().uuid().optional(),
  post_type: z.enum(['clinical_case', 'research', 'opinion', 'update', 'general']).default('general'),
  media: z.array(z.string().uuid()).optional(),
  compliance_scan_id: z.string().uuid(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1).max(3000),
  parent_comment_id: z.string().uuid().optional(),
});

export const networkRequestSchema = z.object({
  recipient_id: z.string().uuid(),
  connection_category: z.enum(['ug_batch', 'pg_batch', 'super_spec', 'teachers', 'juniors_seniors', 'coworkers', 'team', 'general']).default('general'),
});

export const communityCreateSchema = z.object({
  community_name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  speciality_id: z.number().int().optional(),
  is_public: z.boolean().default(true),
});
