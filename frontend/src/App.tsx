import { useState, useEffect } from 'react';
import { Navbar, type ViewType } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { CatalogView } from './components/CatalogView';
import { CartView } from './components/CartView';
import { AboutView } from './components/AboutView';
import { ContactView } from './components/ContactView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AuthModal } from './components/AuthModal';
import { InfoModal } from './components/InfoModal';
import { VentasModal } from './components/VentasModal';
import { INITIAL_CART, type Product, type CartItem } from './data/products';
import { getSession, clearSession, type Usuario } from './services/api';
import './App.css';

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState<string>('all');
  const [cartItems, setCartItems] = useState<CartItem[]>(INITIAL_CART);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [infoModal, setInfoModal] = useState<'nosotros' | 'contacto' | null>(null);
  const [ventasModalOpen, setVentasModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Estado de usuario autenticado (cargado de LocalStorage si existe)
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session.usuario) {
      setCurrentUser(session.usuario);
    }
  }, []);

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3200);
  };

  const handleLoginSuccess = (usuario: Usuario, _token: string) => {
    setCurrentUser(usuario);
    if (usuario.tipo === 'empleado') {
      showNotification(`¡Bienvenido(a) ${usuario.nombre}! Acceso habilitado al Módulo de Ventas ERP.`);
    } else {
      showNotification(`¡Bienvenido(a) ${usuario.nombre}! Has iniciado sesión en la tienda LesGo.`);
    }
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setVentasModalOpen(false);
    showNotification('Has cerrado tu sesión.');
  };

  const handleAddToCart = (product: Product, quantity: number = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    showNotification(`"${product.name}" (${quantity > 1 ? `${quantity}x` : '1x'}) añadido al carrito`);
  };

  const handleBuyNow = (product: Product, quantity: number = 1) => {
    handleAddToCart(product, quantity);
    setSelectedProduct(null);
    setCurrentView('cart');
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
    showNotification('Producto eliminado del carrito');
  };

  const handleCheckout = () => {
    showNotification('Redirigiendo a pasarela segura de pago VISA...');
  };

  const handleNavigateToCatalog = (category?: string) => {
    if (category) {
      setSelectedCatalogCategory(category);
    }
    setCurrentView('catalog');
  };

  return (
    <div className="app-wrapper">
      {/* Header con Logotipo LesGo, Dientes Lego y Estado de Autenticación */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        cartCount={cartCount}
        currentUser={currentUser}
        onOpenAuth={(mode) => setAuthModal(mode)}
        onLogout={handleLogout}
        onOpenVentasModal={() => setVentasModalOpen(true)}
      />

      {/* Notificación flotante de acción */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '84px',
            right: '24px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '16px',
            boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.25)',
            border: '1px solid #334155',
            zIndex: 1100,
            fontSize: '14px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <span>{notification}</span>
        </div>
      )}

      {/* Contenido Principal según Vista Activa */}
      <main className="main-content">
        {currentView === 'home' && (
          <HomeView
            onNavigateToCatalog={handleNavigateToCatalog}
            onAddToCart={handleAddToCart}
            onSelectProduct={(product) => setSelectedProduct(product)}
          />
        )}

        {currentView === 'catalog' && (
          <CatalogView
            initialCategory={selectedCatalogCategory}
            onAddToCart={handleAddToCart}
            onSelectProduct={(product) => setSelectedProduct(product)}
          />
        )}

        {currentView === 'cart' && (
          <CartView
            cartItems={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckout}
          />
        )}

        {currentView === 'nosotros' && (
          <AboutView onGoToCatalog={() => setCurrentView('catalog')} />
        )}

        {currentView === 'contacto' && (
          <ContactView />
        )}
      </main>

      {/* Vista de Detalle de Producto al hacer clic en un set */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
        />
      )}

      {/* Modales de Autenticación */}
      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onSwitchMode={(mode) => setAuthModal(mode)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Modal Módulo de Ventas ERP para Empleados */}
      {ventasModalOpen && currentUser && currentUser.acceso_modulo_ventas && (
        <VentasModal
          usuario={currentUser}
          onClose={() => setVentasModalOpen(false)}
        />
      )}

      {infoModal && (
        <InfoModal
          type={infoModal}
          onClose={() => setInfoModal(null)}
        />
      )}
    </div>
  );
}

export default App;
