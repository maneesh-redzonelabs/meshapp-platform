import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { env } from '../../config/env';
import { createUploadTicket, getTicket, markUploaded } from './uploads.store';

const router = Router();

const presignSchema = z.object({
  purpose: z.string().min(1).max(100), // e.g. doctor_selfie | verification_document | post_media | listing_media
  mime_type: z.string().min(1).max(100),
});

router.post(
  '/presign',
  authenticate(),
  validateBody(presignSchema),
  asyncHandler(async (req, res) => {
    const ticket = createUploadTicket(req.authUser!.userId, req.body.purpose, req.body.mime_type);
    created(res, {
      upload_id: ticket.uploadId,
      upload_url: `${env.UPLOAD_BASE_URL}/_put/${ticket.uploadId}`,
      method: 'PUT',
      expires_in_seconds: 1800,
    });
  }),
);

// Local-disk substitute for an S3 presigned PUT target. Real deployments
// point this at S3 instead and never proxy raw bytes through the API process.
router.put(
  '/_put/:upload_id',
  authenticate(),
  asyncHandler(async (req, res) => {
    const ticket = getTicket(req.params.upload_id);
    if (!ticket || ticket.ownerUserId !== req.authUser!.userId) throw ApiError.notFound('Unknown or expired upload ticket');
    if (ticket.localPath) throw ApiError.conflict('Upload already completed for this ticket');

    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    await new Promise<void>((resolve, reject) => {
      req.on('end', () => resolve());
      req.on('error', reject);
    });
    const buf = Buffer.concat(chunks);
    if (buf.length === 0) throw ApiError.badRequest('Empty upload body');
    if (buf.length > 10 * 1024 * 1024) throw ApiError.badRequest('File exceeds 10MB limit');

    fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });
    const fullPath = path.join(env.UPLOADS_DIR, ticket.filename);
    fs.writeFileSync(fullPath, buf);
    markUploaded(ticket.uploadId, `${env.UPLOAD_BASE_URL}/${ticket.filename}`);

    ok(res, { upload_id: ticket.uploadId, uploaded: true });
  }),
);

export default router;
