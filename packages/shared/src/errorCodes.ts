/** Mirrors the Error Code Reference table in MeshApp-API-Specification.html */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  NOT_VERIFIED: 'NOT_VERIFIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  COMPLIANCE_BLOCKED: 'COMPLIANCE_BLOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    fields?: Record<string, string>;
    violations?: Array<{
      category: string;
      excerpt: string;
      severity: 'block' | 'warn';
      guidance: string;
    }>;
    request_id?: string;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  meta?: { request_id?: string; next_cursor?: string | null };
}

export type ApiResponse<T> = ApiSuccessBody<T> | ApiErrorBody;
