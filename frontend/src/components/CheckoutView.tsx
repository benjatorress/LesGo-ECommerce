import { useRef, useState, type FormEvent } from 'react';
import { useCart } from '../context/CartContext';
import { toOrderPayload, type CheckoutForm, type CrearPedidoPayload } from '../services/checkoutContract';
import './checkout.css';

interface Props {
  onBack: () => void;
  onConfirm?: (payload: CrearPedidoPayload, idempotencyKey: string) => Promise<void>;
}

const deliveryFields = [
  { name: 'direccion_entrega', label: 'Dirección de entrega', autoComplete: 'street-address' },
  { name: 'comuna_entrega', label: 'Comuna', autoComplete: 'address-level3' },
  { name: 'ciudad_entrega', label: 'Ciudad', autoComplete: 'address-level2' },
  { name: 'telefono_contacto', label: 'Teléfono de contacto', autoComplete: 'tel' }
] as const;

/**
 * Clave de idempotencia del checkout. Se conserva entre reintentos del mismo
 * formulario y se regenera cuando cambian los ítems o los datos de envío, para
 * no chocar con `IDEMPOTENCY_CONFLICT` si el usuario corrige algo tras un fallo.
 */
function generarIdempotencyKey(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function CheckoutView({ onBack, onConfirm }: Props) {
  const { cartItems } = useCart();
  const [form, setForm] = useState<CheckoutForm>({
    direccion_entrega: '',
    comuna_entrega: '',
    ciudad_entrega: '',
    telefono_contacto: '',
    metodo_pago: 'tarjeta',
    observaciones: ''
  });
  const [message, setMessage] = useState(() =>
    new URLSearchParams(window.location.search).get('pago') === 'cancelado'
      ? 'Pago cancelado. Tu carrito se conserva.'
      : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const claveRef = useRef<{ huella: string; clave: string } | null>(null);
  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const money = (value: number) => `$${value.toLocaleString('es-CL')}`;
  const esTarjeta = form.metodo_pago === 'tarjeta';

  const claveIdempotencia = (huella: string) => {
    if (!claveRef.current || claveRef.current.huella !== huella) {
      claveRef.current = { huella, clave: generarIdempotencyKey() };
    }
    return claveRef.current.clave;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || cartItems.length === 0) {
      return;
    }
    if (!onConfirm) {
      setMessage('No se pudo iniciar el pago. Inténtalo nuevamente.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const payload = toOrderPayload(form, cartItems);
      await onConfirm(payload, claveIdempotencia(JSON.stringify(payload)));
      // Éxito: la vista se desmonta (redirección a Stripe o navegación a pedidos),
      // así que el botón queda deshabilitado para evitar un segundo envío.
    } catch (error) {
      setSubmitting(false);
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo confirmar el pedido. Tu carrito se conserva.'
      );
    }
  };

  return (
    <section className="cart-view-container checkout-view">
      <h1 className="cart-heading">Checkout</h1>
      <button type="button" className="empty-state-reset-btn" onClick={onBack}>
        Volver al carrito
      </button>
      <p>Revisa tu orden antes de confirmar.</p>

      <form onSubmit={submit} className="cart-layout">
        <div className="cart-items-panel checkout-fields">
          <h2>Datos de entrega</h2>
          {deliveryFields.map(({ name, label, autoComplete }) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type={name === 'telefono_contacto' ? 'tel' : 'text'}
                value={form[name]}
                required
                maxLength={250}
                autoComplete={autoComplete}
                onChange={event => setForm({ ...form, [name]: event.target.value })}
              />
            </label>
          ))}
          <label>
            Método de pago
            <select
              value={form.metodo_pago}
              aria-describedby={esTarjeta ? 'checkout-payment-note' : undefined}
              onChange={event => setForm({ ...form, metodo_pago: event.target.value as CheckoutForm['metodo_pago'] })}
            >
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </label>
          {esTarjeta && (
            <p id="checkout-payment-note" className="checkout-field-note">
              Serás redirigido a Stripe para completar el pago de forma segura.
            </p>
          )}
          <label>
            Observaciones (opcional)
            <textarea
              maxLength={1000}
              value={form.observaciones}
              onChange={event => setForm({ ...form, observaciones: event.target.value })}
            />
          </label>
        </div>

        <aside className="payment-summary-card" aria-label="Resumen final de la orden">
          <h2>Resumen final de la orden</h2>
          {cartItems.length === 0 && <p>Tu carrito está vacío.</p>}
          {cartItems.map(item => (
            <div className="checkout-summary-item" key={item.product.id}>
              <img
                className="checkout-summary-image"
                src={item.product.image || '/product-placeholder.svg'}
                alt=""
                width="56"
                height="56"
                onError={event => {
                  if (!event.currentTarget.src.endsWith('/product-placeholder.svg')) {
                    event.currentTarget.src = '/product-placeholder.svg';
                  }
                }}
              />
              <div className="checkout-summary-details">
                <strong>{item.product.name}</strong>
                <span>
                  {item.quantity} × {money(item.product.price)} = {money(item.quantity * item.product.price)}
                </span>
              </div>
            </div>
          ))}
          <p className="summary-row total-row">Total estimado <strong>{money(total)}</strong></p>
          <p>El servidor verificará precios y disponibilidad al crear el pedido.</p>
          <button className="payment-action-btn" type="submit" disabled={!cartItems.length || submitting}>
            {submitting
              ? (esTarjeta ? 'Redirigiendo a Stripe…' : 'Confirmando…')
              : (esTarjeta ? 'Pagar con tarjeta' : 'Confirmar pedido')}
          </button>
          {message && <p role="status">{message}</p>}
        </aside>
      </form>
    </section>
  );
}
