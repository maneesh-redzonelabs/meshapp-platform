import 'dotenv/config';
import path from 'node:path';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${name} must be a number`);
  return n;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isDevelopment = NODE_ENV === 'development';

// Safety: MOCK_OTP_EXPOSE may only ever be true in local development.
const mockOtpExposeRaw = bool('MOCK_OTP_EXPOSE', false);
const MOCK_OTP_EXPOSE = isDevelopment && mockOtpExposeRaw;

export const env = {
  NODE_ENV,
  isDevelopment,
  isProduction: NODE_ENV === 'production',
  PORT: int('PORT', 4000),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',

  DATABASE_URL: required('DATABASE_URL'),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL_SECONDS: int('JWT_ACCESS_TTL_SECONDS', 3600),
  JWT_REFRESH_TTL_DAYS: int('JWT_REFRESH_TTL_DAYS', 30),

  MOCK_OTP_EXPOSE,
  OTP_LENGTH: int('OTP_LENGTH', 4),
  OTP_TTL_MINUTES: int('OTP_TTL_MINUTES', 10),
  OTP_MAX_ATTEMPTS: int('OTP_MAX_ATTEMPTS', 3),

  UPLOADS_DIR: path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? './uploads'),
  UPLOAD_BASE_URL: process.env.UPLOAD_BASE_URL ?? 'http://localhost:4000/uploads',

  RATE_LIMIT_WINDOW_MS: int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  RATE_LIMIT_MAX_DEFAULT: int('RATE_LIMIT_MAX_DEFAULT', 300),

  IDEMPOTENCY_TTL_MINUTES: int('IDEMPOTENCY_TTL_MINUTES', 60),

  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),

  // Flat platform service fee added to every appointment booking, mirroring
  // the ₹49 flat fee hardcoded in the doctor-patient-v-1.0.html prototype's
  // booking flow (patientBookingDraft.serviceFee).
  PLATFORM_SERVICE_FEE: int('PLATFORM_SERVICE_FEE', 49),
};

if (!env.isDevelopment && mockOtpExposeRaw) {
  // eslint-disable-next-line no-console
  console.warn(
    '[SECURITY] MOCK_OTP_EXPOSE=true was set but NODE_ENV is not "development" — ignoring it. ' +
      'Plaintext OTPs will NOT be exposed in API responses.',
  );
}
