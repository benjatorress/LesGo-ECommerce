import React from 'react';
import type { EstadoPedido } from '../services/pedidosApi';
import { ESTADO_META } from '../utils/orderFormat';

export const OrderStatusBadge: React.FC<{ estado: EstadoPedido }> = ({ estado }) => {
  const meta = ESTADO_META[estado];
  return (
    <span className="order-status-badge" style={{ backgroundColor: meta.bg, color: meta.color }}>
      <span className="order-status-dot" />
      {meta.label}
    </span>
  );
};