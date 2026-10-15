import argon2 from 'argon2';
import crypto from 'node:crypto';

export async function hashSecret(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifySecret(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** SHA-256 hex digest — used for session/refresh token storage (never store raw tokens). */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Generates a random numeric OTP of the given length (not cryptographically "guessable" at scale: throttled by attempt limits). */
export function generateNumericOtp(length: number): string {
  const digits = '0123456789';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += digits[bytes[i] % 10];
  }
  return out;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
