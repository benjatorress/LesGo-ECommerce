import React from 'react';
import { X } from 'lucide-react';

interface AuthModalProps {
  mode: 'login' | 'register';
  onClose: () => void;
  onSwitchMode: (mode: 'login' | 'register') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  mode,
  onClose,
  onSwitchMode
}) => {
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        <h2 className="modal-title">
          {mode === 'login' ? 'Iniciar Sesión en LesGo' : 'Crear Cuenta en LesGo'}
        </h2>

        <p style={{ fontSize: '14px', color: '#64748B' }}>
          {mode === 'login'
            ? 'Ingresa tus credenciales para acceder a tus sets favoritos y pedidos.'
            : 'Únete al club LesGo para recibir ofertas exclusivas y novedades de Lego.'}
        </p>

        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          {mode === 'register' && (
            <div className="modal-input-group">
              <label className="modal-input-label">Nombre Completo</label>
              <input
                type="text"
                className="modal-input"
                placeholder="Ej. Juan Pérez"
                defaultValue="Juan Pérez"
              />
            </div>
          )}

          <div className="modal-input-group">
            <label className="modal-input-label">Correo Electrónico</label>
            <input
              type="email"
              className="modal-input"
              placeholder="correo@ejemplo.com"
              defaultValue="usuario@lesgo.cl"
            />
          </div>

          <div className="modal-input-group">
            <label className="modal-input-label">Contraseña</label>
            <input
              type="password"
              className="modal-input"
              placeholder="••••••••"
              defaultValue="12345678"
            />
          </div>

          <button
            type="submit"
            className="modal-submit-btn"
            onClick={onClose}
          >
            {mode === 'login' ? 'Entrar a LesGo' : 'Registrarme'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '13px', color: '#64748B', marginTop: '6px' }}>
          {mode === 'login' ? (
            <span>
              ¿Aún no tienes cuenta?{' '}
              <button
                type="button"
                style={{ color: '#E52521', fontWeight: 800, textDecoration: 'underline' }}
                onClick={() => onSwitchMode('register')}
              >
                Regístrate aquí
              </button>
            </span>
          ) : (
            <span>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                style={{ color: '#E52521', fontWeight: 800, textDecoration: 'underline' }}
                onClick={() => onSwitchMode('login')}
              >
                Inicia sesión aquí
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
