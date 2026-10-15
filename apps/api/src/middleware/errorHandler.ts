import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/apiError';
import { logger } from '../lib/logger';
import type { ApiErrorBody } from '@meshapp/shared';

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    success: false,
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}`, request_id: req.requestId },
  };
  res.status(404).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let apiErr: ApiError;

  if (err instanceof ApiError) {
    apiErr = err;
  } else if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message;
    apiErr = ApiError.badRequest('Request validation failed', fields);
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      apiErr = ApiError.conflict('A record with the same unique value already exists');
    } else if (err.code === 'P2025') {
      apiErr = ApiError.notFound();
    } else if (err.code === 'P2003') {
      apiErr = ApiError.badRequest('Referenced record does not exist');
    } else {
      apiErr = ApiError.internal('Database error');
      logger.error({ err, code: err.code, requestId: req.requestId }, 'Prisma known request error');
    }
  } else {
    apiErr = ApiError.internal();
    logger.error({ err, requestId: req.requestId }, 'Unhandled error');
  }

  if (apiErr.status >= 500) {
    logger.error({ err, requestId: req.requestId }, apiErr.message);
  }

  const body: ApiErrorBody = {
    success: false,
    error: {
      code: apiErr.code,
      message: apiErr.message,
      fields: apiErr.fields,
      violations: apiErr.violations,
      request_id: req.requestId,
    },
  };
  res.status(apiErr.status).json(body);
}

/** Wraps an async route handler so rejected promises reach errorHandler. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
