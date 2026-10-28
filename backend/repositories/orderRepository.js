import { PEDIDOS, DETALLE_PEDIDO } from '../data/pedidosData.js';
import { AppError } from '../lib/errors.js';

export function createMockOrderRepository({ pedidos = PEDIDOS, detalles = DETALLE_PEDIDO } = {}) {
  const outbox = new Map();
  return {
    mode: 'mock',
    async findByKey(customerId, key) {
      return outbox.get(`${customerId}:${key}`) || null;
    },
    async create(order, lines, event) {
      const existing = outbox.get(`${order.id_cliente}:${event.key}`);
      if (existing) {
        return { ...existing, replay: true };
      }
      const id = Math.max(0, ...pedidos.map(p => p.id_pedido)) + 1;
      const saved = {
        ...order,
        id_pedido: id,
        fecha_pedido: new Date().toISOString().slice(0, 10)
      };
      let detailId = Math.max(0, ...detalles.map(d => d.id_detalle_pedido || 0));
      const rows = lines.map(line => ({
        ...line,
        id_pedido: id,
        id_detalle_pedido: ++detailId
      }));
      pedidos.push(saved);
      detalles.push(...rows);
      const result = { pedido: saved, detalle: rows, event: { ...event, status: 'pending' } };
      outbox.set(`${order.id_cliente}:${event.key}`, result);
      return result;
    },
    async list(customerId) {
      const quantitiesByOrder = new Map();
      for (const line of detalles) {
        const previousQuantity = quantitiesByOrder.get(line.id_pedido) || 0;
        quantitiesByOrder.set(line.id_pedido, previousQuantity + line.cantidad);
      }
      const eventsByOrder = new Map(
        [...outbox.values()].map(result => [result.pedido.id_pedido, result.event])
      );
      return pedidos.filter(p => p.id_cliente === customerId).map(pedido => ({
        ...pedido,
        total_items: quantitiesByOrder.get(pedido.id_pedido) || 0,
        crm_status: eventsByOrder.get(pedido.id_pedido)?.status ?? 'not_registered',
        has_crm_event: eventsByOrder.has(pedido.id_pedido)
      }));
    },
    async get(customerId, orderId) {
      const pedido = pedidos.find(p => p.id_cliente === customerId && p.id_pedido === orderId);
      if (!pedido) {
        return null;
      }
      const event = [...outbox.values()].find(e => e.pedido.id_pedido === orderId)?.event;
      return {
        pedido: { ...pedido },
        detalle: detalles.filter(d => d.id_pedido === orderId),
        event
      };
    },
    async markCrm(orderId, status) {
      const result = [...outbox.values()].find(e => e.pedido.id_pedido === orderId);
      if (result) {
        result.event.status = status;
      }
    }
  };
}

export function createOrderRepository(env = process.env) {
  const mode = env.ORDER_REPOSITORY || 'mock';
  if (mode === 'mock') {
    if (env.NODE_ENV === 'production') {
      throw new Error('Configura persistencia PostgreSQL en producción');
    }
    return createMockOrderRepository();
  }
  if (mode !== 'postgres' || !env.DATABASE_URL || env.DB_ACCESS_ENABLED !== 'true') {
    throw new Error('PostgreSQL requiere DATABASE_URL y DB_ACCESS_ENABLED=true tras autorización');
  }
  let repository;
  async function load() {
    repository ||= import('pg').then(async ({ default: pg }) => {
      const { createPostgresOrderRepository } = await import('./postgresOrderRepository.js');
      const pool = new pg.Pool({
        connectionString: env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 5000
      });
      pool.on('error', () => console.error('Conexión PostgreSQL interrumpida.'));
      return createPostgresOrderRepository(pool);
    });
    return repository;
  }
  const adapter = { mode: 'postgres' };
  for (const name of ['findByKey', 'create', 'list', 'get', 'markCrm']) {
    adapter[name] = async (...args) => {
      try {
        const postgresRepository = await load();
        return await postgresRepository[name](...args);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(503, 'PERSISTENCE_UNAVAILABLE', 'No se pudo acceder al almacenamiento de pedidos.');
      }
    };
  }
  return adapter;
}
