import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

/**
 * In-memory Idempotency-Key dedupe map (per spec: "required on all
 * payment-initiating and appointment-booking POSTs"). Keyed by the header
 * value + route + caller, so the same key reused on a different route/user
 * does not collide. A production build should move this to Redis so it
 * survives restarts and works across instances (documented in README).
 */
const store = new Map<string, CachedResponse>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
}

export function idempotencyKey() {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('Idempotency-Key');
    if (!key) {
      next();
      return;
    }
    sweep();
    const cacheKey = `${req.authUser?.userId ?? req.ip}:${req.method}:${req.path}:${key}`;
    const cached = store.get(cacheKey);
    if (cached) {
      res.status(cached.status).setHeader('Idempotent-Replayed', 'true').json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    (res as any).json = (body: unknown) => {
      if (res.statusCode < 500) {
        store.set(cacheKey, { status: res.statusCode, body, expiresAt: Date.now() + env.IDEMPOTENCY_TTL_MINUTES * 60_000 });
      }
      return originalJson(body);
    };
    next();
  };
}
