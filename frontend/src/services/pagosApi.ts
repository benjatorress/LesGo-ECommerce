import { request } from './http';

/** Estados del pago tal como los persiste `ecommerce_ventas.ecom_pago`. */
export type EstadoPago = 'pendiente' | 'abierta' | 'pagada' | 'expirada' | 'fallida' | 'revision';

export interface SesionPago {
  sessionId: string;
  /** `null` cuando el backend ya concilió el pago y no hace falta redirigir. */
  url: string | null;
  /** `true` si se reutilizó una Checkout Session abierta del mismo pedido. */
  reutilizada: boolean;
  /** `true` si el backend confirmó el cobro sin esperar al webhook. */
  pagado: boolean;
}

export interface EstadoPagoDetalle {
  estado: EstadoPago;
  id_pedido: number;
  monto: number;
  moneda: string;
  pagado_en: string | null;
}

/**
 * POST /api/pagos/stripe/session
 * Crea (o reutiliza) la Checkout Session de Stripe de un pedido propio.
 * El monto lo calcula el backend a partir de `ecom_pedido.monto_total`.
 */
export async function crearSesionPagoApi(idPedido: number): Promise<SesionPago> {
  const data = await request('/pagos/stripe/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_pedido: idPedido })
  });
  const session = data.session as { sessionId: string; url: string | null } | undefined;
  if (!session?.sessionId) {
    throw new Error('El servidor no devolvió una sesión de pago válida.');
  }
  return {
    sessionId: session.sessionId,
    url: session.url ?? null,
    reutilizada: Boolean(data.reutilizada),
    pagado: Boolean(data.pagado)
  };
}

/**
 * GET /api/pagos/stripe/session/:sessionId
 * Estado local del pago. Es la única fuente válida para confirmar un cobro:
 * el `session_id` de la URL no prueba nada por sí solo.
 */
export async function getEstadoPagoApi(sessionId: string): Promise<EstadoPagoDetalle> {
  const data = await request(`/pagos/stripe/session/${encodeURIComponent(sessionId)}`);
  const pago = data.pago as EstadoPagoDetalle | undefined;
  if (!pago?.estado) {
    throw new Error('El servidor no devolvió el estado del pago.');
  }
  return pago;
}

/** Wrapper aislado para poder stubear la navegación en tests. */
export function redirigirAStripe(url: string): void {
  window.location.assign(url);
}
