import express from 'express';
import { getStripeSession, postStripeSession } from '../controllers/pagosController.js';
import { requireCustomer } from '../services/sessionService.js';

const router = express.Router();
router.use(requireCustomer);

/**
 * @route   POST /api/pagos/stripe/session
 * @desc    Crear o reutilizar la Checkout Session de Stripe de un pedido propio
 * @access  Cliente autenticado
 */
router.post('/stripe/session', postStripeSession);

/**
 * @route   GET /api/pagos/stripe/session/:sessionId
 * @desc    Estado local del pago de una sesión propia
 * @access  Cliente autenticado
 */
router.get('/stripe/session/:sessionId', getStripeSession);

export default router;
