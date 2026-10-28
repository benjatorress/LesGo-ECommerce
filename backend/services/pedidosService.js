import { pool } from '../config/db.js';

const normalizePedido = (pedido) => ({
  ...pedido,
  id_pedido: Number(pedido.id_pedido),
  id_cliente: Number(pedido.id_cliente),
  monto_total: Number(pedido.monto_total),
  fecha_pedido: pedido.fecha_pedido instanceof Date
    ? pedido.fecha_pedido.toISOString().slice(0, 10)
    : String(pedido.fecha_pedido).slice(0, 10)
});

const normalizeDetalle = (linea) => ({
  ...linea,
  id_detalle_pedido: Number(linea.id_detalle_pedido),
  id_pedido: Number(linea.id_pedido),
  id_producto: Number(linea.id_producto),
  cantidad: Number(linea.cantidad),
  precio_unitario: Number(linea.precio_unitario)
});

export function createPedidoReadService(databasePool) {
  return {
    mode: 'postgres',
    async listByCustomer(idCliente) {
      const { rows } = await databasePool.query(`
        SELECT
          p.id_pedido,
          p.id_cliente,
          p.fecha_pedido,
          p.monto_total,
          p.estado,
          COALESCE(SUM(d.cantidad), 0) AS total_items
        FROM ecommerce_ventas.ecom_pedido p
        LEFT JOIN ecommerce_ventas.ecom_detalle_pedido d
          ON d.id_pedido = p.id_pedido
        WHERE p.id_cliente = $1
        GROUP BY p.id_pedido
        ORDER BY p.fecha_pedido DESC, p.id_pedido DESC
      `, [idCliente]);

      return rows.map(row => ({
        ...normalizePedido(row),
        total_items: Number(row.total_items),
        crm_status: 'not_registered'
      }));
    },
    async getByCustomerAndOrderId(idCliente, idPedido) {
      const { rows } = await databasePool.query(`
        SELECT id_pedido, id_cliente, fecha_pedido, monto_total, estado
        FROM ecommerce_ventas.ecom_pedido
        WHERE id_cliente = $1 AND id_pedido = $2
      `, [idCliente, idPedido]);
      if (!rows[0]) {
        return null;
      }

      const detail = await databasePool.query(`
        SELECT
          id_detalle_ped AS id_detalle_pedido,
          id_pedido,
          id_producto,
          cantidad,
          precio_unitario
        FROM ecommerce_ventas.ecom_detalle_pedido
        WHERE id_pedido = $1
        ORDER BY id_detalle_ped
      `, [idPedido]);

      return {
        pedido: normalizePedido(rows[0]),
        detalle: detail.rows.map(normalizeDetalle)
      };
    }
  };
}

export const pedidoReadService = createPedidoReadService(pool);
