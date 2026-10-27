/**
 * Mock de reclamos de clientes sobre sus pedidos.
 * estado: 'ingresado' | 'en_revision' | 'resuelto'
 */
export const MOTIVOS_RECLAMO = [
  { id: 'producto_danado',     label: 'Producto dañado' },
  { id: 'producto_incompleto', label: 'Faltan piezas o producto incompleto' },
  { id: 'producto_incorrecto', label: 'Recibí un producto distinto' },
  { id: 'retraso_entrega',     label: 'Retraso en la entrega' },
  { id: 'cobro_incorrecto',    label: 'Cobro incorrecto' },
  { id: 'otro',                label: 'Otro' }
];

export const RECLAMOS = [
  {
    id_reclamo: 1,
    id_pedido: 1,
    id_cliente: 1,
    motivo: 'retraso_entrega',
    descripcion: 'El pedido llegó dos días después de la fecha estimada que indicaba el courier.',
    estado: 'en_revision',
    fecha_creacion: '2026-10-18'
  }
];