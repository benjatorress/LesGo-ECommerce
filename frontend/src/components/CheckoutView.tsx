import { useState, type FormEvent } from 'react';
import { useCart } from '../context/CartContext';
import { toOrderPayload, type CheckoutForm, type CrearPedidoPayload } from '../services/checkoutContract';
import './checkout.css';

interface Props {
  onBack: () => void;
  onConfirm?: (payload: CrearPedidoPayload) => Promise<void>;
}

const deliveryFields = [
  { name: 'direccion_entrega', label: 'Dirección de entrega', autoComplete: 'street-address' },
  { name: 'comuna_entrega', label: 'Comuna', autoComplete: 'address-level3' },
  { name: 'ciudad_entrega', label: 'Ciudad', autoComplete: 'address-level2' },
  { name: 'telefono_contacto', label: 'Teléfono de contacto', autoComplete: 'tel' }
] as const;

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
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const money = (value: number) => `$${value.toLocaleString('es-CL')}`;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || cartItems.length === 0) {
      return;
    }
    if (!onConfirm) {
      setMessage('La confirmación del pedido está pendiente de integración (SCRUM-20). No se ha creado un pedido ni procesado un pago.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await onConfirm(toOrderPayload(form, cartItems));
    } catch {
      setMessage('No se pudo confirmar el pedido. Tu carrito se conserva.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="cart-view-container checkout-view">
      <h1 className="cart-heading">Checkout</h1>
      <button type="button" className="empty-state-reset-btn" onClick={onBack}>
        Volver al carrito
      </button>
      <p>Revisa tu orden. Esta vista no procesa pagos.</p>

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
              onChange={event => setForm({ ...form, metodo_pago: event.target.value as CheckoutForm['metodo_pago'] })}
            >
              <option value="tarjeta">Tarjeta (pendiente de integración)</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </label>
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
              <strong>{item.product.name}</strong>
              <span>
                {item.quantity} × {money(item.product.price)} = {money(item.quantity * item.product.price)}
              </span>
            </div>
          ))}
          <p className="summary-row total-row">Total estimado <strong>{money(total)}</strong></p>
          <p>El servidor verificará precios y disponibilidad al crear el pedido.</p>
          <button className="payment-action-btn" type="submit" disabled={!cartItems.length || submitting}>
            {submitting ? 'Confirmando…' : 'Confirmar pedido'}
          </button>
          {message && <p role="status">{message}</p>}
        </aside>
      </form>
    </section>
  );
}
