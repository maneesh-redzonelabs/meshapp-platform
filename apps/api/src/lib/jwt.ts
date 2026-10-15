import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserType } from '@meshapp/shared';

export interface AccessTokenClaims {
  sub: string; // user_id
  user_type: UserType;
  session_id: string;
  roles: string[];
  type: 'access';
}

export interface RefreshTokenClaims {
  sub: string;
  session_id: string;
  token_id: string; // refresh_tokens.token_id — lets us rotate/revoke
  type: 'refresh';
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'type'>): string {
  return jwt.sign({ ...claims, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });
}

export function signRefreshToken(claims: Omit<RefreshTokenClaims, 'type'>): string {
  return jwt.sign({ ...claims, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
  if (decoded.type !== 'access') throw new Error('Not an access token');
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenClaims;
  if (decoded.type !== 'refresh') throw new Error('Not a refresh token');
  return decoded;
}

export interface RegistrationTokenClaims {
  sub: string; // user_id of the pending (not-yet-complete) doctor account
  type: 'registration';
}

/** Short-lived (15 min) token proving both mobile+email OTPs were verified, per spec step 3→4. */
export function signRegistrationToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'registration' }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyRegistrationToken(token: string): RegistrationTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as RegistrationTokenClaims;
  if (decoded.type !== 'registration') throw new Error('Not a registration token');
  return decoded;
}
