import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Truck, Package, Plus } from 'lucide-react';
import type { Product } from '../data/products';
import { getProductosApi } from '../services/api';

interface HomeViewProps {
  onNavigateToCatalog: (category?: string) => void;
  onAddToCart: (product: Product) => void;
  onSelectProduct?: (product: Product) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigateToCatalog,
  onAddToCart,
  onSelectProduct
}) => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    getProductosApi()
      .then((items) => {
        if (isMounted) {
          // Mostrar 3 sets destacados
          setFeaturedProducts(items.slice(0, 3));
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
          setError('No se pudo consultar Inventario. Inténtalo más tarde.');
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const categoryCards = [
    { id: 'Star Wars', title: 'Star Wars', color: '#0284C7', count: 'Edición Hoth & Espacio' },
    { id: 'Marvel', title: 'Marvel & DC', color: '#F59E0B', count: 'Super Héroes' },
    { id: 'City', title: 'Lego City', color: '#10B981', count: 'Aventura & Rescate' },
    { id: 'Ninjago', title: 'Lego Ninjago', color: '#EC4899', count: 'Dragones & Ninjas' }
  ];

  return (
    <div className="home-view-container">
      {error && <p role="alert">{error}</p>}
      {featuredProducts.some(product => product.inventorySource === 'mock') && (
        <p role="note">Inventario simulado · modo de desarrollo</p>
      )}
      {/* Hero Section */}
      <section className="home-hero-section">
        <div className="hero-content">
          <div className="hero-pill-badge">
            <Sparkles size={14} color="#E52521" />
            <span>NUEVA COLECCIÓN 2026 DISPONIBLE</span>
          </div>

          <h1 className="hero-title">
            Construye tu propio universo <span className="hero-highlight">pieza a pieza</span>
          </h1>

          <p className="hero-description">
            En <strong>LesGo</strong> reunimos los sets más codiciados del mundo: desde impresionantes vehículos de colección hasta mundos llenos de aventura para todas las edades.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="hero-primary-btn"
              onClick={() => onNavigateToCatalog()}
            >
              <span>Explorar Catálogo</span>
              <ArrowRight size={17} />
            </button>

            <button
              type="button"
              className="hero-secondary-btn"
              onClick={() => onNavigateToCatalog('Star Wars')}
            >
              <span>Ver Star Wars</span>
            </button>
          </div>
        </div>

        {/* Hero Card Showcase */}
        <div className="hero-banner-card">
          <div className="hero-brick-decoration" />
          <div className="hero-card-header">
            <span className="hero-card-tag">SET DESTACADO</span>
            <span className="hero-card-price">$229.990</span>
          </div>
          <div className="hero-image-wrapper">
            <img
              src="/products/item4_batmobile.jpg"
              alt="Lego Batmobile Tumbler"
              className="hero-card-img"
            />
          </div>
          <div className="hero-card-footer">
            <div>
              <h3 className="hero-set-title">Lego DC Batmobile Tumbler</h3>
              <p className="hero-set-sub">1.869 Piezas • Edición Coleccionista</p>
            </div>
            <button
              type="button"
              className="hero-quick-btn"
              onClick={() => onNavigateToCatalog()}
              title="Ver en catálogo"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Categorías Temáticas Populares */}
      <section className="home-categories-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Explora por Franquicia</h2>
            <p className="section-subtitle">Selecciona tu temática preferida con un solo clic</p>
          </div>
        </div>

        <div className="home-category-grid">
          {categoryCards.map((cat) => (
            <div
              key={cat.id}
              className="home-category-card"
              onClick={() => onNavigateToCatalog(cat.id)}
            >
              <div
                className="category-card-stud"
                style={{ backgroundColor: cat.color }}
              />
              <div className="category-card-text">
                <h3 className="category-card-title">{cat.title}</h3>
                <span className="category-card-sub">{cat.count}</span>
              </div>
              <ArrowRight size={16} className="category-card-arrow" />
            </div>
          ))}
        </div>
      </section>

      {/* Sets Destacados (Desde API) */}
      <section className="home-featured-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Sets Más Populares</h2>
            <p className="section-subtitle">Los favoritos de nuestra comunidad de constructores</p>
          </div>
          <button
            type="button"
            className="view-all-link-btn"
            onClick={() => onNavigateToCatalog()}
          >
            <span>Ver todo el catálogo</span>
            <ArrowRight size={15} />
          </button>
        </div>

        <div className="products-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#64748B' }}>
              Cargando sets recomendados desde el backend...
            </div>
          ) : (
            featuredProducts.map((product) => (
              <div
                key={product.id}
                className="product-card"
                onClick={() => onSelectProduct ? onSelectProduct(product) : onAddToCart(product)}
              >
                <div className="product-card-image-box">
                  <span className="product-tag-chip">{product.theme}</span>
                  <span className="product-pieces-chip">{product.pieces} pcs</span>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="product-card-img"
                    loading="lazy"
                  />
                </div>

                <div className="product-card-pill">
                  <span className="product-pill-title" title={product.name}>
                    {product.name}
                  </span>

                  <div className="product-pill-price-box">
                    <span className="product-pill-price">
                      {product.formattedPrice}
                    </span>
                    <button
                      type="button"
                      className="product-quick-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(product);
                      }}
                      title="Añadir al carrito"
                    >
                      <Plus size={15} strokeWidth={2.8} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Beneficios / Garantías LesGo */}
      <section className="home-perks-section">
        <div className="perk-card">
          <div className="perk-icon-circle">
            <Truck size={22} color="#E52521" />
          </div>
          <div>
            <h4 className="perk-title">Despacho Exprés</h4>
            <p className="perk-desc">Envío gratis a todo el país en compras superiores a $50.000.</p>
          </div>
        </div>

        <div className="perk-card">
          <div className="perk-icon-circle">
            <Package size={22} color="#E52521" />
          </div>
          <div>
            <h4 className="perk-title">100% Original</h4>
            <p className="perk-desc">Sets completamente nuevos, sellados y con garantía oficial.</p>
          </div>
        </div>

        <div className="perk-card">
          <div className="perk-icon-circle">
            <ShieldCheck size={22} color="#E52521" />
          </div>
          <div>
            <h4 className="perk-title">Pago Protegido</h4>
            <p className="perk-desc">Transacciones cifradas a través de Visa Secure y Webpay.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
