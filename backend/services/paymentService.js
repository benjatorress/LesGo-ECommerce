import Stripe from 'stripe';
import { AppError } from '../lib/errors.js';

// Monedas sin decimales. Hoy sólo se usa CLP; la lista queda explícita para no
// repetir el error de multiplicar por 100 una moneda de cero decimales.
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'
]);

// Stripe rechaza product_data.name de más de 250 caracteres.
const PRODUCT_NAME_MAX = 250;
// Las Checkout Sessions viven 30 minutos por defecto.
const CHECKOUT_TTL_MS = 30 * 60 * 1000;

/** Firma que acepta el modo `fake` para que los tests no necesiten red ni secretos. */
export const FAKE_SIGNATURE = 'fake-signature';

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, '');
}

function invalidAmount() {
  return new AppError(422, 'INVALID_PAYMENT_AMOUNT', 'Monto de pago inválido.');
}

/**
 * Convierte un monto en pesos/unidades a la representación de Stripe.
 * CLP es de cero decimales: se redondea, nunca se multiplica por 100.
 */
export function toStripeAmount(total, currency = 'clp') {
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw invalidAmount();
  }
  const code = String(currency).toLowerCase();
  const value = ZERO_DECIMAL.has(code) ? Math.round(amount) : Math.round(amount * 100);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalidAmount();
  }
  return { amount: value, currency: code };
}

/**
 * Construye los `line_items` del Checkout. Stripe debe cobrar exactamente el
 * total del pedido: si las líneas no suman ese total (redondeo de CLP, línea
 * inválida, sin líneas), se envía una sola línea con el monto exacto.
 */
export function buildLineItems({ idPedido, lineas, monto, currency = 'clp' }) {
  const total = toStripeAmount(monto, currency);
  const items = [];
  let sum = 0;
  let valid = true;

  for (const linea of Array.isArray(lineas) ? lineas : []) {
    const cantidad = Number(linea?.cantidad);
    const nombre = typeof linea?.nombre === 'string' ? linea.nombre.trim() : '';
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0 || !nombre) {
      valid = false;
      break;
    }
    let unitAmount;
    try {
      unitAmount = toStripeAmount(linea?.precio_unitario, total.currency).amount;
    } catch {
      valid = false;
      break;
    }
    const subtotal = unitAmount * cantidad;
    if (!Number.isSafeInteger(subtotal)) {
      valid = false;
      break;
    }
    sum += subtotal;
    items.push({
      quantity: cantidad,
      price_data: {
        currency: total.currency,
        unit_amount: unitAmount,
        product_data: { name: nombre.slice(0, PRODUCT_NAME_MAX) }
      }
    });
  }

  if (!valid || items.length === 0 || sum !== total.amount) {
    return [{
      quantity: 1,
      price_data: {
        currency: total.currency,
        unit_amount: total.amount,
        product_data: { name: `Pedido #${idPedido}` }
      }
    }];
  }
  return items;
}

function fakeConstructEvent(rawBody, signature) {
  if (!signature) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Falta la firma de Stripe.');
  }
  if (signature !== FAKE_SIGNATURE) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Firma de Stripe inválida.');
  }
  try {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    const event = JSON.parse(text);
    if (!event || typeof event !== 'object') {
      throw new Error('evento inválido');
    }
    return event;
  } catch {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Firma de Stripe inválida.');
  }
}

/**
 * Gateway de pagos con el mismo patrón de modos que `inventoryService` y
 * `crmService`: `disabled` (default, sin credenciales), `stripe` (SDK real) y
 * `fake` (tests sin red). `stripeImpl` permite inyectar un doble en tests.
 */
export function createStripeGateway(env = process.env, stripeImpl = null) {
  const mode = env.PAYMENT_MODE || 'disabled';
  if (!['disabled', 'stripe', 'fake'].includes(mode)) {
    throw new Error('PAYMENT_MODE inválido');
  }
  if (mode === 'stripe' && !env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe requiere STRIPE_SECRET_KEY');
  }

  const stripe = stripeImpl || (mode === 'stripe' ? new Stripe(env.STRIPE_SECRET_KEY) : null);
  const defaultCurrency = env.STRIPE_CURRENCY || 'clp';
  const appBaseUrl = trimTrailingSlash(env.APP_BASE_URL || 'http://localhost:5173');
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  return {
    mode,

    async createCheckoutSession(input = {}) {
      if (mode === 'disabled' || (mode === 'stripe' && !stripe)) {
        throw new AppError(503, 'PAYMENTS_DISABLED', 'Pagos deshabilitados.');
      }

      const idPedido = input.idPedido;
      const currency = input.currency || defaultCurrency;
      const total = toStripeAmount(input.monto, currency);
      const base = trimTrailingSlash(input.appBaseUrl || appBaseUrl);

      const metadata = {
        id_pedido: String(idPedido),
        // Permite insertar la fila si el webhook llega antes de guardarla
        monto: String(total.amount)
      };
      if (input.idCliente !== undefined && input.idCliente !== null) {
        metadata.id_cliente = String(input.idCliente);
      }

      if (mode === 'fake') {
        const sessionId = `cs_test_${idPedido}`;
        return {
          sessionId,
          url: `https://checkout.stripe.test/pay/${sessionId}`,
          expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS).toISOString(),
          metadata
        };
      }

      const params = {
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: String(idPedido),
        metadata,
        line_items: buildLineItems({ idPedido, lineas: input.lineas, monto: input.monto, currency }),
        success_url: input.successUrl
          || `${base}/?view=checkout-success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: input.cancelUrl || `${base}/?view=checkout&pago=cancelado`
      };
      if (input.customerEmail) {
        params.customer_email = String(input.customerEmail);
      }

      const options = input.idempotencyKey
        ? { idempotencyKey: String(input.idempotencyKey) }
        : undefined;
      const session = await stripe.checkout.sessions.create(params, options);
      if (!session?.id || !session?.url) {
        throw new AppError(502, 'PAYMENT_SESSION_FAILED', 'Stripe no devolvió una sesión de pago válida.');
      }
      return {
        sessionId: session.id,
        url: session.url,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        metadata
      };
    },

    /**
     * Consulta el estado real de una sesión para decidir si se reutiliza o se
     * cierra. `url` sólo trae valor mientras la sesión sigue `open`.
     */
    async retrieveCheckoutSession(sessionId) {
      if (mode === 'disabled' || (mode === 'stripe' && !stripe)) {
        throw new AppError(503, 'PAYMENTS_DISABLED', 'Pagos deshabilitados.');
      }
      if (mode === 'fake') {
        const id = String(sessionId);
        return {
          sessionId: id,
          status: 'open',
          url: `https://checkout.stripe.test/pay/${id}`,
          paymentStatus: 'unpaid',
          amountTotal: null
        };
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return {
        sessionId: session.id,
        status: session.status,
        url: session.url ?? null,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total ?? null
      };
    },

    constructEvent(rawBody, signature) {
      if (mode === 'disabled') {
        throw new AppError(503, 'PAYMENTS_DISABLED', 'Pagos deshabilitados.');
      }
      if (mode === 'fake') {
        return fakeConstructEvent(rawBody, signature);
      }
      if (!webhookSecret) {
        throw new AppError(503, 'WEBHOOK_NOT_CONFIGURED', 'Webhook de Stripe sin configurar.');
      }
      if (!signature) {
        throw new AppError(400, 'INVALID_SIGNATURE', 'Falta la firma de Stripe.');
      }
      try {
        return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch {
        throw new AppError(400, 'INVALID_SIGNATURE', 'Firma de Stripe inválida.');
      }
    }
  };
}
