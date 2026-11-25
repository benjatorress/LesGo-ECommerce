import express from 'express';

const router = express.Router();

/**
 * @route   POST /api/webhooks/stripe
 * @desc    Eventos de Stripe. Se monta con `express.raw` en app.js porque la
 *          firma se calcula sobre el body crudo, no sobre JSON parseado.
 * @access  Público, autenticado por `stripe-signature`
 */
router.post('/', async (req, res) => {
  const { payments, paymentWebhooks } = req.app.locals;
  // Lanza 400 INVALID_SIGNATURE, 503 PAYMENTS_DISABLED o 503 WEBHOOK_NOT_CONFIGURED.
  const event = payments.constructEvent(req.body, req.get('stripe-signature'));
  await paymentWebhooks.handleEvent(event);
  // 200 aunque el evento se ignore: Stripe reintenta cualquier otro código.
  return res.json({ received: true });
});

export default router;
