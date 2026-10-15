import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

async function main() {
  await prisma.$connect();
  logger.info('Connected to Postgres');

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`MeshApp API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    if (env.MOCK_OTP_EXPOSE) {
      logger.warn('MOCK_OTP_EXPOSE=true — OTP codes are being returned in API responses. DEV ONLY.');
    }
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(() => logger.info('HTTP server closed'));
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
