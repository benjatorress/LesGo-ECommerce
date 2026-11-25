import { AppError } from '../lib/errors.js';

// Un intento está "vivo" mientras pueda convertirse en pago: es lo que el
// índice parcial ecom_pago_pedido_abierto_idx limita a uno por pedido.
const OPEN_STATES = ['pendiente', 'abierta'];
// Estados desde los que no se debe retroceder: 'pagada' es definitivo y
// 'revision' espera conciliación manual de un monto que no cuadra.
const LOCKED_STATES = ['pagada', 'revision'];
const FAILABLE_STATES = ['expirada', 'fallida'];

const METHODS = [
  'createAttempt',
  'findOpenByOrder',
  'findByOrder',
  'findBySession',
  'markPaid',
  'markFailed',
  'insertFromWebhook'
];

function requireSessionId(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new AppError(422, 'PAYMENT_SESSION_REQUIRED', 'La sesión de pago es obligatoria.');
  }
  return sessionId;
}

function requireAmount(monto) {
  const value = Number(monto);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(422, 'INVALID_PAYMENT_AMOUNT', 'Monto de pago inválido.');
  }
  return value;
}

/**
 * `monto` vuelve como string desde NUMERIC y `pagado_en` como Date desde
 * TIMESTAMPTZ; se normalizan para que los servicios comparen números y la API
 * devuelva ISO 8601.
 */
export function normalizePago(row) {
  if (!row) {
    return null;
  }
  return {
    ...row,
    monto: Number(row.monto),
    pagado_en: row.pagado_en ? new Date(row.pagado_en).toISOString() : null
  };
}

/**
 * Repositorio en memoria para desarrollo y tests. Guarda `id_cliente` porque no
 * hay join posible; en PostgreSQL ese dato sale de `ecom_pedido`.
 */
export function createMockPaymentRepository() {
  const pagos = [];
  let nextId = 1;
  const findIndexBySession = sessionId => pagos.findIndex(p => p.stripe_session_id === sessionId);
  const openByOrder = idPedido => pagos.find(
    p => p.id_pedido === idPedido && OPEN_STATES.includes(p.estado)
  );

  return {
    mode: 'mock',

    async createAttempt({ idPedido, sessionId, monto, idCliente }) {
      requireSessionId(sessionId);
      const existingSession = findIndexBySession(sessionId);
      if (existingSession !== -1) {
        return normalizePago(pagos[existingSession]);
      }
      const open = openByOrder(idPedido);
      if (open) {
        return normalizePago(open);
      }
      const row = {
        id_pago: nextId++,
        id_pedido: idPedido,
        stripe_session_id: sessionId,
        estado: 'abierta',
        monto: requireAmount(monto),
        pagado_en: null,
        id_cliente: idCliente ?? null
      };
      pagos.push(row);
      return normalizePago(row);
    },

    async findOpenByOrder(idPedido) {
      return normalizePago(openByOrder(idPedido));
    },

    async findByOrder(idPedido) {
      const rows = pagos.filter(p => p.id_pedido === idPedido);
      return normalizePago(rows.at(-1));
    },

    async findBySession(sessionId) {
      return normalizePago(pagos[findIndexBySession(sessionId)]);
    },

    async markPaid({ sessionId, amountTotal }) {
      requireSessionId(sessionId);
      const index = findIndexBySession(sessionId);
      if (index === -1) {
        return { transitioned: false, pago: null, reason: 'not_found' };
      }
      const pago = pagos[index];
      if (pago.estado === 'pagada') {
        return { transitioned: false, pago: normalizePago(pago), reason: 'already_paid' };
      }
      if (amountTotal !== undefined && amountTotal !== null && Number(pago.monto) !== Number(amountTotal)) {
        pago.estado = 'revision';
        pago.pagado_en = null;
        console.error(
          `[pagos] Monto no coincide para ${sessionId}: cobrado ${amountTotal}, esperado ${pago.monto}.`
        );
        return {
          transitioned: false,
          pago: normalizePago(pago),
          reason: 'amount_mismatch'
        };
      }
      pago.estado = 'pagada';
      pago.pagado_en = new Date();
      return { transitioned: true, pago: normalizePago(pago) };
    },

    async markFailed({ sessionId, estado }) {
      requireSessionId(sessionId);
      if (!FAILABLE_STATES.includes(estado)) {
        throw new AppError(422, 'INVALID_PAYMENT_STATE', 'Estado de pago inválido.');
      }
      const index = findIndexBySession(sessionId);
      if (index === -1) {
        return { updated: false, pago: null };
      }
      const pago = pagos[index];
      if (LOCKED_STATES.includes(pago.estado)) {
        return { updated: false, pago: normalizePago(pago) };
      }
      pago.estado = estado;
      return { updated: true, pago: normalizePago(pago) };
    },

    async insertFromWebhook({ idPedido, sessionId, monto }) {
      requireSessionId(sessionId);
      const existing = findIndexBySession(sessionId);
      if (existing !== -1) {
        return normalizePago(pagos[existing]);
      }
      const row = {
        id_pago: nextId++,
        id_pedido: idPedido,
        stripe_session_id: sessionId,
        estado: 'pendiente',
        monto: requireAmount(monto),
        pagado_en: null,
        id_cliente: null
      };
      pagos.push(row);
      return normalizePago(row);
    }
  };
}

