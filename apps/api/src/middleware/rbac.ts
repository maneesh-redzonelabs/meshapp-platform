import type { Request, Response, NextFunction } from 'express';
import type { UserType } from '@meshapp/shared';
import { ApiError } from '../lib/apiError';
import { roleHasPermission } from '../lib/rbac';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export function requireRole(allowed: UserType[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) return next(ApiError.unauthenticated());
    if (!allowed.includes(req.authUser.userType)) {
      return next(ApiError.forbidden(`This action requires one of: ${allowed.join(', ')}`));
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) return next(ApiError.unauthenticated());
    if (!roleHasPermission(req.authUser.roles, permission)) {
      return next(ApiError.forbidden(`Missing permission: ${permission}`));
    }
    next();
  };
}

/**
 * Defense-in-depth ownership check: re-verifies, at the application tier,
 * that the authenticated user owns/was assigned the resource identified by
 * req.params[paramIdField] — independent of (and never relying solely on)
 * Postgres RLS, per the spec's security architecture section.
 *
 * `resourceLookup` loads the minimal ownership-relevant columns for the
 * resource and returns the owning user id(s); request is rejected with 404
 * (never 403, to avoid confirming the resource's existence to a non-owner)
 * unless the caller is also a super_admin.
 */
export function requireOwnership(resourceLookup: (req: Request) => Promise<string[] | null>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) throw ApiError.unauthenticated();
      if (req.authUser.roles.includes('super_admin')) return next();

      const owners = await resourceLookup(req);
      if (!owners) throw ApiError.notFound();
      if (!owners.includes(req.authUser.userId)) throw ApiError.notFound();
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Fires after the route handler completes successfully. Writes an immutable
 * row to user_audit_log. Runs fire-and-forget so it never blocks/slows the
 * response (the spec calls for a queue; a direct best-effort insert is the
 * pragmatic equivalent for this single-process dev build).
 */
export function auditLog(action: string, entityType?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const entityId = (res.locals as any).auditEntityId ?? req.params.id ?? null;
      prisma.user_audit_log
        .create({
          data: {
            user_id: req.authUser?.userId ?? null,
            action,
            entity_type: entityType ?? null,
            entity_id: entityId,
            new_values: (res.locals as any).auditNewValues ?? undefined,
            ip_address: req.ip,
            user_agent: req.header('user-agent') ?? null,
          },
        })
        .catch((err) => logger.warn({ err }, 'audit log write failed'));
    });
    next();
  };
}
