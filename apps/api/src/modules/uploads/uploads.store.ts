import { randomUUID } from 'node:crypto';

/**
 * Simple local-disk "presign" substitute for S3 (per task brief: dev build
 * stores uploads under apps/api/uploads/ instead of S3). A presign call
 * returns a one-time upload token + a local URL the client PUTs bytes to;
 * uploads.routes.ts receives that PUT, writes the file, and marks the token
 * consumed. Downstream consumers (doctor selfie, verification docs, post
 * media, listing media) reference the upload by upload_id exactly once.
 *
 * In-memory is sufficient for this single-process dev build; swap for a
 * real S3 presigned POST/PUT flow in production (see README).
 */
interface UploadTicket {
  uploadId: string;
  purpose: string;
  mimeType: string;
  ownerUserId: string;
  filename: string;
  localPath: string | null; // populated once the PUT completes
  consumed: boolean;
  createdAt: number;
}

const tickets = new Map<string, UploadTicket>();
const TTL_MS = 30 * 60 * 1000;

export function createUploadTicket(ownerUserId: string, purpose: string, mimeType: string): UploadTicket {
  const uploadId = randomUUID();
  const ext = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
  const filename = `${uploadId}.${ext}`;
  const ticket: UploadTicket = { uploadId, purpose, mimeType, ownerUserId, filename, localPath: null, consumed: false, createdAt: Date.now() };
  tickets.set(uploadId, ticket);
  return ticket;
}

export function getTicket(uploadId: string): UploadTicket | undefined {
  const t = tickets.get(uploadId);
  if (t && Date.now() - t.createdAt > TTL_MS && !t.localPath) {
    tickets.delete(uploadId);
    return undefined;
  }
  return t;
}

export function markUploaded(uploadId: string, localPath: string): void {
  const t = tickets.get(uploadId);
  if (t) t.localPath = localPath;
}

/** Consumes (marks used) an upload and returns its local path, or null if invalid/already consumed. */
export function consumeUpload(uploadId: string, ownerUserId: string): string | null {
  const t = tickets.get(uploadId);
  if (!t || !t.localPath || t.consumed || t.ownerUserId !== ownerUserId) return null;
  t.consumed = true;
  return t.localPath;
}

export type { UploadTicket };