/**
 * Implementación PostgreSQL. Sin `id_cliente` ni `created_at` en la tabla: el
 * cliente sale del join con `ecom_pedido` y el orden de intentos de `id_pago`.
 */
export function createPostgresPaymentRepository(pool) {
  const withClient = async work => {
    const client = await pool.connect();
    try {
      return await work(client);
    } finally {
      client.release();
    }
  };

  async function findOpenByOrder(client, idPedido) {
    const { rows } = await client.query(
      `SELECT * FROM ecommerce_ventas.ecom_pago
       WHERE id_pedido = $1 AND estado IN ('pendiente','abierta')
       ORDER BY id_pago DESC LIMIT 1`,
      [idPedido]
    );
    return normalizePago(rows[0]);
  }

  async function findBySession(client, sessionId) {
    const { rows } = await client.query(
      `SELECT p.*, o.id_cliente
       FROM ecommerce_ventas.ecom_pago p
       JOIN ecommerce_ventas.ecom_pedido o ON o.id_pedido = p.id_pedido
       WHERE p.stripe_session_id = $1`,
      [sessionId]
    );
    return normalizePago(rows[0]);
  }

  function translate(error) {
    // 23503 = FK violada: el pedido no existe (o no es visible para esta BD).
    if (error.code === '23503') {
      return new AppError(404, 'ORDER_NOT_FOUND', 'El pedido del pago no existe.');
    }
    // 42P01 = tabla inexistente: falta aplicar el DDL de ecom_pago.
    if (error.code === '42P01') {
      return new AppError(
        503,
        'SCHEMA_NOT_READY',
        'Falta la tabla ecommerce_ventas.ecom_pago. Revisa el SQL versionado.'
      );
    }
    return error;
  }

  return {
    mode: 'postgres',

    async createAttempt({ idPedido, sessionId, monto }) {
      requireSessionId(sessionId);
      return withClient(async client => {
        try {
          const { rows } = await client.query(
            `INSERT INTO ecommerce_ventas.ecom_pago (id_pedido, stripe_session_id, estado, monto)
             VALUES ($1, $2, 'abierta', $3) RETURNING *`,
            [idPedido, sessionId, requireAmount(monto)]
          );
          return normalizePago(rows[0]);
        } catch (error) {
          // 23505 = carrera con otra request (índice parcial o el UNIQUE de la
          // sesión). Se devuelve el intento que ganó en vez de crear otro.
          if (error.code !== '23505') {
            throw translate(error);
          }
          const open = await findOpenByOrder(client, idPedido);
          if (open) {
            return open;
          }
          const same = await findBySession(client, sessionId);
          if (same) {
            return same;
          }
          throw translate(error);
        }
      });
    },

    findOpenByOrder: idPedido => withClient(client => findOpenByOrder(client, idPedido)),

    findByOrder: idPedido => withClient(async client => {
      const { rows } = await client.query(
        `SELECT * FROM ecommerce_ventas.ecom_pago
         WHERE id_pedido = $1 ORDER BY id_pago DESC LIMIT 1`,
        [idPedido]
      );
      return normalizePago(rows[0]);
    }),

    findBySession: sessionId => withClient(client => findBySession(client, sessionId)),

    /**
     * Transición a `pagada` idempotente y conciliación de monto en la misma
     * transacción. Devuelve `transitioned: true` sólo la primera vez, que es lo
     * que el webhook usa para disparar el CRM una única vez.
     */
    markPaid: ({ sessionId, amountTotal }) => {
      requireSessionId(sessionId);
      return withClient(async client => {
        await client.query('BEGIN');
        try {
          const { rows } = await client.query(
            `SELECT * FROM ecommerce_ventas.ecom_pago
             WHERE stripe_session_id = $1 FOR UPDATE`,
            [sessionId]
          );
          const current = rows[0];
          if (!current) {
            await client.query('ROLLBACK');
            return { transitioned: false, pago: null, reason: 'not_found' };
          }
          if (current.estado === 'pagada') {
            await client.query('ROLLBACK');
            return { transitioned: false, pago: normalizePago(current), reason: 'already_paid' };
          }

          const cobrado = amountTotal === undefined || amountTotal === null
            ? null
            : Number(amountTotal);
          if (cobrado !== null && Number(current.monto) !== cobrado) {
            const { rows: marcado } = await client.query(
              `UPDATE ecommerce_ventas.ecom_pago SET estado = 'revision'
               WHERE stripe_session_id = $1 AND estado <> 'pagada' RETURNING *`,
              [sessionId]
            );
            await client.query('COMMIT');
            console.error(
              `[pagos] Monto no coincide para ${sessionId}: cobrado ${cobrado}, esperado ${current.monto}.`
            );
            return {
              transitioned: false,
              pago: normalizePago(marcado[0] || current),
              reason: 'amount_mismatch'
            };
          }

          const { rows: pagado } = await client.query(
            `UPDATE ecommerce_ventas.ecom_pago SET estado = 'pagada', pagado_en = NOW()
             WHERE stripe_session_id = $1 AND estado <> 'pagada' RETURNING *`,
            [sessionId]
          );
          if (!pagado[0]) {
            // Otra transacción ganó la carrera: no se repite el efecto.
            await client.query('ROLLBACK');
            return { transitioned: false, pago: normalizePago(current), reason: 'already_paid' };
          }
          await client.query(
            `UPDATE ecommerce_ventas.ecom_pedido SET estado = 'Pagada'
             WHERE id_pedido = $1 AND estado = 'Pendiente'`,
            [pagado[0].id_pedido]
          );
          await client.query('COMMIT');
          return { transitioned: true, pago: normalizePago(pagado[0]) };
        } catch (error) {
          await client.query('ROLLBACK');
          throw translate(error);
        }
      });
    },

    markFailed: ({ sessionId, estado }) => {
      requireSessionId(sessionId);
      if (!FAILABLE_STATES.includes(estado)) {
        return Promise.reject(
          new AppError(422, 'INVALID_PAYMENT_STATE', 'Estado de pago inválido.')
        );
      }
      return withClient(async client => {
        const { rows } = await client.query(
          `UPDATE ecommerce_ventas.ecom_pago SET estado = $2
           WHERE stripe_session_id = $1 AND estado NOT IN ('pagada','revision')
           RETURNING *`,
          [sessionId, estado]
        );
        return { updated: Boolean(rows[0]), pago: normalizePago(rows[0]) };
      });
    },

    async insertFromWebhook({ idPedido, sessionId, monto }) {
      requireSessionId(sessionId);
      return withClient(async client => {
        try {
          const { rows } = await client.query(
            `INSERT INTO ecommerce_ventas.ecom_pago (id_pedido, stripe_session_id, estado, monto)
             VALUES ($1, $2, 'pendiente', $3) RETURNING *`,
            [idPedido, sessionId, requireAmount(monto)]
          );
          return normalizePago(rows[0]);
        } catch (error) {
          if (error.code !== '23505') {
            throw translate(error);
          }
          const existing = await findBySession(client, sessionId);
          if (existing) {
            return existing;
          }
          throw translate(error);
        }
      });
    }
  };
}

