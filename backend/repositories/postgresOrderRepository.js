import { AppError } from '../lib/errors.js';

const required = {
  ecom_pedido: [
    'id_pedido', 'id_cliente', 'fecha_pedido', 'monto_total', 'estado',
    'direccion_entrega', 'comuna_entrega', 'ciudad_entrega', 'telefono_contacto',
    'metodo_pago', 'observaciones'
  ],
  ecom_detalle_pedido: ['id_pedido', 'id_producto', 'cantidad', 'precio_unitario'],
  ecom_pedido_outbox: ['id_pedido', 'id_cliente', 'idempotency_key', 'fingerprint', 'payload', 'status', 'updated_at']
};

export function createPostgresOrderRepository(pool) {
  let checked = false;
  async function checkSchema(client) {
    if (checked) {
      return;
    }
    const { rows } = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'ecommerce_ventas' AND table_name = ANY($1::text[])
    `, [Object.keys(required)]);
    for (const [table, columns] of Object.entries(required)) {
      if (columns.some(column => !rows.some(r => r.table_name === table && r.column_name === column))) {
        throw new AppError(503, 'SCHEMA_NOT_READY', 'Esquema de pedidos incompleto. Revisa el SQL versionado antes de habilitar PostgreSQL.');
      }
    }
    const hasType = (table, column, type) => rows.some(row => (
      row.table_name === table && row.column_name === column && row.data_type === type
    ));
    if (!hasType('ecom_detalle_pedido', 'id_producto', 'uuid') ||
        !hasType('ecom_pedido', 'id_cliente', 'integer') ||
        !hasType('ecom_pedido', 'id_pedido', 'integer')) {
      throw new AppError(503, 'SCHEMA_NOT_READY', 'Tipos del esquema de pedidos incompatibles.');
    }
    checked = true;
  }
  const normalize = (order) => ({
    ...order,
    monto_total: Number(order.monto_total),
    fecha_pedido: order.fecha_pedido instanceof Date
      ? order.fecha_pedido.toISOString().slice(0, 10)
      : String(order.fecha_pedido).slice(0, 10)
  });

  async function get(client, customerId, orderId) {
    const { rows } = await client.query(
      'SELECT * FROM ecommerce_ventas.ecom_pedido WHERE id_cliente=$1 AND id_pedido=$2',
      [customerId, orderId]
    );
    if (!rows[0]) {
      return null;
    }
    const details = await client.query(
      'SELECT * FROM ecommerce_ventas.ecom_detalle_pedido WHERE id_pedido=$1', [orderId]
    );
    const events = await client.query(
      'SELECT * FROM ecommerce_ventas.ecom_pedido_outbox WHERE id_pedido=$1', [orderId]
    );
    const event = events.rows[0];
    return {
      pedido: normalize(rows[0]),
      detalle: details.rows.map(line => ({
        ...line,
        precio_unitario: Number(line.precio_unitario)
      })),
      event: event ? {
        key: event.idempotency_key,
        fingerprint: event.fingerprint,
        payload: event.payload,
        status: event.status
      } : null
    };
  }
  async function findByKey(client, customerId, key) {
    const { rows } = await client.query(
      'SELECT id_pedido FROM ecommerce_ventas.ecom_pedido_outbox WHERE id_cliente=$1 AND idempotency_key=$2',
      [customerId, key]
    );
    return rows[0] ? get(client, customerId, rows[0].id_pedido) : null;
  }
  async function withClient(work) {
    const client = await pool.connect();
    try {
      await checkSchema(client);
      return await work(client);
    } finally {
      client.release();
    }
  }
  return {
    mode: 'postgres',
    findByKey: (customerId, key) => withClient(c => findByKey(c, customerId, key)),
    get: (customerId, orderId) => withClient(c => get(c, customerId, orderId)),
    list: (customerId) => withClient(async client => {
      const { rows } = await client.query(
        `SELECT p.*, o.status AS crm_status, (o.id_pedido IS NOT NULL) AS has_crm_event
         FROM ecommerce_ventas.ecom_pedido p
         LEFT JOIN ecommerce_ventas.ecom_pedido_outbox o ON o.id_pedido = p.id_pedido
         WHERE p.id_cliente=$1 ORDER BY p.fecha_pedido DESC, p.id_pedido DESC`,
        [customerId]
      );
      const totals = await client.query(
        `SELECT d.id_pedido, SUM(d.cantidad) AS total_items
         FROM ecommerce_ventas.ecom_detalle_pedido d
         JOIN ecommerce_ventas.ecom_pedido p ON p.id_pedido = d.id_pedido
         WHERE p.id_cliente=$1 GROUP BY d.id_pedido`,
        [customerId]
      );
      const quantitiesByOrder = new Map(
        totals.rows.map(row => [row.id_pedido, Number(row.total_items)])
      );
      return rows.map(order => ({
        ...normalize(order),
        total_items: quantitiesByOrder.get(order.id_pedido) || 0,
        crm_status: order.crm_status ?? 'not_registered'
      }));
    }),
    async create(order, lines, event) {
      return withClient(async client => {
        await client.query('BEGIN');
        try {
          await client.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
            [`${order.id_cliente}:${event.key}`]
          );
          const existing = await findByKey(client, order.id_cliente, event.key);
          if (existing) {
            await client.query('COMMIT');
            return { ...existing, replay: true };
          }
          const { rows } = await client.query(`INSERT INTO ecommerce_ventas.ecom_pedido
            (id_cliente, fecha_pedido, monto_total, estado, direccion_entrega, comuna_entrega, ciudad_entrega, telefono_contacto, metodo_pago, observaciones)
            VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            order.id_cliente,
            order.monto_total,
            order.estado,
            order.direccion_entrega,
            order.comuna_entrega,
            order.ciudad_entrega,
            order.telefono_contacto,
            order.metodo_pago,
            order.observaciones
          ]);
          const id = rows[0].id_pedido;
          for (const line of lines) {
            await client.query(
              'INSERT INTO ecommerce_ventas.ecom_detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES ($1,$2,$3,$4)',
              [id, line.id_producto, line.cantidad, line.precio_unitario]
            );
          }
          await client.query(`INSERT INTO ecommerce_ventas.ecom_pedido_outbox (id_pedido,id_cliente,idempotency_key,fingerprint,payload,status)
            VALUES ($1,$2,$3,$4,$5::jsonb,'pending')`, [id, order.id_cliente, event.key, event.fingerprint, JSON.stringify(event.payload)]);
          const result = await get(client, order.id_cliente, id);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      });
    },
    markCrm: (orderId, status) => withClient(client => client.query(
      'UPDATE ecommerce_ventas.ecom_pedido_outbox SET status=$2, updated_at=NOW() WHERE id_pedido=$1',
      [orderId, status]
    ))
  };
}
