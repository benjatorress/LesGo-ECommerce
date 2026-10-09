import React from 'react';
import { ShoppingCart } from 'lucide-react';

export type ViewType = 'home' | 'catalog' | 'cart' | 'nosotros' | 'contacto';

interface NavbarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  cartCount: number;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  cartCount,
  onOpenAuth
}) => {
  return (
    <header className="lesgo-header">
      {/* Espigas / Dientes inferiores de Lego */}
      <div className="header-studs" aria-hidden="true" />

      {/* Logotipo LesGo con Tag Oficial */}
      <button 
        type="button" 
        className="lesgo-logo-btn" 
        onClick={() => setCurrentView('home')}
        aria-label="Ir a Inicio"
      >
        <span className="lesgo-logo-text">LesGo</span>
        <span className="lesgo-logo-badge">STORE</span>
      </button>

      {/* Enlaces de Navegación */}
      <nav aria-label="Navegación principal">
        <ul className="lesgo-nav-links">
          <li>
            <button
              type="button"
              className={`nav-link-btn ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentView('home')}
            >
              Home
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`nav-link-btn ${currentView === 'catalog' ? 'active' : ''}`}
              onClick={() => setCurrentView('catalog')}
            >
              Catálogo
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`nav-link-btn ${currentView === 'nosotros' ? 'active' : ''}`}
              onClick={() => setCurrentView('nosotros')}
            >
              Nosotros
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`nav-link-btn ${currentView === 'contacto' ? 'active' : ''}`}
              onClick={() => setCurrentView('contacto')}
            >
              Contacto
            </button>
          </li>
        </ul>
      </nav>

      {/* Botones de Usuario y Carrito */}
      <div className="lesgo-auth-group">
        <button
          type="button"
          className="cart-icon-btn"
          onClick={() => setCurrentView('cart')}
          aria-label={`Ver Carrito (${cartCount} productos)`}
        >
          <ShoppingCart size={18} strokeWidth={2.4} />
          <span>Carrito</span>
          <span className="cart-badge">{cartCount}</span>
        </button>

        <button
          type="button"
          className="register-btn"
          onClick={() => onOpenAuth('register')}
        >
          Registrarse
        </button>

        <button
          type="button"
          className="login-pill-btn"
          onClick={() => onOpenAuth('login')}
        >
          Iniciar Sesión
        </button>
      </div>
    </header>
  );
};
