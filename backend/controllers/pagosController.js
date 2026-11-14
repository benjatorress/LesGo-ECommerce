import { randomUUID } from 'node:crypto';
import { AppError } from '../lib/errors.js';

const parseId = (value) => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  const text = String(value ?? '');
  return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null;
};

/**
 * Nombres de producto para los `line_items` de Stripe. En PostgreSQL el detalle
 * sólo guarda `id_producto`; el nombre vive en el snapshot del outbox, que
 * `orders.get` devuelve como `event.payload.productos`.
 */
const lineasFromOrder = (stored) => {
  const nombres = new Map(
    (stored.event?.payload?.productos ?? []).map(p => [String(p.id_producto), p.nombre])
  );
  return (stored.detalle ?? []).map((linea) => ({
    nombre: nombres.get(String(linea.id_producto)) ?? `Producto #${linea.id_producto}`,
    cantidad: Number(linea.cantidad),
    precio_unitario: Number(linea.precio_unitario)
  }));
};

/**
 * Decide qué hacer con un intento de pago que la BD considera abierto según el
 * estado real en Stripe. La BD es la fuente de pertenencia; Stripe, la del cobro.
 */
async function revisarSesionAbierta(payments, sessionId) {
  let session;
  try {
    session = await payments.retrieveCheckoutSession(sessionId);
  } catch {
    // Sesión borrada o de otra cuenta: se cierra el intento local y se reintenta.
    return { accion: 'cerrar' };
  }
  if (session.status === 'open' && session.url) {
    return { accion: 'reutilizar', url: session.url };
  }
  if (session.status === 'complete') {
    return session.paymentStatus === 'paid'
      ? { accion: 'pagado', amountTotal: session.amountTotal ?? null }
      : { accion: 'en_curso' };
  }
  return { accion: 'cerrar' };
}

/**
 * POST /api/pagos/stripe/session
 * Crea (o reutiliza) la Checkout Session de un pedido propio en estado Pendiente
 * y pago con tarjeta. El monto sale siempre de `ecom_pedido.monto_total`, nunca
 * del body.
 */
export const postStripeSession = async (req, res) => {
  const { orders, payments, paymentRepository } = req.app.locals;
  const idCliente = req.customer.id_cliente;
  const idPedido = parseId(req.body?.id_pedido);

  if (idPedido === null) {
    throw new AppError(400, 'INVALID_ORDER_ID', 'El ID del pedido debe ser un entero positivo.');
  }

  const stored = await orders.get(idCliente, idPedido);
  if (!stored?.pedido) {
    // No se distingue "no existe" de "es de otro cliente": no se filtra información.
    throw new AppError(404, 'ORDER_NOT_FOUND', 'No encontramos ese pedido para tu cuenta.');
  }
  const pedido = stored.pedido;

  if (pedido.metodo_pago !== 'tarjeta') {
    throw new AppError(
      409,
      'PAYMENT_METHOD_NOT_SUPPORTED',
      'El pedido no está configurado para pago con tarjeta.'
    );
  }
  if (pedido.estado !== 'Pendiente') {
    throw new AppError(409, 'ORDER_NOT_PAYABLE', 'El pedido no está pendiente de pago.');
  }

  const abierto = await paymentRepository.findOpenByOrder(idPedido);
  if (abierto) {
    const revision = await revisarSesionAbierta(payments, abierto.stripe_session_id);

    if (revision.accion === 'reutilizar') {
      return res.status(200).json({
        success: true,
        reutilizada: true,
        session: { sessionId: abierto.stripe_session_id, url: revision.url }
      });
    }
    if (revision.accion === 'pagado') {
      const pago = await paymentRepository.markPaid({
        sessionId: abierto.stripe_session_id,
        amountTotal: revision.amountTotal
      });
      return res.status(200).json({
        success: true,
        reutilizada: false,
        pagado: pago.pago?.estado === 'pagada',
        session: { sessionId: abierto.stripe_session_id, url: null }
      });
    }
    if (revision.accion === 'en_curso') {
      // Cobro asincrónico en vuelo: crear otra sesión podría cobrar dos veces.
      throw new AppError(409, 'PAYMENT_IN_PROGRESS', 'El pago de este pedido está en proceso.');
    }
    await paymentRepository.markFailed({
      sessionId: abierto.stripe_session_id,
      estado: 'expirada'
    });
  }

  const session = await payments.createCheckoutSession({
    idPedido,
    idCliente,
    monto: pedido.monto_total,
    lineas: lineasFromOrder(stored),
    customerEmail: req.customer.email,
    // Se genera en el servidor y no se persiste: la idempotencia real la da la
    // sesión abierta de ecom_pago.
    idempotencyKey: randomUUID()
  });

  const pago = await paymentRepository.createAttempt({
    idPedido,
    idCliente,
    sessionId: session.sessionId,
    monto: pedido.monto_total
  });

  if (pago.stripe_session_id !== session.sessionId) {
    // Otra request ganó la carrera por el índice parcial: se devuelve ese intento
    // en vez de una sesión que no quedó registrada (su webhook no sería conciliable).
    const revision = await revisarSesionAbierta(payments, pago.stripe_session_id);
    if (revision.accion === 'reutilizar') {
      return res.status(200).json({
        success: true,
        reutilizada: true,
        session: { sessionId: pago.stripe_session_id, url: revision.url }
      });
    }
    throw new AppError(409, 'PAYMENT_IN_PROGRESS', 'El pago de este pedido está en proceso.');
  }

  return res.status(201).json({
    success: true,
    reutilizada: false,
    session: { sessionId: session.sessionId, url: session.url },
    pago: { id_pago: pago.id_pago, estado: pago.estado }
  });
};

/**
 * GET /api/pagos/stripe/session/:sessionId
 * Estado local del pago de una sesión propia. `findBySession` resuelve el dueño
 * con un join a ecom_pedido; la comparación se hace aquí.
 */
export const getStripeSession = async (req, res) => {
  const sessionId = String(req.params.sessionId ?? '');
  if (!sessionId || sessionId.length > 255) {
    throw new AppError(400, 'INVALID_SESSION_ID', 'El ID de sesión no es válido.');
  }

  const pago = await req.app.locals.paymentRepository.findBySession(sessionId);
  if (!pago || pago.id_cliente !== req.customer.id_cliente) {
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'No encontramos el pago de esa sesión.');
  }

  return res.json({
    success: true,
    pago: {
      estado: pago.estado,
      id_pedido: pago.id_pedido,
      monto: pago.monto,
      moneda: process.env.STRIPE_CURRENCY || 'clp',
      pagado_en: pago.pagado_en
    }
  });
};
