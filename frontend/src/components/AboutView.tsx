import React from 'react';
import { Sparkles, Shield, Heart, Award, ArrowRight } from 'lucide-react';

interface AboutViewProps {
  onGoToCatalog: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onGoToCatalog }) => {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '36px' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FEF2F2', color: '#E52521', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 800 }}>
          <Sparkles size={14} />
          <span>CONOCE LA HISTORIA DE LESGO</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '42px', color: '#0F172A' }}>
          La pasión por construir sin límites
        </h1>
        <p style={{ fontSize: '16px', color: '#64748B', maxWidth: '640px', lineHeight: 1.6 }}>
          En <strong>LesGo</strong> creemos que cada bloque tiene el poder de inspirar a creadores, niños y coleccionistas. Somos la tienda especializada en sets originales, ediciones difíciles de encontrar y clásicos legendarios.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={20} color="#E52521" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>100% Originales</h3>
          <p style={{ fontSize: '13.5px', color: '#64748B', lineHeight: 1.5 }}>
            Todos nuestros sets son importados directamente y vienen con sellos oficiales de fábrica.
          </p>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="#0284C7" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Garantía Total</h3>
          <p style={{ fontSize: '13.5px', color: '#64748B', lineHeight: 1.5 }}>
            Embalaje reforzado para asegurar que cada caja de colección llegue en perfecto estado.
          </p>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={20} color="#10B981" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Comunidad Constructora</h3>
          <p style={{ fontSize: '13.5px', color: '#64748B', lineHeight: 1.5 }}>
            Miles de fanáticos y familias en todo Chile ya disfrutan de armar con LesGo.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <button
          type="button"
          onClick={onGoToCatalog}
          className="hero-primary-btn"
          style={{ display: 'inline-flex', margin: '0 auto' }}
        >
          <span>Ir a Explorar el Catálogo</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
};
