import { randomUUID } from 'node:crypto';
import type { UserType } from '@meshapp/shared';
import { prisma } from '../../lib/prisma';
import { sha256, randomToken } from '../../lib/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { rolesForUser } from '../../lib/rbac';
import { env } from '../../config/env';
import { ApiError } from '../../lib/apiError';
import { logger } from '../../lib/logger';

export interface DeviceInfo {
  deviceType?: string;
  deviceFingerprint?: string;
  ipAddress: string;
  userAgent?: string;
}

async function rolesForUserId(userId: string, userType: UserType) {
  let subscriptionTier: 'free' | 'premium' | undefined;
  let adminRole: string | null = null;
  if (userType === 'doctor') {
    const doctor = await prisma.doctors.findUnique({ where: { doctor_id: userId } });
    subscriptionTier = (doctor?.subscription_tier as 'free' | 'premium') ?? 'free';
  } else if (userType === 'admin') {
    const admin = await prisma.platform_admins.findUnique({ where: { admin_id: userId } });
    adminRole = admin?.admin_role ?? null;
  }
  return rolesForUser(userType, { subscriptionTier, adminRole });
}

/** Creates a session + token pair for a freshly authenticated user (OTP or password login). */
export async function createSession(userId: string, userType: UserType, device: DeviceInfo) {
  const roles = await rolesForUserId(userId, userType);

  // Create the session row first with a placeholder token hash, then issue the
  // JWT (which embeds session_id), then store its hash — avoids a chicken/egg
  // dependency between the JWT claims and the row's primary key.
  const session = await prisma.user_sessions.create({
    data: {
      user_id: userId,
      session_token_hash: randomToken(16), // temporary placeholder, overwritten below
      device_type: device.deviceType,
      device_fingerprint: device.deviceFingerprint,
      ip_address: device.ipAddress,
      user_agent: device.userAgent,
      expires_at: new Date(Date.now() + env.JWT_ACCESS_TTL_SECONDS * 1000),
    },
  });

  const accessToken = signAccessToken({ sub: userId, user_type: userType, session_id: session.session_id, roles });
  await prisma.user_sessions.update({
    where: { session_id: session.session_id },
    data: { session_token_hash: sha256(accessToken) },
  });

  const refreshTokenRow = await prisma.refresh_tokens.create({
    data: {
      user_id: userId,
      token_hash: 'pending',
      device_id: device.deviceFingerprint,
      expires_at: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  const refreshToken = signRefreshToken({ sub: userId, session_id: session.session_id, token_id: refreshTokenRow.token_id });
  await prisma.refresh_tokens.update({ where: { token_id: refreshTokenRow.token_id }, data: { token_hash: sha256(refreshToken) } });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: env.JWT_ACCESS_TTL_SECONDS,
    session_id: session.session_id,
  };
}

/**
 * Refresh-token rotation with reuse detection: the presented token must
 * match the *current* stored hash for its token_id and must not already be
 * revoked. If a revoked token is replayed, it means a copy was stolen and
 * already used (or this is a double-submit) — per spec, this revokes the
 * entire session family for that user as a precaution.
 */
export async function rotateRefreshToken(rawToken: string, device: DeviceInfo) {
  let claims;
  try {
    claims = verifyRefreshToken(rawToken);
  } catch {
    throw ApiError.unauthenticated('Invalid or expired refresh token');
  }

  const row = await prisma.refresh_tokens.findUnique({ where: { token_id: claims.token_id } });
  if (!row) throw ApiError.unauthenticated('Unknown refresh token');

  if (row.is_revoked || row.token_hash !== sha256(rawToken)) {
    logger.warn({ userId: row.user_id, tokenId: row.token_id }, 'Refresh token reuse detected — revoking all sessions');
    await prisma.$transaction([
      prisma.refresh_tokens.updateMany({ where: { user_id: row.user_id }, data: { is_revoked: true } }),
      prisma.user_sessions.updateMany({
        where: { user_id: row.user_id, is_active: true },
        data: { is_active: false, revoked_at: new Date(), revocation_reason: 'suspicious_activity' },
      }),
    ]);
    throw ApiError.unauthenticated('Refresh token reuse detected — all sessions revoked for safety');
  }

  if (row.expires_at < new Date()) throw ApiError.unauthenticated('Refresh token expired');

  const session = await prisma.user_sessions.findUnique({ where: { session_id: claims.session_id } });
  if (!session || !session.is_active) throw ApiError.unauthenticated('Session no longer active');

  const user = await prisma.users.findUnique({ where: { user_id: row.user_id } });
  if (!user || !user.is_active || user.deleted_at) throw ApiError.unauthenticated('Account not active');

  const roles = await rolesForUserId(user.user_id, user.user_type);

  // Rotate: revoke old refresh token, issue new one + new access token, same session_id.
  await prisma.refresh_tokens.update({ where: { token_id: row.token_id }, data: { is_revoked: true, last_used_at: new Date() } });

  const newAccessToken = signAccessToken({ sub: user.user_id, user_type: user.user_type, session_id: session.session_id, roles });
  await prisma.user_sessions.update({
    where: { session_id: session.session_id },
    data: {
      session_token_hash: sha256(newAccessToken),
      expires_at: new Date(Date.now() + env.JWT_ACCESS_TTL_SECONDS * 1000),
      last_active_at: new Date(),
      ip_address: device.ipAddress,
    },
  });

  const newRefreshRow = await prisma.refresh_tokens.create({
    data: {
      user_id: user.user_id,
      token_hash: 'pending',
      device_id: device.deviceFingerprint ?? row.device_id,
      expires_at: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  const newRefreshToken = signRefreshToken({ sub: user.user_id, session_id: session.session_id, token_id: newRefreshRow.token_id });
  await prisma.refresh_tokens.update({ where: { token_id: newRefreshRow.token_id }, data: { token_hash: sha256(newRefreshToken) } });

  return { access_token: newAccessToken, refresh_token: newRefreshToken, expires_in: env.JWT_ACCESS_TTL_SECONDS };
}

/**
 * Revokes a single session. Access tokens for this session are rejected
 * immediately by authenticate() (it checks user_sessions.is_active), and any
 * refresh token tied to it is rejected by rotateRefreshToken()'s own active
 * session check — so marking the session row inactive is sufficient without
 * needing a session_id column on refresh_tokens.
 */
export async function revokeSession(sessionId: string, reason: 'logout' | 'forced_admin' | 'password_change' | 'suspicious_activity') {
  await prisma.user_sessions.update({
    where: { session_id: sessionId },
    data: { is_active: false, revoked_at: new Date(), revocation_reason: reason },
  });
}

export async function revokeAllSessions(userId: string, reason: 'logout' | 'forced_admin' | 'password_change' | 'suspicious_activity') {
  await prisma.$transaction([
    prisma.user_sessions.updateMany({
      where: { user_id: userId, is_active: true },
      data: { is_active: false, revoked_at: new Date(), revocation_reason: reason },
    }),
    prisma.refresh_tokens.updateMany({ where: { user_id: userId, is_revoked: false }, data: { is_revoked: true } }),
  ]);
}

export { randomUUID };
