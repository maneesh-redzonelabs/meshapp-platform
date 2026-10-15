import { Router } from 'express';
import { ok } from '../../lib/response';
import { logger } from '../../lib/logger';

/**
 * Stub webhook receivers. Real gateways (Razorpay/Stripe/PayU, Twilio/Agora)
 * sign their payloads; a production build must verify that signature
 * against the RAW request body before trusting it and apply replay
 * protection (timestamp tolerance + nonce cache) — see README. Since this
 * dev build uses a mock payment gateway and a stub video provider (no real
 * external services to call us back), these endpoints simply accept and log
 * the payload so the route shape matches the spec.
 */
const router = Router();

router.post('/payments/:gateway', (req, res) => {
  logger.info({ gateway: req.params.gateway, body: req.body }, '[MOCK WEBHOOK] payment gateway event received (not signature-verified in dev build)');
  ok(res, { received: true });
});

router.post('/video/:provider', (req, res) => {
  logger.info({ provider: req.params.provider, body: req.body }, '[MOCK WEBHOOK] video provider event received (not signature-verified in dev build)');
  ok(res, { received: true });
});

export default router;
