import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { idempotencyKey } from '../../middleware/idempotency';
import { ok } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';

const router = Router();

/**
 * Mock payment gateway: confirm always succeeds immediately — no real
 * Razorpay/Stripe/PayU call. A production build replaces this body with a
 * server-side HMAC signature verification against the gateway's response
 * before trusting success (never trust client-reported success alone), and
 * additionally handles the gateway's signed webhook as an idempotent
 * alternate path to the same state transition (see README "Mock vs real").
 */
router.post(
  '/:payment_id/confirm',
  authenticate(),
  idempotencyKey(),
  validateBody(z.object({ gateway_payment_id: z.string().optional(), gateway_signature: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payments.findUnique({ where: { payment_id: req.params.payment_id } });
    if (!payment || payment.payer_id !== req.authUser!.userId) throw ApiError.notFound();
    if (payment.status === 'success') {
      ok(res, payment); // idempotent replay
      return;
    }
    if (payment.status === 'refunded' || payment.status === 'failed') {
      throw ApiError.businessRule(`Payment is already in terminal state ${payment.status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payments.update({
        where: { payment_id: payment.payment_id },
        data: {
          status: 'success',
          gateway_name: 'mock_gateway',
          gateway_transaction_id: req.body.gateway_payment_id ?? `mock_txn_${randomUUID()}`,
          completed_at: new Date(),
        },
      });

      if (payment.payment_for === 'appointment' && payment.reference_id) {
        await tx.appointments.updateMany({ where: { appointment_id: payment.reference_id }, data: { payment_status: 'paid' } });
      } else if (payment.payment_for === 'subscription' && payment.reference_id) {
        await tx.user_subscriptions.updateMany({ where: { subscription_id: payment.reference_id }, data: { is_active: true } });
        const sub = await tx.user_subscriptions.findUnique({ where: { subscription_id: payment.reference_id } });
        if (sub) {
          const plan = await tx.subscription_plans.findUnique({ where: { plan_id: sub.plan_id } });
          if (plan?.tier === 'premium') {
            await tx.doctors.updateMany({ where: { doctor_id: sub.user_id }, data: { subscription_tier: 'premium' } });
          }
        }
      }
      return p;
    });

    ok(res, updated);
  }),
);

router.get(
  '/',
  authenticate(),
  asyncHandler(async (req, res) => {
    const rows = await prisma.payments.findMany({ where: { payer_id: req.authUser!.userId }, orderBy: { initiated_at: 'desc' } });
    ok(res, rows);
  }),
);

router.post(
  '/:payment_id/refund',
  authenticate(),
  requirePermission('user:lock'), // admin-only action; reuses an existing admin permission bucket
  validateBody(z.object({ refund_amount: z.number().min(0), reason: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payments.findUnique({ where: { payment_id: req.params.payment_id } });
    if (!payment) throw ApiError.notFound();
    const row = await prisma.payments.update({
      where: { payment_id: payment.payment_id },
      data: { status: 'refunded', refund_amount: req.body.refund_amount, refunded_at: new Date(), failure_reason: req.body.reason },
    });
    ok(res, row);
  }),
);

export default router;
