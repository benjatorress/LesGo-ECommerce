import { useEffect, useRef, useState } from 'react';
import { clearCarritoApi, getSession } from '../services/api';
import { getEstadoPagoApi, type EstadoPago, type EstadoPagoDetalle } from '../services/pagosApi';
import './checkout-success.css';

interface Props {
  onClearCart: () => void;
  onGoToOrders: () => void;
  onGoToCatalog: () => void;
  onBackToCheckout: () => void;
}

/** Estados en los que el webhook puede no haber llegado todavía. */
const EN_PROCESO: EstadoPago[] = ['pendiente', 'abierta'];
const MAX_INTENTOS = 5;
const INTERVALO_MS = 2000;

type Situacion = 'sin-sesion' | 'verificando' | 'pagada' | 'revision' | 'fallida' | 'pendiente' | 'error';

const CONTENIDO: Record<Situacion, { titulo: string; mensaje: string; tono: 'ok' | 'espera' | 'alerta' }> = {
  'sin-sesion': {
    titulo: 'No encontramos la sesión de pago',
    mensaje: 'El enlace no incluye el identificador de la sesión de Stripe.',
    tono: 'alerta'
  },
  verificando: {
    titulo: 'Verificando tu pago',
    mensaje: 'Estamos consultando el estado del pago con el servidor. Esto puede tardar unos segundos.',
    tono: 'espera'
  },
  pagada: {
    titulo: 'Pago aprobado',
    mensaje: 'Recibimos tu pago y tu pedido quedó confirmado.',
    tono: 'ok'
  },
  revision: {
    titulo: 'Estamos revisando tu pago',
    mensaje: 'El pago quedó en revisión. Te contactaremos cuando esté resuelto; no necesitas volver a pagar.',
    tono: 'espera'
  },
  fallida: {
    titulo: 'El pago no se completó',
    mensaje: 'No se realizó ningún cobro. Tu carrito se conserva para que puedas intentarlo de nuevo.',
    tono: 'alerta'
  },
  pendiente: {
    titulo: 'Tu pago aún se está procesando',
    mensaje: 'El banco todavía no confirma el cobro. Puedes volver a comprobar en unos segundos.',
    tono: 'espera'
  },
  error: {
    titulo: 'No pudimos confirmar tu pago',
    mensaje: 'No fue posible consultar el estado del pago.',
    tono: 'alerta'
  }
};

const money = (value: number) => `$${value.toLocaleString('es-CL')}`;

export function CheckoutSuccessView({ onClearCart, onGoToOrders, onGoToCatalog, onBackToCheckout }: Props) {
  const [sessionId] = useState(() => new URLSearchParams(window.location.search).get('session_id') ?? '');
  const [pago, setPago] = useState<EstadoPagoDetalle | null>(null);
  const [error, setError] = useState('');
  const [reintento, setReintento] = useState(0);
  const limpiado = useRef(false);

  // Polling corto: el webhook de Stripe puede llegar después del redirect.
  useEffect(() => {
    if (!sessionId) return;
    let cancelado = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let intentos = 0;

    const consultar = async () => {
      try {
        const estado = await getEstadoPagoApi(sessionId);
        if (cancelado) return;
        setPago(estado);
        setError('');
        if (EN_PROCESO.includes(estado.estado) && intentos < MAX_INTENTOS) {
          intentos += 1;
          temporizador = setTimeout(consultar, INTERVALO_MS);
        }
      } catch (err) {
        if (cancelado) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'No se pudo consultar el estado del pago.'
        );
      }
    };

    consultar();
    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [sessionId, reintento]);

  const estado = pago?.estado;

  // El carrito se vacía sólo cuando el backend confirma el cobro, y una sola vez.
  useEffect(() => {
    if (estado !== 'pagada' || limpiado.current) return;
    limpiado.current = true;
    onClearCart();
    const token = getSession().token;
    if (!token) return;
    clearCarritoApi(token)
      .catch(err => console.warn('No se pudo vaciar el carrito guardado:', err))
      // Si `GET /api/carrito` resolvió después del borrado, este segundo vaciado
      // evita que los productos comprados reaparezcan al recargar la página.
      .finally(() => onClearCart());
  }, [estado, onClearCart]);

  const situacion: Situacion = !sessionId
    ? 'sin-sesion'
    : error
      ? 'error'
      : !pago
        ? 'verificando'
        : pago.estado === 'pagada'
          ? 'pagada'
          : pago.estado === 'revision'
            ? 'revision'
            : pago.estado === 'expirada' || pago.estado === 'fallida'
              ? 'fallida'
              : 'pendiente';

  const { titulo, mensaje, tono } = CONTENIDO[situacion];

  const reintentar = () => {
    setError('');
    setPago(null);
    setReintento(valor => valor + 1);
  };

  return (
    <section className="cart-view-container checkout-success" aria-live="polite">
      <span className={`checkout-success-badge checkout-success-badge--${tono}`} aria-hidden="true">
        {tono === 'ok' ? '✓' : tono === 'espera' ? '…' : '!'}
      </span>
      <h1 className="cart-heading">{titulo}</h1>
      <p>{situacion === 'error' ? error : mensaje}</p>

      {situacion === 'pagada' && pago && (
        <dl className="checkout-success-detail">
          <div>
            <dt>Pedido</dt>
            <dd>#{pago.id_pedido}</dd>
          </div>
          <div>
            <dt>Total pagado</dt>
            <dd>{money(pago.monto)}</dd>
          </div>
          {pago.pagado_en && (
            <div>
              <dt>Fecha del pago</dt>
              <dd>{new Date(pago.pagado_en).toLocaleString('es-CL')}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="checkout-success-actions">
        {situacion === 'pagada' && (
          <button type="button" className="payment-action-btn" onClick={onGoToOrders}>
            Ver mis pedidos
          </button>
        )}

        {situacion === 'revision' && (
          <button type="button" className="payment-action-btn" onClick={onGoToOrders}>
            Ver mis pedidos
          </button>
        )}

        {situacion === 'fallida' && (
          <>
            <button type="button" className="payment-action-btn" onClick={onBackToCheckout}>
              Volver al checkout
            </button>
            <button type="button" className="empty-state-reset-btn" onClick={onGoToOrders}>
              Ver mis pedidos
            </button>
          </>
        )}

        {situacion === 'pendiente' && (
          <>
            <button type="button" className="payment-action-btn" onClick={reintentar}>
              Volver a comprobar
            </button>
            <button type="button" className="empty-state-reset-btn" onClick={onGoToOrders}>
              Ver mis pedidos
            </button>
          </>
        )}

        {situacion === 'error' && (
          <>
            <button type="button" className="payment-action-btn" onClick={reintentar}>
              Volver a comprobar
            </button>
            <button type="button" className="empty-state-reset-btn" onClick={onGoToOrders}>
              Ver mis pedidos
            </button>
          </>
        )}

        {situacion === 'sin-sesion' && (
          <button type="button" className="payment-action-btn" onClick={onGoToCatalog}>
            Ir al catálogo
          </button>
        )}
      </div>
    </section>
  );
}
