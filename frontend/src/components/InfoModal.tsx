import React from 'react';
import { X, Sparkles, Mail, MapPin, Phone } from 'lucide-react';

interface InfoModalProps {
  type: 'nosotros' | 'contacto';
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ type, onClose }) => {
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

        {type === 'nosotros' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles color="#E52521" size={24} />
              <h2 className="modal-title">Sobre LesGo</h2>
            </div>
            <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6 }}>
              <strong>LesGo</strong> es la tienda especializada en sets de bloques coleccionables, ediciones especiales y clásicos de Lego. Nacimos con la pasión de llevar la creatividad y diversión a constructores de todas las edades.
            </p>
            <div style={{ background: '#F1F5F9', padding: '14px', borderRadius: '14px', fontSize: '13px', color: '#334155' }}>
              🧱 <strong>100% Sets Originales y Sellados</strong><br/>
              🚀 <strong>Despachos rápidos a todo el país</strong><br/>
              🛡️ <strong>Garantía y soporte garantizado LesGo</strong>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail color="#E52521" size={24} />
              <h2 className="modal-title">Contáctanos</h2>
            </div>
            <p style={{ fontSize: '14px', color: '#64748B' }}>
              ¿Tienes dudas con un pedido o buscas un set especial? Nuestro equipo de soporte está listo para ayudarte:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={16} color="#E52521" />
                <span>contacto@lesgo.cl</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={16} color="#E52521" />
                <span>+56 9 8765 4321</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={16} color="#E52521" />
                <span>Av. Los Bloques 1234, Santiago, Chile</span>
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          className="modal-submit-btn"
          onClick={onClose}
        >
          Entendido
        </button>
      </div>
    </div>
  );
};
