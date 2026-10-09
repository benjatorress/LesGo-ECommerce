import React, { useState } from 'react';
import { Mail, MapPin, Send, MessageCircle } from 'lucide-react';

export const ContactView: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '38px', color: '#0F172A' }}>
          Contáctanos
        </h1>
        <p style={{ fontSize: '15px', color: '#64748B', marginTop: '6px' }}>
          ¿Buscas un set específico, tienes consultas de envío o necesitas soporte? Estamos aquí para ayudarte.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.3fr', gap: '32px' }}>
        {/* Canales de Contacto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={18} color="#E52521" />
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#94A3B8' }}>CORREO ELECTRÓNICO</span>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>contacto@lesgo.cl</p>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={18} color="#10B981" />
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#94A3B8' }}>WHATSAPP SOPORTE</span>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>+56 9 8765 4321</p>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={18} color="#0284C7" />
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#94A3B8' }}>TIENDA PRINCIPAL</span>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>Av. Los Bloques 1234, Santiago</p>
            </div>
          </div>
        </div>

        {/* Formulario de Mensaje */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '30px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>Envíanos un mensaje directo</h3>

          {submitted ? (
            <div style={{ padding: '24px', background: '#ECFDF5', borderRadius: '14px', color: '#065F46', textAlign: 'center', fontWeight: 700 }}>
              ¡Muchas gracias! Hemos recibido tu mensaje y te responderemos en breve. 🧱
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Nombre</label>
                  <input
                    type="text"
                    required
                    defaultValue="Benjamín"
                    style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Correo</label>
                  <input
                    type="email"
                    required
                    defaultValue="benja@lesgo.cl"
                    style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Mensaje</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Escribe tu consulta aquí..."
                  style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                className="hero-primary-btn"
                style={{ justifyContent: 'center', marginTop: '6px' }}
              >
                <span>Enviar Consulta</span>
                <Send size={15} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
