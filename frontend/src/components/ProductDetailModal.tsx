import React, { useState } from 'react';
import { X, Plus, Minus, ShoppingCart, Check, ShieldCheck, Truck, Box, Sparkles, ArrowRight } from 'lucide-react';
import type { Product } from '../data/products';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity?: number) => boolean;
  onBuyNow?: (product: Product, quantity?: number) => boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onBuyNow
}) => {
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [activeImage, setActiveImage] = useState(product.image);
  const available = product.stock > 0;

  const handleAdd = () => {
    if (!onAddToCart(product, quantity)) return;
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 2000);
  };

  const handleBuy = () => {
    if (onBuyNow) {
      onBuyNow(product, quantity);
    } else {
      handleAdd();
    }
  };

  return (
    <div className="product-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="product-detail-card" onClick={(e) => e.stopPropagation()}>
        {/* Botón de cierre */}
        <button
          type="button"
          className="product-modal-close-btn"
          onClick={onClose}
          aria-label="Cerrar detalle de producto"
        >
          <X size={20} />
        </button>

        {/* Contenido en 2 Columnas */}
        <div className="product-detail-grid">
          {/* Columna Izquierda: Galería e Imagen del Set */}
          <div className="detail-media-column">
            <div className="detail-image-box">
              <span className="detail-theme-chip">{product.theme}</span>
              <img
                src={activeImage}
                alt={product.name}
                className="detail-product-img"
                onError={event => {
                  if (!event.currentTarget.src.endsWith('/product-placeholder.svg')) {
                    event.currentTarget.src = '/product-placeholder.svg';
                  }
                }}
              />
            </div>

            {product.images && product.images.length > 1 && (
              <div className="detail-gallery">
                {product.images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(image)}
                    aria-label={`Ver imagen ${index + 1}`}
                  >
                    <img src={image} alt="" width={60} height={60} />
                  </button>
                ))}
              </div>
            )}

            {/* Ficha técnica rápida con bloques Lego */}
            <div className="detail-specs-grid">
              <div className="detail-spec-item">
                <span className="spec-label">Piezas</span>
                <span className="spec-value">{product.pieces} pcs</span>
              </div>
              <div className="detail-spec-item">
                <span className="spec-label">Edad</span>
                <span className="spec-value">{product.age}</span>
              </div>
              <div className="detail-spec-item">
                <span className="spec-label">Código</span>
                <span className="spec-value">#{product.code}</span>
              </div>
              <div className="detail-spec-item">
                <span className="spec-label">Figuras</span>
                <span className="spec-value">{product.minifigures ?? 'Sin información'}</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Información y Compra */}
          <div className="detail-info-column">
            <div className="detail-header-badges">
              <span className="detail-category-badge">{product.category}</span>
              <span className="detail-status-badge">
                <Sparkles size={13} color="#10B981" />
                <span>{available ? `${product.stock} disponibles` : 'Sin stock'}</span>
              </span>
            </div>

            <h2 className="detail-product-title">{product.name}</h2>
            {product.inventorySource === 'mock' && <p role="note">Inventario simulado · modo de desarrollo</p>}

            <div className="detail-price-row">
              <span className="detail-price-main">{product.formattedPrice}</span>
              <span className="detail-shipping-pill">Envío Gratis</span>
            </div>

            {/* Descripción */}
            <p className="detail-description">
              {product.description || 'Descripción no disponible.'}
            </p>

            {/* Destacados / Highlights */}
            {product.specifications && Object.keys(product.specifications).length > 0 && (
              <dl>
                {Object.entries(product.specifications).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {product.highlights && product.highlights.length > 0 && (
              <div className="detail-highlights-box">
                <span className="highlights-title">Puntos Clave del Set:</span>
                <ul className="highlights-list">
                  {product.highlights.map((h, i) => (
                    <li key={i} className="highlight-item">
                      <Check size={14} color="#E52521" strokeWidth={3} />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Selector de Cantidad y Acciones */}
            <div className="detail-purchase-section">
              <div className="detail-qty-wrapper">
                <span className="qty-select-label">Cantidad</span>
                <div className="detail-qty-control">
                  <button
                    type="button"
                    className="detail-qty-btn"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Restar uno"
                  >
                    <Minus size={15} strokeWidth={2.6} />
                  </button>
                  <span className="detail-qty-display">{quantity}</span>
                  <button
                    type="button"
                    className="detail-qty-btn"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={!available || quantity >= product.stock}
                    aria-label="Sumar uno"
                  >
                    <Plus size={15} strokeWidth={2.6} />
                  </button>
                </div>
              </div>

              <div className="detail-buttons-group">
                <button
                  type="button"
                  className={`detail-add-cart-btn ${addedAnimation ? 'added' : ''}`}
                  onClick={handleAdd}
                  disabled={!available}
                >
                  {addedAnimation ? (
                    <>
                      <Check size={18} />
                      <span>¡Añadido al Carrito!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={18} />
                      <span>Añadir al Carrito</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="detail-buy-now-btn"
                  onClick={handleBuy}
                  disabled={!available}
                >
                  <span>Comprar Ahora</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>

            {/* Garantías de confianza */}
            <div className="detail-guarantees-row">
              <div className="guarantee-chip">
                <Truck size={15} color="#0284C7" />
                <span>Despacho Rápido</span>
              </div>
              <div className="guarantee-chip">
                <Box size={15} color="#10B981" />
                <span>100% Caja Sellada</span>
              </div>
              <div className="guarantee-chip">
                <ShieldCheck size={15} color="#E52521" />
                <span>Garantía LesGo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
