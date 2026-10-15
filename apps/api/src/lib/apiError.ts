import type { ErrorCode } from '@meshapp/shared';

export interface ComplianceViolationShape {
  category: string;
  excerpt: string;
  severity: 'block' | 'warn';
  guidance: string;
}

/**
 * Thrown anywhere in route/service code; caught by the global error handler
 * in src/middleware/errorHandler.ts and rendered into the standard
 * { success:false, error:{...} } envelope from @meshapp/shared.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode | string;
  public readonly fields?: Record<string, string>;
  public readonly violations?: ComplianceViolationShape[];

  constructor(
    status: number,
    code: ErrorCode | string,
    message: string,
    opts?: { fields?: Record<string, string>; violations?: ComplianceViolationShape[] },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = opts?.fields;
    this.violations = opts?.violations;
  }

  static badRequest(message: string, fields?: Record<string, string>) {
    return new ApiError(400, 'VALIDATION_ERROR', message, { fields });
  }
  static unauthenticated(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message = 'Conflicting state') {
    return new ApiError(409, 'CONFLICT', message);
  }
  static slotUnavailable(message = 'The requested slot is no longer available') {
    return new ApiError(409, 'SLOT_UNAVAILABLE', message);
  }
  static businessRule(message: string) {
    return new ApiError(422, 'BUSINESS_RULE_VIOLATION', message);
  }
  static complianceBlocked(message: string, violations: ComplianceViolationShape[]) {
    return new ApiError(422, 'COMPLIANCE_BLOCKED', message, { violations });
  }
  static accountLocked(message = 'Account is temporarily locked') {
    return new ApiError(423, 'ACCOUNT_LOCKED', message);
  }
  static notVerified(message = 'Account/document verification is required for this action') {
    return new ApiError(403, 'NOT_VERIFIED', message);
  }
  static otpInvalid(message = 'Invalid OTP') {
    return new ApiError(400, 'OTP_INVALID', message);
  }
  static otpExpired(message = 'OTP has expired') {
    return new ApiError(400, 'OTP_EXPIRED', message);
  }
  static rateLimited(message = 'Too many requests') {
    return new ApiError(429, 'RATE_LIMITED', message);
  }
  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
