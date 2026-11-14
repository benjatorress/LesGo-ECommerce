import { AppError } from '../lib/errors.js';

// Eventos que confirman el cobro. `completed` sólo cuenta si el pago ya está
// `paid`: con métodos asincrónicos llega primero en `unpaid` y confirma después
// `async_payment_succeeded`.
const PAID_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded'
]);

// Eventos que cierran el intento sin cobrar. El pedido sigue `Pendiente`.
const FAILED_EVENTS = {
  'checkout.session.async_payment_failed': 'fallida',
  'checkout.session.expired': 'expirada'
};

/**
 * Procesa eventos de Stripe de forma idempotente: la transición a `pagada` del
 * repositorio devuelve `transitioned: true` sólo la primera vez, y el CRM se
 * sincroniza únicamente en ese caso. Un reintento de Stripe no duplica efectos.
 */
export function createStripeWebhookService({ paymentRepository, orders, crm }) {
  /**
   * Sincronización CRM best-effort del pedido ya pagado. Reutiliza la clave
   * idempotente del pedido para que el CRM pueda descartar duplicados.
   */
  async function syncCrm(idPedido, idCliente) {
    if (!Number.isSafeInteger(idCliente) || idCliente <= 0) {
      return 'skipped';
    }
    const stored = await orders.get(idCliente, idPedido);
    const event = stored?.event;
    if (!event?.key) {
      return 'skipped';
    }
    if (event.status === 'synced') {
      return 'synced';
    }
    const payload = { ...(event.payload ?? {}), id_pedido: idPedido };
    const status = await crm.send(payload, `lesgo-order-${idCliente}-${event.key}`);
    await orders.markCrm(idPedido, status);
    return status;
  }

  /**
   * Devuelve la fila local del pago. Si el webhook llegó antes de que el backend
   * guardara la sesión, se crea desde la metadata (por eso se copia `monto` allí).
   */
  async function ensurePago(session, sessionId) {
    const existing = await paymentRepository.findBySession(sessionId);
    if (existing) {
      return existing;
    }
    const idPedido = Number(session?.metadata?.id_pedido);
    const monto = Number(session?.metadata?.monto);
    if (!Number.isSafeInteger(idPedido) || idPedido <= 0 || !Number.isFinite(monto) || monto <= 0) {
      // 500 para que Stripe reintente: sin estos datos no hay forma de conciliar.
      throw new AppError(
        500,
        'PAYMENT_METADATA_MISSING',
        'El evento de Stripe no trae los datos del pedido.'
      );
    }
    return paymentRepository.insertFromWebhook({ idPedido, sessionId, monto });
  }

  return {
    /**
     * @returns {{ received: true, ignored?: true, pending?: boolean, transitioned?: boolean,
     *             estado?: string|null, reason?: string, crmSync: Promise<string>|null }}
     */
    async handleEvent(event) {
      const type = event?.type;
      const session = event?.data?.object;
      const sessionId = typeof session?.id === 'string' && session.id ? session.id : null;

      if (!sessionId || (!PAID_EVENTS.has(type) && !FAILED_EVENTS[type])) {
        return { received: true, ignored: true, crmSync: null };
      }

      const pago = await ensurePago(session, sessionId);

      if (FAILED_EVENTS[type]) {
        const result = await paymentRepository.markFailed({
          sessionId,
          estado: FAILED_EVENTS[type]
        });
        return { received: true, estado: result.pago?.estado ?? null, crmSync: null };
      }

      if (type === 'checkout.session.completed' && session.payment_status !== 'paid') {
        // Pago asincrónico aún en curso: se espera a async_payment_succeeded.
        return { received: true, pending: true, crmSync: null };
      }

      // CLP es de cero decimales, así que `amount_total` llega en la misma escala
      // que `ecom_pago.monto` (pesos) y la conciliación es una comparación directa.
      const amountTotal = session.amount_total === undefined || session.amount_total === null
        ? null
        : Number(session.amount_total);

      // `markPaid` ya pasa el pedido a 'Pagada' en la misma transacción.
      const result = await paymentRepository.markPaid({ sessionId, amountTotal });
      if (result.transitioned !== true) {
        return {
          received: true,
          transitioned: false,
          reason: result.reason,
          crmSync: null
        };
      }

      const idPedido = Number(pago.id_pedido);
      const idCliente = Number(pago.id_cliente ?? session.metadata?.id_cliente);
      // No se espera al CRM para responder a Stripe: si falla, el pago sigue pagado
      // y el pedido queda con CRM `pending` para reintento manual.
      const crmSync = syncCrm(idPedido, idCliente).catch((error) => {
        console.error(`[pagos] CRM no sincronizado para el pedido ${idPedido}: ${error.message}`);
        return 'pending';
      });

      return { received: true, transitioned: true, crmSync };
    }
  };
}
