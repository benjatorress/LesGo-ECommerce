import React from 'react';
import { X, Briefcase, TrendingUp, Users, ShoppingBag, CheckCircle, ShieldCheck } from 'lucide-react';
import type { Usuario } from '../services/api';

interface VentasModalProps {
  usuario: Usuario;
  onClose: () => void;
}

export const VentasModal: React.FC<VentasModalProps> = ({ usuario, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '92%' }}
      >
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              background: 'transparent',
              color: '#854D0E',
              padding: '10px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Briefcase size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 900, color: '#E52521', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                ERP LesGo • Sistema de Ventas
              </span>
              <span
                style={{
                  background: '#DCFCE7',
                  color: '#15803D',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ShieldCheck size={12} />
                <span>Acceso Autorizado</span>
              </span>
            </div>
            <h2 className="modal-title" style={{ fontSize: '24px', margin: '4px 0 0 0', color: '#0F172A' }}>
              Módulo de Ventas
            </h2>
          </div>
        </div>

        {/* Ficha del Empleado según Modelo de Base de Datos */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>
              Ficha del Empleado Autenticado
            </span>
            <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
              ID: {usuario.id_empleado || 'EMP-01'} | RUT: {usuario.rut}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '11.5px' }}>Nombre Completo</span>
              <strong style={{ color: '#0F172A' }}>{usuario.nombre_completo}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '11.5px' }}>Correo Corporativo</span>
              <strong style={{ color: '#0F172A' }}>{usuario.email}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '11.5px' }}>Departamento ERP</span>
              <strong style={{ color: '#0F172A' }}>Depto {usuario.id_departamento || 3} (Ventas & Distribución)</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '11.5px' }}>Estado en Sistema</span>
              <span style={{ color: '#16A34A', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={13} /> Activo
              </span>
            </div>
          </div>
        </div>

        {/* Resumen de Métricas del Módulo de Ventas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '14px',
              padding: '12px',
              textAlign: 'center'
            }}
          >
            <div style={{ color: '#E52521', display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <TrendingUp size={20} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A' }}>$1.849.990</div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Ventas del Día</div>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '14px',
              padding: '12px',
              textAlign: 'center'
            }}
          >
            <div style={{ color: '#0284C7', display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <ShoppingBag size={20} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A' }}>23</div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Pedidos Cerrados</div>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '14px',
              padding: '12px',
              textAlign: 'center'
            }}
          >
            <div style={{ color: '#16A34A', display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <Users size={20} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A' }}>48</div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Clientes Asignados</div>
          </div>
        </div>

        {/* Mensaje de confirmación del requerimiento */}
        <div
          style={{
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#1E40AF',
            lineHeight: '1.4'
          }}
        >
          ℹ️ <strong>Permiso de rol validado:</strong> Este módulo ERP está restringido exclusivamente a usuarios de la tabla <code>empleados</code> con estado activo. Los usuarios de tipo <code>cliente</code> solo tienen acceso al catálogo y carrito de compra del E-Commerce.
        </div>

        <button
          type="button"
          className="modal-submit-btn"
          style={{ marginTop: '4px', backgroundColor: '#0F172A', boxShadow: 'none' }}
          onClick={onClose}
        >
          Cerrar Panel de Ventas
        </button>
      </div>
    </div>
  );
};
