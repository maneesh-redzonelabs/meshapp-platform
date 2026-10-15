import type { otp_type_enum } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { generateNumericOtp, hashSecret, verifySecret } from '../../lib/crypto';
import { env } from '../../config/env';
import { ApiError } from '../../lib/apiError';
import { logger } from '../../lib/logger';

export interface IssuedOtp {
  otp_id: string;
  recipient: string;
  /** Only populated by the caller for inclusion in API responses when MOCK_OTP_EXPOSE is on. */
  plainCode: string;
}

/**
 * Mock OTP delivery: generates a real numeric code, Argon2-hashes it into
 * otp_verifications (never stored plaintext), and "sends" it by logging to
 * the server console. The plaintext code is returned to the caller so that,
 * gated by MOCK_OTP_EXPOSE, routes can surface it as data.debug_otp for
 * local dev/testing without a real SMS/email provider wired up.
 */
export async function issueOtp(params: {
  userId: string | null;
  otpType: otp_type_enum;
  recipient: string;
  ipAddress?: string;
}): Promise<IssuedOtp> {
  const code = generateNumericOtp(env.OTP_LENGTH);
  const otp_hash = await hashSecret(code);
  const expires_at = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);

  const row = await prisma.otp_verifications.create({
    data: {
      user_id: params.userId,
      otp_type: params.otpType,
      recipient: params.recipient,
      otp_hash,
      expires_at,
      max_attempts: env.OTP_MAX_ATTEMPTS,
      ip_address: params.ipAddress,
    },
  });

  // Mock delivery channel — replace with a real SMS/email provider call for production.
  logger.info(
    { recipient: params.recipient, otpType: params.otpType, otp_id: row.otp_id },
    `[MOCK OTP DELIVERY] code=${code} (would be sent via SMS/Email in production)`,
  );

  return { otp_id: row.otp_id, recipient: params.recipient, plainCode: code };
}

/**
 * Verifies the most recent unused, unexpired OTP of the given type+recipient.
 * Enforces max_attempts (incrementing on every wrong guess) and single-use
 * (is_used=true after a correct verification — replay protection).
 */
export async function verifyOtp(params: {
  otpType: otp_type_enum;
  recipient: string;
  code: string;
}): Promise<{ otp_id: string; user_id: string | null }> {
  const row = await prisma.otp_verifications.findFirst({
    where: { otp_type: params.otpType, recipient: params.recipient, is_used: false },
    orderBy: { created_at: 'desc' },
  });

  if (!row) throw ApiError.otpInvalid('No pending OTP found for this recipient — request a new one');
  if (row.expires_at < new Date()) throw ApiError.otpExpired();
  if (row.attempt_count >= row.max_attempts) {
    throw ApiError.otpInvalid('Maximum verification attempts exceeded — request a new OTP');
  }

  const valid = await verifySecret(row.otp_hash, params.code);
  if (!valid) {
    await prisma.otp_verifications.update({
      where: { otp_id: row.otp_id },
      data: { attempt_count: { increment: 1 } },
    });
    throw ApiError.otpInvalid();
  }

  await prisma.otp_verifications.update({
    where: { otp_id: row.otp_id },
    data: { is_used: true, verified_at: new Date() },
  });

  return { otp_id: row.otp_id, user_id: row.user_id };
}

export function debugOtpPayload(issued: IssuedOtp): { debug_otp: string } | Record<string, never> {
  return env.MOCK_OTP_EXPOSE ? { debug_otp: issued.plainCode } : {};
}
