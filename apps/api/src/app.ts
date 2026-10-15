import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import fs from 'node:fs';
import { env } from './config/env';
import { logger } from './lib/logger';
import { requestId } from './middleware/requestId';
import { defaultLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { ok } from './lib/response';

import authRoutes from './modules/auth/auth.routes';
import uploadsRoutes from './modules/uploads/uploads.routes';
import doctorsRoutes from './modules/doctors/doctors.routes';
import patientsRoutes from './modules/patients/patients.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import complianceRoutes, { adminComplianceRouter } from './modules/compliance/compliance.routes';
import socialRoutes from './modules/social/social.routes';
import marketplaceRoutes from './modules/marketplace/marketplace.routes';
import medicoLegalRoutes from './modules/medicoLegal/medicoLegal.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import supportRoutes from './modules/support/support.routes';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import adminRoutes from './modules/admin/admin.routes';
import searchRoutes from './modules/search/search.routes';
import webhooksRoutes from './modules/webhooks/webhooks.routes';
import { mrRouter, paramedicalRouter, supplierRouter } from './modules/otherRoles/otherRoles.routes';

export function createApp() {
  const app = express();

  fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as any).requestId,
      customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => req.url === '/v1/health' },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction ? undefined : false,
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // Webhooks need the raw body for signature verification in a real
  // integration; kept separate from the global json() parser's 1MB default.
  app.use('/v1/webhooks', express.json({ limit: '1mb' }), webhooksRoutes);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Local-disk substitute for S3-served static assets (selfies, verification
  // docs, post/listing media). A production build serves these from S3/CDN
  // instead of the API process.
  app.use('/uploads', express.static(env.UPLOADS_DIR, { maxAge: '1h' }));

  app.get('/v1/health', (_req, res) => {
    ok(res, { status: 'ok' });
  });

  app.use(defaultLimiter);

  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/uploads', uploadsRoutes);
  v1.use('/doctors', doctorsRoutes);
  v1.use('/patients', patientsRoutes);
  v1.use('/appointments', appointmentsRoutes);
  v1.use('/compliance', complianceRoutes);
  v1.use('/admin/compliance', adminComplianceRouter);
  v1.use('/', socialRoutes); // exposes /feed, /posts/*, /network/*, /communities/*
  v1.use('/market', marketplaceRoutes);
  v1.use('/medico-legal', medicoLegalRoutes);
  v1.use('/notifications', notificationsRoutes);
  v1.use('/support', supportRoutes);
  v1.use('/subscriptions', subscriptionsRoutes);
  v1.use('/payments', paymentsRoutes);
  v1.use('/admin', adminRoutes);
  v1.use('/search', searchRoutes);
  v1.use('/mr', mrRouter);
  v1.use('/paramedical', paramedicalRouter);
  v1.use('/suppliers', supplierRouter);

  app.use('/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
