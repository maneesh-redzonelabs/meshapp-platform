import type { Response } from 'express';
import type { ApiSuccessBody } from '@meshapp/shared';

export function ok<T>(res: Response, data: T, meta?: ApiSuccessBody<T>['meta'], status = 200): void {
  const requestId = (res.req as any)?.requestId as string | undefined;
  const body: ApiSuccessBody<T> = {
    success: true,
    data,
    meta: { request_id: requestId, ...meta },
  };
  res.status(status).json(body);
}

export function created<T>(res: Response, data: T, meta?: ApiSuccessBody<T>['meta']): void {
  ok(res, data, meta, 201);
}