async function createPoolFromUrl(connectionString) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000
  });
  pool.on('error', () => console.error('Conexión PostgreSQL interrumpida (pagos).'));
  return pool;
}

export function createPaymentRepository(env = process.env) {
  const mode = env.PAYMENT_REPOSITORY || 'mock';
  if (mode === 'mock') {
    if (env.NODE_ENV === 'production') {
      throw new Error('Configura persistencia PostgreSQL de pagos en producción');
    }
    return createMockPaymentRepository();
  }

  const useSharedPool = Boolean(env.DB_HOST);
  if (mode !== 'postgres' || env.DB_ACCESS_ENABLED !== 'true' ||
      (!useSharedPool && !env.DATABASE_URL)) {
    throw new Error(
      'Pagos PostgreSQL requiere DB_HOST (o DATABASE_URL) y DB_ACCESS_ENABLED=true tras autorización'
    );
  }

  let repository;
  async function load() {
    repository ||= (async () => {
      const pool = useSharedPool
        ? (await import('../config/db.js')).pool
        : await createPoolFromUrl(env.DATABASE_URL);
      return createPostgresPaymentRepository(pool);
    })();
    return repository;
  }

  const adapter = { mode: 'postgres' };
  for (const name of METHODS) {
    adapter[name] = async (...args) => {
      try {
        const postgresRepository = await load();
        return await postgresRepository[name](...args);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(
          503,
          'PAYMENT_PERSISTENCE_UNAVAILABLE',
          'No se pudo acceder al almacenamiento de pagos.'
        );
      }
    };
  }
  return adapter;
}
