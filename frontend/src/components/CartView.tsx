import React from 'react';
import { Plus, Minus, CreditCard, ShieldCheck, Trash2, ArrowRight, Truck } from 'lucide-react';
import type { CartItem } from '../data/products';

interface CartViewProps {
  cartItems: CartItem[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem?: (productId: string) => void;
  onCheckout: () => void;
}

export const CartView: React.FC<CartViewProps> = ({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout
}) => {
  const totalCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const formattedSubtotal = `$${subtotal.toLocaleString('es-CL')}`;

  return (
    <div className="cart-view-container">
      {/* Encabezado con Contador */}
      <div className="cart-header-row">
        <h1 className="cart-heading">Carrito</h1>
        <span className="cart-items-counter-tag">{totalCount} {totalCount === 1 ? 'producto' : 'productos'}</span>
      </div>

      <div className="cart-layout">
        {/* Panel Izquierdo: Lista de Productos en el Carrito */}
        <section className="cart-items-panel" aria-label="Productos en el carrito">
          {cartItems.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
              <p style={{ fontSize: '18px', fontWeight: 700 }}>Tu carrito está vacío</p>
              <p style={{ fontSize: '14px', marginTop: '6px' }}>Explora nuestro catálogo para agregar sets coleccionables.</p>
            </div>
          ) : (
            cartItems.map((item, index) => {
              const thumbImage = index === 0 
                ? '/products/cart_item1.jpg' 
                : '/products/cart_item2.jpg';

              return (
                <article key={item.product.id} className="cart-item-card">
                  {/* Cuadro Blanco con Miniatura */}
                  <div className="cart-item-thumb-box">
                    <img
                      src={thumbImage}
                      alt={item.product.name}
                      className="cart-item-thumb"
                    />
                  </div>

                  {/* Bloques de Información estilo Píldora */}
                  <div className="cart-item-info">
                    {/* Píldora Superior: Nombre y Código */}
                    <div className="cart-item-pill-top">
                      <span className="cart-item-title">{item.product.name}</span>
                      <span className="cart-item-code">Set #{item.product.code}</span>
                    </div>

                    {/* Píldora Inferior: Precio y Control de Cantidad */}
                    <div className="cart-item-pill-bottom">
                      <span className="cart-item-price">
                        ${(item.product.price * item.quantity).toLocaleString('es-CL')}
                      </span>

                      <div className="cart-item-qty-controls">
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => onUpdateQuantity(item.product.id, -1)}
                          aria-label="Disminuir cantidad"
                        >
                          <Minus size={13} strokeWidth={2.8} />
                        </button>

                        <span className="qty-number">{item.quantity}</span>

                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => onUpdateQuantity(item.product.id, 1)}
                          aria-label="Aumentar cantidad"
                        >
                          <Plus size={13} strokeWidth={2.8} />
                        </button>

                        {onRemoveItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.product.id)}
                            style={{
                              marginLeft: '6px',
                              color: '#94A3B8',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '4px'
                            }}
                            title="Eliminar producto"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {/* Barra Inferior del Carrito: Total Estimado y Envío */}
          {cartItems.length > 0 && (
            <div className="cart-total-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={17} color="#10B981" />
                <span className="cart-total-label">¡Tienes Envío Gratis en todo Chile!</span>
              </div>
              <span className="cart-total-amount">{formattedSubtotal} CLP</span>
            </div>
          )}
        </section>

        {/* Panel Derecho: Pago y Resumen */}
        <aside className="cart-payment-panel" aria-label="Resumen de Pago">
          {/* Logo Oficial VISA */}
          <div className="visa-badge-container">
            <svg
              className="visa-logo-img"
              viewBox="0 0 120 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Logo Visa"
            >
              <path
                d="M48.28 29.32L54.73 6.94H61.08L54.63 29.32H48.28ZM84.77 8.35C83.47 7.85 81.39 7.42 78.78 7.42C71.36 7.42 66.19 11.23 66.12 16.71C66.05 20.78 69.8 23.05 72.67 24.42C75.61 25.82 76.6 26.71 76.6 28.02C76.6 30.01 74.14 30.9 71.85 30.9C69.34 30.9 67.92 30.54 66.19 29.77L65.34 29.39L64.44 33.72C65.65 34.26 67.92 34.73 70.27 34.76C78.11 34.76 83.22 30.97 83.33 25.07C83.39 21.99 81.44 19.57 77.16 17.57C74.57 16.32 72.97 15.44 72.99 14.12C72.99 12.94 74.34 11.72 77.1 11.72C79.22 11.7 80.82 12.14 82.02 12.63L82.63 12.89L84.77 8.35ZM109.91 6.94H104.99C103.45 6.94 102.34 7.37 101.66 8.96L93.07 29.32H99.41L100.67 25.88H108.41L109.15 29.32H114.74L109.91 6.94ZM102.43 21.05L105.61 12.51C105.61 12.51 106.51 10.15 107.03 8.71L107.5 10.98L109.34 21.05H102.43ZM38.48 6.94L32.44 22.25L31.78 19.04C30.64 15.28 27.09 11.19 23.01 9.07L28.61 29.32H35.03L44.88 6.94H38.48ZM22.61 6.94H12.67L12.54 7.42C19.98 9.27 24.96 13.72 26.97 19.05L24.81 8.35C24.43 7.28 23.63 6.97 22.61 6.94Z"
                fill="#1434CB"
              />
            </svg>
          </div>

          {/* Tarjeta Oscura de Resumen de Compra */}
          <div className="payment-summary-card">
            <div className="summary-rows">
              <div className="summary-row">
                <span>Subtotal ({totalCount} productos)</span>
                <span>{formattedSubtotal}</span>
              </div>
              <div className="summary-row">
                <span>Despacho a Domicilio</span>
                <span style={{ color: '#4ADE80', fontWeight: 800 }}>Gratis</span>
              </div>
              <div className="summary-row">
                <span>Garantía Oficial Lego</span>
                <span style={{ color: '#CBD5E1' }}>Incluida</span>
              </div>
              <div className="summary-row total-row">
                <span>Total a Pagar</span>
                <span>{formattedSubtotal}</span>
              </div>
            </div>

            {/* Botón de Pago con Visa con efecto táctil */}
            <button
              type="button"
              className="payment-action-btn"
              onClick={onCheckout}
            >
              <CreditCard size={18} />
              <span>Proceder al Pago</span>
              <ArrowRight size={16} />
            </button>

            <div className="secure-payment-notice">
              <ShieldCheck size={14} color="#4ADE80" />
              <span>Transacción cifrada y protegida por Visa Secure</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
