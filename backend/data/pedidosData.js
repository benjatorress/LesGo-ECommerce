/**
 * Datos mock que replican las tablas 'Pedido' y 'Detalle_Pedido' del modelo de BD.
 *
 * Pedido:         id_pedido (PK), id_cliente (FK), fecha_pedido, monto_total, estado
 * Detalle_Pedido: id_detalle_pedido (PK), id_pedido (FK), id_producto (FK), cantidad, precio_unitario
 *
 * Estados del pedido: 'recibida' -> 'pagada' -> 'enviada' -> 'entregada'
 * Nota: precio_unitario es el precio al momento de la compra (snapshot), no el actual del catálogo.
 */

export const ESTADOS_PEDIDO = ['recibida', 'pagada', 'enviada', 'entregada'];

export const PEDIDOS = [
  // --- Cliente 1: Valentina Soto (cliente@lesgo.cl) ---
  { id_pedido: 1, id_cliente: 1, fecha_pedido: '2026-10-12', monto_total: 89990,  estado: 'entregada' },
  { id_pedido: 2, id_cliente: 1, fecha_pedido: '2026-10-20', monto_total: 54990,  estado: 'recibida' },
  { id_pedido: 4, id_cliente: 1, fecha_pedido: '2026-10-24', monto_total: 104970, estado: 'enviada' },
  { id_pedido: 5, id_cliente: 1, fecha_pedido: '2026-09-28', monto_total: 229990, estado: 'entregada' },

  // --- Cliente 2: Felipe Gómez (felipe@lesgo.cl) ---
  { id_pedido: 3, id_cliente: 2, fecha_pedido: '2026-10-18', monto_total: 169990, estado: 'pagada' },
  { id_pedido: 6, id_cliente: 2, fecha_pedido: '2026-10-22', monto_total: 69980,  estado: 'enviada' },
  { id_pedido: 7, id_cliente: 2, fecha_pedido: '2026-10-02', monto_total: 24990,  estado: 'entregada' }
];

export const DETALLE_PEDIDO = [
  { id_detalle_pedido: 1, id_pedido: 1, id_producto: 'lego-city-station',      cantidad: 1, precio_unitario: 89990 },
  { id_detalle_pedido: 2, id_pedido: 2, id_producto: 'lego-ninjago-dragon',    cantidad: 1, precio_unitario: 54990 },
  { id_detalle_pedido: 3, id_pedido: 3, id_producto: 'lego-star-wars-atat',    cantidad: 1, precio_unitario: 169990 },
  { id_detalle_pedido: 4, id_pedido: 4, id_producto: 'lego-ninjago-dragon',    cantidad: 1, precio_unitario: 54990 },
  { id_detalle_pedido: 5, id_pedido: 4, id_producto: 'lego-city-jungle',       cantidad: 2, precio_unitario: 24990 },
  { id_detalle_pedido: 6, id_pedido: 5, id_producto: 'lego-batmobile-tumbler', cantidad: 1, precio_unitario: 229990 },
  { id_detalle_pedido: 7, id_pedido: 6, id_producto: 'lego-movie-ultrakatty',  cantidad: 2, precio_unitario: 34990 },
  { id_detalle_pedido: 8, id_pedido: 7, id_producto: 'lego-city-jungle',       cantidad: 1, precio_unitario: 24990 }
];