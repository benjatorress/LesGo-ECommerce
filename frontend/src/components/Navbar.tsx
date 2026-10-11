import React from 'react';
import { ShoppingCart, LogOut, Briefcase, User } from 'lucide-react';
import type { Usuario } from '../services/api';

export type ViewType = 'home' | 'catalog' | 'cart' | 'nosotros' | 'contacto';

interface NavbarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  cartCount: number;
  currentUser: Usuario | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenVentasModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  cartCount,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenVentasModal
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
        {/* Carrito */}
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

        {/* Si el usuario ha iniciado sesión */}
        {currentUser ? (
          <>
            {/* Si es empleado, acceso exclusivo al Módulo de Ventas ERP */}
            {currentUser.acceso_modulo_ventas && (
              <button
                type="button"
                className="sales-module-nav-btn"
                onClick={onOpenVentasModal}
                title="Acceso al Módulo de Ventas ERP para Empleados"
              >
                <Briefcase size={16} />
                <span>Módulo Ventas ERP</span>
              </button>
            )}

            {/* Badge de usuario */}
            <div className="user-session-badge">
              <User size={15} />
              <span>{currentUser.nombre}</span>
              <span className={`user-role-tag ${currentUser.tipo}`}>
                {currentUser.tipo === 'empleado' ? 'Empleado' : 'Cliente'}
              </span>
            </div>

            {/* Botón cerrar sesión */}
            <button
              type="button"
              className="logout-nav-btn"
              onClick={onLogout}
              title="Cerrar Sesión"
            >
              <LogOut size={14} />
              <span>Salir</span>
            </button>
          </>
        ) : (
          /* Si no ha iniciado sesión */
          <>
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
          </>
        )}
      </div>
    </header>
  );
};
