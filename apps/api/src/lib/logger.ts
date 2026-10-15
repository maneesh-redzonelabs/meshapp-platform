import pino from 'pino';
import { env } from '../config/env';

// Redact anything that could leak secrets or PHI into logs.
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.otp',
      '*.otp_hash',
      '*.token',
      '*.access_token',
      '*.refresh_token',
      'env.DATABASE_URL',
      'env.JWT_ACCESS_SECRET',
      'env.JWT_REFRESH_SECRET',
    ],
    censor: '[REDACTED]',
  },
  transport: env.isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
});
