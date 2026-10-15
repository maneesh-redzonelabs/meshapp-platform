import rateLimit, { type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env';
import { ApiError } from '../lib/apiError';

/**
 * In-memory rate limiting (express-rate-limit's default store). Fine for a
 * single-process local dev build; production should swap in a Redis store
 * (see README) so limits are shared across horizontally scaled instances.
 *
 * Limits below follow the spec's §Rate Limits table, scaled down for local
 * testing via env vars where noted.
 */
function handler(req: Request): never {
  throw ApiError.rateLimited(`Too many requests to ${req.path}. Please try again later.`);
}

function make(opts: Partial<Options> & { windowMs: number; max: number }) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req) => handler(req),
    ...opts,
  });
}

// Per-IP, OTP request endpoints: spec = 3/hour. Kept as-is; it's already low.
export const otpRequestLimiter = make({ windowMs: 60 * 60 * 1000, max: 3 });

// Per-IP, all /auth/*: spec = 30 / 15 min.
export const authLimiter = make({ windowMs: 15 * 60 * 1000, max: 30 });

// Per-account/IP, POST /appointments: spec = 10/min.
export const appointmentCreateLimiter = make({ windowMs: 60 * 1000, max: 10 });

// Per-account/IP, POST /posts and /comments: spec = 20/min.
export const postCreateLimiter = make({ windowMs: 60 * 1000, max: 20 });

// Default catch-all: spec = 300/min per IP (env-tunable for local dev).
export const defaultLimiter = make({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX_DEFAULT });
