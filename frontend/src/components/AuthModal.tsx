import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2, ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import { loginApi, solicitarCambioPasswordApi, type Usuario } from '../services/api';

interface AuthModalProps {
  mode: 'login' | 'register';
  onClose: () => void;
  onSwitchMode: (mode: 'login' | 'register') => void;
  onLoginSuccess?: (usuario: Usuario, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  mode,
  onClose,
  onSwitchMode,
  onLoginSuccess
}) => {
  // Estados para formulario de autenticación
  const [email, setEmail] = useState('vendedor@lesgo.cl');
  const [password, setPassword] = useState('password123');
  const [nombreRegistro, setNombreRegistro] = useState('');

  // Estado para la vista de "¿Olvidaste tu contraseña?"
  const [isForgotView, setIsForgotView] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  // Estados de control de petición y errores
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<{
    title: string;
    description: string;
    reason: string;
  } | null>(null);

  // Limpiar errores al tipear
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  // Manejar submit del formulario de login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errorMessage) setErrorMessage(null);

    // Validación previa local
    if (!email.trim() || !password.trim()) {
      setErrorMessage({
        title: 'Campos incompletos',
        description: 'Por favor ingresa tanto tu correo electrónico como tu contraseña.',
        reason: 'missing_fields'
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginApi({ email, password });

      if (response.success && response.usuario && response.token) {
        // Notificar al componente padre
        if (onLoginSuccess) {
          onLoginSuccess(response.usuario, response.token);
        }
        onClose();
      } else {
        // Manejar tipos de error específicos
        if (response.reason === 'user_inactive') {
          setErrorMessage({
            title: 'Acceso Denegado: Usuario Inactivo',
            description: response.message || 'Tu cuenta de usuario se encuentra inactiva. Por favor contacta con el administrador del ERP o el área de RRHH.',
            reason: 'user_inactive'
          });
        } else if (response.reason === 'invalid_credentials') {
          setErrorMessage({
            title: 'Credenciales Incorrectas',
            description: 'El correo electrónico o la contraseña ingresada no coinciden con los registros del sistema.',
            reason: 'invalid_credentials'
          });
        } else if (response.reason === 'missing_fields') {
          setErrorMessage({
            title: 'Campos Requeridos',
            description: response.message || 'Debe ingresar correo y contraseña.',
            reason: 'missing_fields'
          });
        } else {
          setErrorMessage({
            title: 'Error de Autenticación',
            description: response.message || 'No fue posible iniciar sesión. Inténtalo nuevamente.',
            reason: 'unknown'
          });
        }
      }
    } catch {
      setErrorMessage({
        title: 'Error de Conexión',
        description: 'No se pudo establecer conexión con el servidor. Verifica tu conexión a internet.',
        reason: 'network'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Solicitar recuperación de contraseña
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setIsLoading(true);
    setForgotMessage(null);

    const res = await solicitarCambioPasswordApi(forgotEmail);
    setIsLoading(false);
    setForgotMessage(res.message);
  };

  // Carga rápida de credenciales para evaluadores/profesores
  const setTestAccount = (testEmail: string, testPass: string) => {
    setEmail(testEmail);
    setPassword(testPass);
    setErrorMessage(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Botón Cerrar */}
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {/* =========================================================================
            VISTA: RECUPERAR / CAMBIAR CONTRASEÑA
           ========================================================================= */}
        {isForgotView ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsForgotView(false);
                  setForgotMessage(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748B'
                }}
                title="Volver al inicio de sesión"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="modal-title" style={{ fontSize: '22px', margin: 0 }}>
                Cambiar Contraseña
              </h2>
            </div>

            <p style={{ fontSize: '13.5px', color: '#64748B', lineHeight: '1.5' }}>
              Ingresa el correo corporativo o personal asociado a tu cuenta en <strong>LesGo</strong> para recibir las instrucciones de restablecimiento de contraseña.
            </p>

            {forgotMessage && (
              <div className="modal-alert-success">
                <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Solicitud Enviada</strong>
                  <span>{forgotMessage}</span>
                </div>
              </div>
            )}

            <form className="modal-form" onSubmit={handleForgotSubmit}>
              <div className="modal-input-group">
                <label className="modal-input-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="modal-input"
                  placeholder="ejemplo@lesgo.cl"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="modal-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Enviando enlace...</span>
                  </>
                ) : (
                  <span>Enviar Enlace de Cambio de Contraseña</span>
                )}
              </button>

              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
                onClick={() => {
                  setIsForgotView(false);
                  setForgotMessage(null);
                }}
              >
                Volver a Iniciar Sesión
              </button>
            </form>
          </>
        ) : (
          /* =========================================================================
              VISTA: FORMULARIO PRINCIPAL (LOGIN / REGISTRO)
             ========================================================================= */
          <>
            <div>
              {/* Título */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 900, color: '#E52521', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  LesGo E-Commerce
                </span>
              </div>

              <h2 className="modal-title">
                {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </h2>
            </div>

            <p style={{ fontSize: '13.5px', color: '#64748B' }}>
              {mode === 'login'
                ? 'Ingresa tus credenciales registradas para ingresar a la plataforma.'
                : 'Crea tu cuenta de cliente para realizar pedidos de sets Lego.'}
            </p>

            {/* Banner de Cuentas Rápidas de Prueba para la Evaluación */}
            {mode === 'login' && (
              <div className="modal-test-accounts">
                <span className="modal-test-title">
                  Cuentas para evaluación rápida:
                </span>
                <div className="modal-test-chips">
                  <button
                    type="button"
                    className="modal-test-btn"
                    onClick={() => setTestAccount('vendedor@lesgo.cl', 'password123')}
                    title="Empleado activo con acceso a Ventas ERP"
                  >
                    <span>Empleado Activo</span>
                  </button>
                  <button
                    type="button"
                    className="modal-test-btn"
                    onClick={() => setTestAccount('cliente@lesgo.cl', 'password123')}
                    title="Cliente activo de la tienda"
                  >
                    <span>Cliente Activo</span>
                  </button>
                  <button
                    type="button"
                    className="modal-test-btn"
                    style={{ borderColor: '#FCA5A5', color: '#991B1B' }}
                    onClick={() => setTestAccount('inactivo@lesgo.cl', 'password123')}
                    title="Empleado inactivo para evaluar error 401"
                  >
                    <span>Usuario Inactivo</span>
                  </button>
                </div>
              </div>
            )}

            {/* =========================================================================
                CONTROL DE ERRORES FRONTEND (INDICACIÓN VISUAL CLARA)
               ========================================================================= */}
            {errorMessage && (
              <div className="modal-alert-error" role="alert">
                {errorMessage.reason === 'user_inactive' ? (
                  <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#DC2626' }} />
                ) : (
                  <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#DC2626' }} />
                )}
                <div>
                  <strong>{errorMessage.title}</strong>
                  <span>{errorMessage.description}</span>
                </div>
              </div>
            )}

            {/* Formulario */}
            <form className="modal-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <div className="modal-input-group">
                  <label className="modal-input-label">Nombre Completo</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Ej. Juan Pérez"
                    value={nombreRegistro}
                    onChange={(e) => setNombreRegistro(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Título y campo Correo */}
              <div className="modal-input-group">
                <label className="modal-input-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="modal-input"
                  placeholder="correo@lesgo.cl"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Título y campo Contraseña */}
              <div className="modal-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="modal-input-label">Contraseña</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="modal-forgot-link"
                      onClick={() => {
                        setForgotEmail(email);
                        setIsForgotView(true);
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  className="modal-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                className="modal-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Validando credenciales...</span>
                  </>
                ) : (
                  <span>
                    {mode === 'login' ? 'Entrar a LesGo' : 'Registrarme'}
                  </span>
                )}
              </button>
            </form>

            {/* Selector de modo Login / Registro */}
            <div style={{ textAlign: 'center', fontSize: '13px', color: '#64748B', marginTop: '6px' }}>
              {mode === 'login' ? (
                <span>
                  ¿Aún no tienes cuenta?{' '}
                  <button
                    type="button"
                    style={{ color: '#E52521', fontWeight: 800, textDecoration: 'underline' }}
                    onClick={() => {
                      setErrorMessage(null);
                      onSwitchMode('register');
                    }}
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
                    onClick={() => {
                      setErrorMessage(null);
                      onSwitchMode('login');
                    }}
                  >
                    Inicia sesión aquí
                  </button>
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
