import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';

const router = Router();

router.get(
  '/plans',
  asyncHandler(async (req, res) => {
    const userType = req.query.user_type as string | undefined;
    ok(res, await prisma.subscription_plans.findMany({ where: { is_active: true, user_type: userType as any } }));
  }),
);

router.post(
  '/',
  authenticate(),
  requireRole(['doctor']),
  validateBody(z.object({ plan_id: z.number().int() })),
  asyncHandler(async (req, res) => {
    const plan = await prisma.subscription_plans.findUnique({ where: { plan_id: req.body.plan_id } });
    if (!plan || !plan.is_active) throw ApiError.notFound('Plan not found');

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payments.create({
        data: { payer_id: req.authUser!.userId, payment_for: 'subscription', amount: plan.price, status: 'initiated' },
      });
      const subscription = await tx.user_subscriptions.create({
        data: {
          user_id: req.authUser!.userId,
          plan_id: plan.plan_id,
          started_at: new Date(),
          is_active: false, // flips true once payment confirms (see /payments/:id/confirm)
          payment_id: payment.payment_id,
        },
      });
      await tx.payments.update({ where: { payment_id: payment.payment_id }, data: { reference_id: subscription.subscription_id } });
      return { subscription, payment };
    });

    // Mock gateway order payload — a real integration returns e.g. a Razorpay order_id here.
    created(res, {
      subscription: result.subscription,
      payment_intent: { payment_id: result.payment.payment_id, amount: result.payment.amount, gateway_order_id: `mock_order_${result.payment.payment_id}` },
    });
  }),
);

router.get(
  '/me',
  authenticate(),
  asyncHandler(async (req, res) => {
    const sub = await prisma.user_subscriptions.findFirst({
      where: { user_id: req.authUser!.userId, is_active: true },
      orderBy: { started_at: 'desc' },
    });
    ok(res, sub);
  }),
);

router.patch(
  '/:subscription_id/cancel',
  authenticate(),
  asyncHandler(async (req, res) => {
    const sub = await prisma.user_subscriptions.findUnique({ where: { subscription_id: req.params.subscription_id } });
    if (!sub || sub.user_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.user_subscriptions.update({ where: { subscription_id: sub.subscription_id }, data: { auto_renew: false } });
    ok(res, row);
  }),
);

export default router;
