import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { ApiError } from '../lib/apiError';
import { prisma } from '../lib/prisma';
import { rolesForUser } from '../lib/rbac';

/**
 * Verifies the Bearer JWT, confirms the referenced session is still active
 * (not revoked/expired) — the in-process equivalent of the spec's Redis
 * session denylist check for mid-flight "force logout" — and attaches
 * req.authUser for downstream RBAC middleware.
 */
export function authenticate() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.header('Authorization');
      if (!header || !header.startsWith('Bearer ')) {
        throw ApiError.unauthenticated('Missing Authorization bearer token');
      }
      const token = header.slice('Bearer '.length).trim();

      let claims;
      try {
        claims = verifyAccessToken(token);
      } catch {
        throw ApiError.unauthenticated('Invalid or expired access token');
      }

      const session = await prisma.user_sessions.findUnique({ where: { session_id: claims.session_id } });
      if (!session || !session.is_active || session.revoked_at || session.expires_at < new Date()) {
        throw ApiError.unauthenticated('Session has been revoked or expired');
      }

      const user = await prisma.users.findUnique({ where: { user_id: claims.sub } });
      if (!user || !user.is_active || user.deleted_at) {
        throw ApiError.unauthenticated('Account is not active');
      }
      if (user.is_locked && (!user.locked_until || user.locked_until > new Date())) {
        throw ApiError.accountLocked(
          user.locked_until ? `Account locked until ${user.locked_until.toISOString()}` : 'Account locked',
        );
      }

      let subscriptionTier: 'free' | 'premium' | undefined;
      let adminRole: string | null = null;
      if (user.user_type === 'doctor') {
        const doctor = await prisma.doctors.findUnique({ where: { doctor_id: user.user_id } });
        subscriptionTier = (doctor?.subscription_tier as 'free' | 'premium') ?? 'free';
      } else if (user.user_type === 'admin') {
        const admin = await prisma.platform_admins.findUnique({ where: { admin_id: user.user_id } });
        adminRole = admin?.admin_role ?? null;
      }

      const roles = rolesForUser(user.user_type, { subscriptionTier, adminRole });

      req.authUser = {
        userId: user.user_id,
        userType: user.user_type,
        sessionId: session.session_id,
        roles,
      };

      // Best-effort "last active" bump; never block the request on it.
      prisma.user_sessions
        .update({ where: { session_id: session.session_id }, data: { last_active_at: new Date() } })
        .catch(() => undefined);

      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Optional authentication: attaches req.authUser if a valid token is present, but never rejects. */
export function authenticateOptional() {
  const required = authenticate();
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.header('Authorization')) return next();
    required(req, res, next);
  };
}
