import type { EstadoEnvio, EstadoPedido, EstadoReclamo } from '../services/pedidosApi';

export const ESTADO_META: Record<EstadoPedido, { label: string; bg: string; color: string }> = {
  recibida:  { label: 'Recibida',  bg: '#FEF9C3', color: '#854D0E' },
  pagada:    { label: 'Pagada',    bg: '#E0F2FE', color: '#0369A1' },
  enviada:   { label: 'Enviada',   bg: '#EDE9FE', color: '#6D28D9' },
  entregada: { label: 'Entregada', bg: '#DCFCE7', color: '#15803D' }
};

export const ESTADO_ENVIO_LABEL: Record<EstadoEnvio, string> = {
  en_transito: 'En tránsito',
  en_reparto: 'En reparto',
  entregado: 'Entregado'
};

export const ESTADO_RECLAMO_META: Record<EstadoReclamo, { label: string; bg: string; color: string }> = {
  ingresado:   { label: 'Ingresado',   bg: '#FEF9C3', color: '#854D0E' },
  en_revision: { label: 'En revisión', bg: '#E0F2FE', color: '#0369A1' },
  resuelto:    { label: 'Resuelto',    bg: '#DCFCE7', color: '#15803D' }
};

// Mantener sincronizado con backend/data/reclamosData.js
export const MOTIVOS_RECLAMO = [
  { id: 'producto_danado',     label: 'Producto dañado' },
  { id: 'producto_incompleto', label: 'Faltan piezas o producto incompleto' },
  { id: 'producto_incorrecto', label: 'Recibí un producto distinto' },
  { id: 'retraso_entrega',     label: 'Retraso en la entrega' },
  { id: 'cobro_incorrecto',    label: 'Cobro incorrecto' },
  { id: 'otro',                label: 'Otro' }
];

export const motivoLabel = (id: string) =>
  MOTIVOS_RECLAMO.find((m) => m.id === id)?.label ?? id;

export const formatCLP = (value: number) => `$${value.toLocaleString('es-CL')}`;

export const formatNumeroOrden = (id: number) => `#LG-${String(id).padStart(4, '0')}`;

/** 'YYYY-MM-DD' -> '24 oct 2026' (sin desfase por zona horaria) */
export const formatFecha = (fecha: string) =>
  new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

/** ISO -> '24 oct 2026, 09:00' */
export const formatFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });