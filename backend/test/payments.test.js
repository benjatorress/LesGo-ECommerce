import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAKE_SIGNATURE,
  buildLineItems,
  createStripeGateway,
  toStripeAmount
} from '../services/paymentService.js';
import {
  createMockPaymentRepository,
  createPaymentRepository,
  createPostgresPaymentRepository
} from '../repositories/paymentRepository.js';
import { createMockOrderRepository } from '../repositories/orderRepository.js';
import { createInventoryService } from '../services/inventoryService.js';
import { createCrmAdapter } from '../services/crmService.js';
import { createStripeWebhookService } from '../services/stripeWebhookService.js';
import { createOrder } from '../services/orderService.js';
import { createApp } from '../app.js';

function fakeStripe() {
  const calls = [];
  const retrieved = [];
  return {
    calls,
    retrieved,
    checkout: {
      sessions: {
        async create(params, options) {
          calls.push({ params, options });
          return {
            id: 'cs_test_injected',
            url: 'https://checkout.stripe.com/c/pay/cs_test_injected',
            expires_at: 1893456000
          };
        },
        async retrieve(sessionId) {
          retrieved.push(sessionId);
          return {
            id: sessionId,
            status: 'open',
            url: `https://checkout.stripe.com/c/pay/${sessionId}`,
            payment_status: 'unpaid',
            amount_total: null
          };
        }
      }
    },
    webhooks: {
      constructEvent(body, signature, secret) {
        if (signature !== 'good-signature') {
          throw new Error('No signatures found matching the expected signature for payload');
        }
        return { type: 'checkout.session.completed', secret, size: body.length };
      }
    }
  };
}

test('toStripeAmount: CLP es de cero decimales y nunca se multiplica por 100', () => {
  assert.deepEqual(toStripeAmount(89990, 'clp'), { amount: 89990, currency: 'clp' });
  assert.deepEqual(toStripeAmount('89990.00', 'CLP'), { amount: 89990, currency: 'clp' });
  assert.deepEqual(toStripeAmount(89990.4, 'clp'), { amount: 89990, currency: 'clp' });
  assert.deepEqual(toStripeAmount(89990.6, 'clp'), { amount: 89991, currency: 'clp' });
});

test('toStripeAmount: las monedas con decimales usan centavos', () => {
  assert.deepEqual(toStripeAmount(89990, 'usd'), { amount: 8999000, currency: 'usd' });
  assert.deepEqual(toStripeAmount(1.5, 'usd'), { amount: 150, currency: 'usd' });
});

test('toStripeAmount: rechaza montos no cobrables', () => {
  for (const bad of [0, -1, -89990, NaN, Infinity, -Infinity, 'abc', '', null, undefined]) {
    assert.throws(
      () => toStripeAmount(bad, 'clp'),
      { status: 422, code: 'INVALID_PAYMENT_AMOUNT' },
      `monto ${String(bad)} debería ser rechazado`
    );
  }
});

test('buildLineItems: una línea por producto cuando la suma cuadra con el total', () => {
  const items = buildLineItems({
    idPedido: 12,
    monto: 179980,
    currency: 'clp',
    lineas: [{ nombre: '  Set City  ', precio_unitario: 89990, cantidad: 2 }]
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 2);
  assert.deepEqual(items[0].price_data, {
    currency: 'clp',
    unit_amount: 89990,
    product_data: { name: 'Set City' }
  });
});

test('buildLineItems: varias líneas se mantienen si suman el total', () => {
  const items = buildLineItems({
    idPedido: 12,
    monto: 120000,
    currency: 'clp',
    lineas: [
      { nombre: 'Set City', precio_unitario: 70000, cantidad: 1 },
      { nombre: 'Set Technic', precio_unitario: 50000, cantidad: 1 }
    ]
  });

  assert.equal(items.length, 2);
  assert.equal(items[1].price_data.product_data.name, 'Set Technic');
});

test('buildLineItems: cae a una sola línea con el total exacto si no cuadra', () => {
  const items = buildLineItems({
    idPedido: 12,
    monto: 100000,
    currency: 'clp',
    lineas: [{ nombre: 'Set City', precio_unitario: 89990, cantidad: 1 }]
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 1);
  assert.equal(items[0].price_data.unit_amount, 100000);
  assert.equal(items[0].price_data.product_data.name, 'Pedido #12');
});

test('buildLineItems: sin líneas o con líneas inválidas usa el total del pedido', () => {
  const casos = [
    undefined,
    [],
    [{ nombre: '', precio_unitario: 1000, cantidad: 1 }],
    [{ nombre: 'Set City', precio_unitario: 1000, cantidad: 0 }],
    [{ nombre: 'Set City', precio_unitario: 0, cantidad: 1 }]
  ];
  for (const lineas of casos) {
    const items = buildLineItems({ idPedido: 7, monto: 5000, currency: 'clp', lineas });
    assert.equal(items.length, 1);
    assert.equal(items[0].price_data.unit_amount, 5000);
    assert.equal(items[0].price_data.product_data.name, 'Pedido #7');
  }
});

test('buildLineItems: propaga el monto inválido del pedido', () => {
  assert.throws(
    () => buildLineItems({ idPedido: 7, monto: 0, currency: 'clp', lineas: [] }),
    { status: 422, code: 'INVALID_PAYMENT_AMOUNT' }
  );
});

test('createStripeGateway: rechaza PAYMENT_MODE desconocido', () => {
  assert.throws(() => createStripeGateway({ PAYMENT_MODE: 'paypal' }), /PAYMENT_MODE/);
});

test('createStripeGateway: exige STRIPE_SECRET_KEY en modo stripe', () => {
  assert.throws(() => createStripeGateway({ PAYMENT_MODE: 'stripe' }), /STRIPE_SECRET_KEY/);
});

test('gateway disabled: arranca sin credenciales y responde 503 al cobrar', async () => {
  const gateway = createStripeGateway({});
  assert.equal(gateway.mode, 'disabled');
  await assert.rejects(
    () => gateway.createCheckoutSession({ idPedido: 1, monto: 1000 }),
    { status: 503, code: 'PAYMENTS_DISABLED' }
  );
});

test('gateway disabled: el webhook responde 503', () => {
  const gateway = createStripeGateway({});
  assert.throws(
    () => gateway.constructEvent(Buffer.from('{}'), 'cualquiera'),
    { status: 503, code: 'PAYMENTS_DISABLED' }
  );
});

test('gateway fake: sesión determinista con la metadata del pedido', async () => {
  const gateway = createStripeGateway({
    PAYMENT_MODE: 'fake',
    STRIPE_CURRENCY: 'clp',
    APP_BASE_URL: 'http://localhost:5173/'
  });

  const session = await gateway.createCheckoutSession({
    idPedido: 12,
    idCliente: 3,
    monto: 89990,
    currency: 'clp',
    lineas: [{ nombre: 'Set City', precio_unitario: 89990, cantidad: 1 }]
  });

  assert.equal(session.sessionId, 'cs_test_12');
  assert.match(session.url, /^https:\/\/checkout\.stripe\.test\//);
  assert.deepEqual(session.metadata, {
    id_pedido: '12',
    monto: '89990',
    id_cliente: '3'
  });
  assert.ok(session.expiresAt);
});

test('gateway fake: valida el monto antes de simular la sesión', async () => {
  const gateway = createStripeGateway({ PAYMENT_MODE: 'fake' });
  await assert.rejects(
    () => gateway.createCheckoutSession({ idPedido: 1, monto: 0 }),
    { status: 422, code: 'INVALID_PAYMENT_AMOUNT' }
  );
});

test('gateway fake: constructEvent exige la firma ficticia y un body JSON', () => {
  const gateway = createStripeGateway({ PAYMENT_MODE: 'fake' });

  assert.deepEqual(
    gateway.constructEvent(Buffer.from('{"type":"checkout.session.completed"}'), FAKE_SIGNATURE),
    { type: 'checkout.session.completed' }
  );
  assert.throws(
    () => gateway.constructEvent(Buffer.from('{}'), null),
    { status: 400, code: 'INVALID_SIGNATURE' }
  );
  assert.throws(
    () => gateway.constructEvent(Buffer.from('{}'), 'otra-firma'),
    { status: 400, code: 'INVALID_SIGNATURE' }
  );
  assert.throws(
    () => gateway.constructEvent(Buffer.from('no-es-json'), FAKE_SIGNATURE),
    { status: 400, code: 'INVALID_SIGNATURE' }
  );
  assert.throws(
    () => gateway.constructEvent(Buffer.from('null'), FAKE_SIGNATURE),
    { status: 400, code: 'INVALID_SIGNATURE' }
  );
});

test('gateway stripe: crea la sesión con metadata, moneda, URLs e idempotencia', async () => {
  const stripe = fakeStripe();
  const gateway = createStripeGateway({
    PAYMENT_MODE: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    STRIPE_CURRENCY: 'clp',
    APP_BASE_URL: 'http://localhost:5173'
  }, stripe);

  const session = await gateway.createCheckoutSession({
    idPedido: 12,
    idCliente: 3,
    customerEmail: 'cliente@lesgo.cl',
    monto: 179980,
    lineas: [{ nombre: 'Set City', precio_unitario: 89990, cantidad: 2 }],
    idempotencyKey: 'clave-123'
  });

  assert.equal(stripe.calls.length, 1);
  const { params, options } = stripe.calls[0];
  assert.equal(params.mode, 'payment');
  // Stripe ya no acepta payment_method_types en Checkout Sessions
  assert.equal('payment_method_types' in params, false);
  assert.equal(params.client_reference_id, '12');
  assert.equal(params.customer_email, 'cliente@lesgo.cl');
  assert.equal(params.metadata.id_pedido, '12');
  assert.equal(params.metadata.id_cliente, '3');
  assert.equal(params.metadata.monto, '179980');
  assert.equal(params.line_items.length, 1);
  assert.equal(params.line_items[0].price_data.unit_amount, 89990);
  assert.equal(params.line_items[0].quantity, 2);
  assert.equal(
    params.success_url,
    'http://localhost:5173/?view=checkout-success&session_id={CHECKOUT_SESSION_ID}'
  );
  assert.equal(params.cancel_url, 'http://localhost:5173/?view=checkout&pago=cancelado');
  assert.deepEqual(options, { idempotencyKey: 'clave-123' });

  assert.equal(session.sessionId, 'cs_test_injected');
  assert.equal(session.url, 'https://checkout.stripe.com/c/pay/cs_test_injected');
  assert.equal(session.expiresAt, new Date(1893456000 * 1000).toISOString());
});

test('gateway stripe: omite customer_email e Idempotency-Key cuando no se entregan', async () => {
  const stripe = fakeStripe();
  const gateway = createStripeGateway({
    PAYMENT_MODE: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x'
  }, stripe);

  await gateway.createCheckoutSession({ idPedido: 5, monto: 1000 });

  const { params, options } = stripe.calls[0];
  assert.equal('customer_email' in params, false);
  assert.equal(options, undefined);
  assert.equal('id_cliente' in params.metadata, false);
});

test('gateway stripe: falla si Stripe no devuelve id y url', async () => {
  const gateway = createStripeGateway({
    PAYMENT_MODE: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x'
  }, {
    checkout: { sessions: { create: async () => ({ id: 'cs_sin_url' }) } },
    webhooks: { constructEvent: () => ({}) }
  });

  await assert.rejects(
    () => gateway.createCheckoutSession({ idPedido: 9, monto: 1000 }),
    { status: 502, code: 'PAYMENT_SESSION_FAILED' }
  );
});

test('gateway stripe: constructEvent delega en el SDK y traduce la firma inválida', () => {
  const gateway = createStripeGateway({
    PAYMENT_MODE: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x'
  }, fakeStripe());

  const event = gateway.constructEvent(Buffer.from('{"type":"x"}'), 'good-signature');
  assert.equal(event.type, 'checkout.session.completed');
  assert.equal(event.secret, 'whsec_x');

  assert.throws(
    () => gateway.constructEvent(Buffer.from('{}'), 'firma-mala'),
    { status: 400, code: 'INVALID_SIGNATURE' }
  );
  assert.throws(
    () => gateway.constructEvent(Buffer.from('{}'), null),
    { status: 400, code: 'INVALID_SIGNATURE' }
  );
});

test('gateway stripe: sin STRIPE_WEBHOOK_SECRET el webhook responde 503', () => {
  const gateway = createStripeGateway({
    PAYMENT_MODE: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_x'
  }, fakeStripe());

  assert.throws(
    () => gateway.constructEvent(Buffer.from('{}'), 'good-signature'),
    { status: 503, code: 'WEBHOOK_NOT_CONFIGURED' }
  );
});

// ---------------------------------------------------------------------------
// Repositorio de pagos
// ---------------------------------------------------------------------------

function fakePago(overrides = {}) {
  return {
    id_pago: 1,
    id_pedido: 10,
    stripe_session_id: 'cs_test_10',
    estado: 'abierta',
    monto: '89990.00',
    pagado_en: null,
    ...overrides
  };
}

function createFakePool(handler) {
  const state = { queries: [], released: 0 };
  state.client = {
    query: async (sql, params) => {
      const text = sql.trim();
      state.queries.push({ sql: text, params });
      return handler(text, params, state);
    },
    release: () => { state.released += 1; }
  };
  state.pool = { connect: async () => state.client };
  return state;
}

function esControl(sql) {
  return sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK';
}

test('createPaymentRepository: mock por defecto y postgres exige autorización de BD', () => {
  assert.equal(createPaymentRepository({}).mode, 'mock');
  assert.throws(
    () => createPaymentRepository({ NODE_ENV: 'production' }),
    /persistencia PostgreSQL de pagos/
  );
  assert.throws(
    () => createPaymentRepository({ PAYMENT_REPOSITORY: 'postgres' }),
    /DB_ACCESS_ENABLED/
  );
});

test('createPaymentRepository: el adaptador postgres expone todos los métodos sin conectar', () => {
  const repo = createPaymentRepository({
    PAYMENT_REPOSITORY: 'postgres',
    DB_ACCESS_ENABLED: 'true',
    DB_HOST: '127.0.0.1'
  });
  assert.equal(repo.mode, 'postgres');
  for (const name of [
    'createAttempt', 'findOpenByOrder', 'findByOrder', 'findBySession',
    'markPaid', 'markFailed', 'insertFromWebhook'
  ]) {
    assert.equal(typeof repo[name], 'function', `falta ${name}`);
  }
});

test('mock: createAttempt abre el intento y reutiliza el abierto del mismo pedido', async () => {
  const repo = createMockPaymentRepository();

  const first = await repo.createAttempt({
    idPedido: 10, sessionId: 'cs_1', monto: 89990, idCliente: 3
  });
  assert.equal(first.estado, 'abierta');
  assert.equal(first.monto, 89990);
  assert.equal(first.id_cliente, 3);

  const sameOrder = await repo.createAttempt({ idPedido: 10, sessionId: 'cs_2', monto: 89990 });
  assert.equal(sameOrder.id_pago, first.id_pago);
  assert.equal(sameOrder.stripe_session_id, 'cs_1');

  const sameSession = await repo.createAttempt({ idPedido: 10, sessionId: 'cs_1', monto: 89990 });
  assert.equal(sameSession.id_pago, first.id_pago);
});

test('mock: createAttempt valida sesión y monto', async () => {
  const repo = createMockPaymentRepository();
  await assert.rejects(
    () => repo.createAttempt({ idPedido: 1, sessionId: '', monto: 100 }),
    { status: 422, code: 'PAYMENT_SESSION_REQUIRED' }
  );
  await assert.rejects(
    () => repo.createAttempt({ idPedido: 1, sessionId: 'cs_x', monto: 0 }),
    { status: 422, code: 'INVALID_PAYMENT_AMOUNT' }
  );
});

test('mock: el intento abierto sólo se libera cuando el anterior termina', async () => {
  const repo = createMockPaymentRepository();
  await repo.createAttempt({ idPedido: 10, sessionId: 'cs_1', monto: 1000 });
  await repo.markFailed({ sessionId: 'cs_1', estado: 'expirada' });
  await repo.createAttempt({ idPedido: 10, sessionId: 'cs_2', monto: 1000 });

  const open = await repo.findOpenByOrder(10);
  assert.equal(open.stripe_session_id, 'cs_2');
  assert.equal((await repo.findByOrder(10)).stripe_session_id, 'cs_2');
  assert.equal(await repo.findOpenByOrder(11), null);
});

test('mock: markPaid transiciona una sola vez y deja pagado_en', async () => {
  const repo = createMockPaymentRepository();
  await repo.createAttempt({ idPedido: 10, sessionId: 'cs_1', monto: 89990 });

  const first = await repo.markPaid({ sessionId: 'cs_1', amountTotal: 89990 });
  assert.equal(first.transitioned, true);
  assert.equal(first.pago.estado, 'pagada');
  assert.ok(first.pago.pagado_en);

  const second = await repo.markPaid({ sessionId: 'cs_1', amountTotal: 89990 });
  assert.equal(second.transitioned, false);
  assert.equal(second.reason, 'already_paid');
});

test('mock: markPaid con monto distinto deja revision sin pagado_en', async () => {
  const repo = createMockPaymentRepository();
  await repo.createAttempt({ idPedido: 10, sessionId: 'cs_1', monto: 89990 });

  const result = await repo.markPaid({ sessionId: 'cs_1', amountTotal: 1 });
  assert.equal(result.transitioned, false);
  assert.equal(result.reason, 'amount_mismatch');
  assert.equal(result.pago.estado, 'revision');
  assert.equal(result.pago.pagado_en, null);
});

test('mock: markPaid sin fila local informa not_found', async () => {
  const repo = createMockPaymentRepository();
  const result = await repo.markPaid({ sessionId: 'cs_inexistente', amountTotal: 1000 });
  assert.equal(result.transitioned, false);
  assert.equal(result.reason, 'not_found');
  assert.equal(result.pago, null);
});

test('mock: markFailed no retrocede un pago confirmado ni acepta estados inválidos', async () => {
  const repo = createMockPaymentRepository();
  await repo.createAttempt({ idPedido: 10, sessionId: 'cs_1', monto: 1000 });
  await repo.markPaid({ sessionId: 'cs_1', amountTotal: 1000 });

  const blocked = await repo.markFailed({ sessionId: 'cs_1', estado: 'expirada' });
  assert.equal(blocked.updated, false);
  assert.equal(blocked.pago.estado, 'pagada');

  await assert.rejects(
    () => repo.markFailed({ sessionId: 'cs_1', estado: 'pagada' }),
    { status: 422, code: 'INVALID_PAYMENT_STATE' }
  );
});

test('mock: insertFromWebhook crea en pendiente y es idempotente por sesión', async () => {
  const repo = createMockPaymentRepository();
  const created = await repo.insertFromWebhook({ idPedido: 10, sessionId: 'cs_w', monto: 5000 });
  assert.equal(created.estado, 'pendiente');

  const again = await repo.insertFromWebhook({ idPedido: 10, sessionId: 'cs_w', monto: 5000 });
  assert.equal(again.id_pago, created.id_pago);
});

test('postgres: markPaid transiciona pago y pedido en la misma transacción', async () => {
  const row = fakePago();
  const state = createFakePool(sql => {
    if (esControl(sql)) return { rows: [] };
    if (sql.startsWith('SELECT')) return { rows: [row] };
    if (sql.startsWith('UPDATE') && sql.includes('ecom_pago')) {
      return { rows: [{ ...row, estado: 'pagada', pagado_en: new Date('2026-11-14T18:00:00Z') }] };
    }
    return { rows: [] };
  });
  const repo = createPostgresPaymentRepository(state.pool);

  const result = await repo.markPaid({ sessionId: 'cs_test_10', amountTotal: 89990 });

  assert.equal(result.transitioned, true);
  assert.equal(result.pago.estado, 'pagada');
  assert.equal(result.pago.pagado_en, '2026-11-14T18:00:00.000Z');
  assert.equal(result.pago.monto, 89990);

  const sqls = state.queries.map(q => q.sql);
  assert.ok(sqls.includes('BEGIN'));
  assert.ok(sqls.includes('COMMIT'));
  assert.ok(!sqls.includes('ROLLBACK'));
  assert.ok(sqls.some(s => s.includes('FOR UPDATE')));
  assert.ok(sqls.some(s => s.startsWith('UPDATE ecommerce_ventas.ecom_pago')));
  assert.ok(sqls.some(s => s.startsWith('UPDATE ecommerce_ventas.ecom_pedido')));
  assert.equal(state.released, 1);
});

test('postgres: segundo markPaid no repite la transición del pedido', async () => {
  const row = fakePago({ estado: 'pagada', pagado_en: new Date('2026-11-14T18:00:00Z') });
  const state = createFakePool(sql => {
    if (esControl(sql)) return { rows: [] };
    if (sql.startsWith('SELECT')) return { rows: [row] };
    return { rows: [] };
  });
  const repo = createPostgresPaymentRepository(state.pool);

  const result = await repo.markPaid({ sessionId: 'cs_test_10', amountTotal: 89990 });

  assert.equal(result.transitioned, false);
  assert.equal(result.reason, 'already_paid');
  const sqls = state.queries.map(q => q.sql);
  assert.ok(!sqls.some(s => s.startsWith('UPDATE ecommerce_ventas.ecom_pedido')));
  assert.ok(sqls.includes('ROLLBACK'));
  assert.equal(state.released, 1);
});

test('postgres: markPaid con monto distinto deja revision y no toca el pedido', async () => {
  const row = fakePago();
  const state = createFakePool(sql => {
    if (esControl(sql)) return { rows: [] };
    if (sql.startsWith('SELECT')) return { rows: [row] };
    if (sql.startsWith('UPDATE') && sql.includes("estado = 'revision'")) {
      return { rows: [{ ...row, estado: 'revision' }] };
    }
    return { rows: [] };
  });
  const repo = createPostgresPaymentRepository(state.pool);

  const result = await repo.markPaid({ sessionId: 'cs_test_10', amountTotal: 1 });

  assert.equal(result.transitioned, false);
  assert.equal(result.reason, 'amount_mismatch');
  assert.equal(result.pago.estado, 'revision');
  assert.equal(result.pago.pagado_en, null);
  const sqls = state.queries.map(q => q.sql);
  assert.ok(sqls.some(s => s.includes("estado = 'revision'")));
  assert.ok(!sqls.some(s => s.startsWith('UPDATE ecommerce_ventas.ecom_pedido')));
  assert.ok(sqls.includes('COMMIT'));
});

test('postgres: un error de BD hace ROLLBACK y libera la conexión', async () => {
  const row = fakePago();
  const state = createFakePool(sql => {
    if (esControl(sql)) return { rows: [] };
    if (sql.startsWith('SELECT')) return { rows: [row] };
    throw new Error('fallo de BD');
  });
  const repo = createPostgresPaymentRepository(state.pool);

  await assert.rejects(() => repo.markPaid({ sessionId: 'cs_test_10', amountTotal: 89990 }));

  const sqls = state.queries.map(q => q.sql);
  assert.ok(sqls.includes('ROLLBACK'));
  assert.ok(!sqls.includes('COMMIT'));
  assert.equal(state.released, 1);
});

test('postgres: createAttempt ante 23505 relee el intento abierto', async () => {
  const existing = fakePago({ id_pago: 7 });
  const state = createFakePool(sql => {
    if (sql.startsWith('INSERT')) {
      const error = new Error('duplicate key value violates unique constraint');
      error.code = '23505';
      throw error;
    }
    if (sql.startsWith('SELECT')) return { rows: [existing] };
    return { rows: [] };
  });
  const repo = createPostgresPaymentRepository(state.pool);

  const pago = await repo.createAttempt({ idPedido: 10, sessionId: 'cs_nueva', monto: 89990 });

  assert.equal(pago.id_pago, 7);
  assert.equal(pago.estado, 'abierta');
  assert.equal(state.released, 1);
});

test('postgres: insertFromWebhook es idempotente por stripe_session_id', async () => {
  const existing = fakePago({ id_pago: 9 });
  const state = createFakePool(sql => {
    if (sql.startsWith('INSERT')) {
      const error = new Error('duplicate key value violates unique constraint');
      error.code = '23505';
      throw error;
    }
    if (sql.startsWith('SELECT')) return { rows: [{ ...existing, id_cliente: 3 }] };
    return { rows: [] };
  });
  const repo = createPostgresPaymentRepository(state.pool);

  const pago = await repo.insertFromWebhook({ idPedido: 10, sessionId: 'cs_test_10', monto: 89990 });

  assert.equal(pago.id_pago, 9);
  assert.equal(pago.id_cliente, 3);
});

test('postgres: la FK violada se traduce a ORDER_NOT_FOUND', async () => {
  const state = createFakePool(sql => {
    if (sql.startsWith('INSERT')) {
      const error = new Error('violates foreign key constraint');
      error.code = '23503';
      throw error;
    }
    return { rows: [] };
  });
  const repo = createPostgresPaymentRepository(state.pool);

  await assert.rejects(
    () => repo.createAttempt({ idPedido: 999, sessionId: 'cs_x', monto: 1000 }),
    { status: 404, code: 'ORDER_NOT_FOUND' }
  );
});

test('postgres: findBySession trae id_cliente del pedido y normaliza el monto', async () => {
  const state = createFakePool(() => ({ rows: [{ ...fakePago(), id_cliente: 3 }] }));
  const repo = createPostgresPaymentRepository(state.pool);

  const pago = await repo.findBySession('cs_test_10');

  assert.equal(pago.id_cliente, 3);
  assert.equal(pago.monto, 89990);
  assert.equal(pago.pagado_en, null);
  assert.ok(state.queries[0].sql.includes('JOIN ecommerce_ventas.ecom_pedido'));
});

test('postgres: markFailed sólo acepta expirada o fallida', async () => {
  const state = createFakePool(() => ({ rows: [] }));
  const repo = createPostgresPaymentRepository(state.pool);

  await assert.rejects(
    () => repo.markFailed({ sessionId: 'cs_x', estado: 'pagada' }),
    { status: 422, code: 'INVALID_PAYMENT_STATE' }
  );
  assert.equal(state.queries.length, 0);
});

/* ------------------------------------------------------------------------- *
 * Task 4: endpoints y webhook
 * ------------------------------------------------------------------------- */

test('retrieveCheckoutSession: disabled 503, fake abierta y stripe delega en el SDK', async () => {
  await assert.rejects(
    () => createStripeGateway({ PAYMENT_MODE: 'disabled' }).retrieveCheckoutSession('cs_1'),
    { status: 503, code: 'PAYMENTS_DISABLED' }
  );

  const fake = await createStripeGateway({ PAYMENT_MODE: 'fake' }).retrieveCheckoutSession('cs_1');
  assert.equal(fake.status, 'open');
  assert.equal(fake.url, 'https://checkout.stripe.test/pay/cs_1');
  assert.equal(fake.paymentStatus, 'unpaid');

  const stripe = fakeStripe();
  const gateway = createStripeGateway({ PAYMENT_MODE: 'stripe', STRIPE_SECRET_KEY: 'sk_test_x' }, stripe);
  const session = await gateway.retrieveCheckoutSession('cs_9');
  assert.equal(session.status, 'open');
  assert.equal(session.url, 'https://checkout.stripe.com/c/pay/cs_9');
  assert.deepEqual(stripe.retrieved, ['cs_9']);
});

const CUSTOMER = { id_cliente: 1, nombre: 'Valentina Soto', email: 'cliente@lesgo.cl' };

const orderRequest = (metodoPago = 'tarjeta') => ({
  items: [{ id_producto: 'lego-city-station', cantidad: 2 }],
  envio: {
    direccion_entrega: 'Calle 1',
    comuna_entrega: 'Centro',
    ciudad_entrega: 'Antofagasta',
    telefono_contacto: '123456789'
  },
  metodo_pago: metodoPago
});

/**
 * App completa con repositorios en memoria. El mock de pagos no conoce los
 * pedidos, así que se emula el `UPDATE ecom_pedido SET estado='Pagada'` que la
 * implementación PostgreSQL hace en la misma transacción de `markPaid`.
 */
function paymentsSetup({ crmFails = false } = {}) {
  const pedidos = [];
  const orders = createMockOrderRepository({ pedidos, detalles: [] });
  const inventory = createInventoryService({ INVENTORY_MODE: 'mock' });
  const paymentRepository = createMockPaymentRepository();
  const markPaid = paymentRepository.markPaid.bind(paymentRepository);
  paymentRepository.markPaid = async (input) => {
    const result = await markPaid(input);
    const pedido = result.transitioned
      ? pedidos.find(p => p.id_pedido === result.pago.id_pedido)
      : null;
    if (pedido?.estado === 'Pendiente') {
      pedido.estado = 'Pagada';
    }
    return result;
  };
  // CRM mock real detrás de un contador: en la creación queda 'mock' (no
  // 'synced'), así el webhook reintenta la sincronización una única vez.
  const crmAdapter = createCrmAdapter({ CRM_MODE: 'mock' });
  const crm = {
    mode: 'mock',
    calls: 0,
    async send(payload, key) {
      this.calls += 1;
      if (crmFails) {
        throw new Error('CRM caído');
      }
      return crmAdapter.send(payload, key);
    }
  };
  const app = createApp({
    orders,
    inventory,
    crm,
    paymentRepository,
    payments: createStripeGateway({ PAYMENT_MODE: 'fake' })
  });
  return { app, orders, crm, pedidos, paymentRepository, inventory };
}

async function seedOrder(setup, { metodoPago = 'tarjeta', key = 'pago-test-key' } = {}) {
  const result = await createOrder({
    body: orderRequest(metodoPago),
    customer: CUSTOMER,
    key,
    inventory: setup.inventory,
    orders: setup.orders,
    crm: setup.crm,
    // Mismo criterio que `postPedido`: con tarjeta el CRM se difiere al webhook.
    deferCrm: metodoPago === 'tarjeta'
  });
  // Sólo interesa el CRM disparado por el webhook, no el de la creación.
  setup.crm.calls = 0;
  return result.pedido;
}

async function withServer(t, app, work) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return work(`http://127.0.0.1:${server.address().port}`);
}

async function loginAs(base, email = 'cliente@lesgo.cl') {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  });
  return response.json();
}

const postSession = (base, token, body) => fetch(`${base}/api/pagos/stripe/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body)
});

const stripeEvent = (type, overrides = {}) => ({
  id: `evt_${type.replaceAll('.', '_')}`,
  type,
  data: {
    object: {
      id: 'cs_test_1',
      payment_status: 'paid',
      amount_total: 179980,
      metadata: { id_pedido: '1', monto: '179980', id_cliente: '1' },
      ...overrides
    }
  }
});

const sendWebhook = (base, event, signature = FAKE_SIGNATURE) => fetch(`${base}/api/webhooks/stripe`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(signature ? { 'stripe-signature': signature } : {})
  },
  body: JSON.stringify(event)
});

test('endpoints: 401 sin sesión, 404 pedido ajeno, 409 método y estado, 201 y reutilización', async t => {
  const setup = paymentsSetup();
  const pedido = await seedOrder(setup);
  const transferencia = await seedOrder(setup, { metodoPago: 'transferencia', key: 'pago-transferencia' });

  await withServer(t, setup.app, async base => {
    const login = await loginAs(base);
    const token = login.token;

    assert.equal((await postSession(base, undefined, { id_pedido: pedido.id_pedido })).status, 401);
    assert.equal((await postSession(base, token, { id_pedido: 'abc' })).status, 400);
    assert.equal((await postSession(base, token, {})).status, 400);
    assert.equal((await postSession(base, token, { id_pedido: 9999 })).status, 404);

    const other = await loginAs(base, 'felipe@lesgo.cl');
    const foreign = await postSession(base, other.token, { id_pedido: pedido.id_pedido });
    assert.equal(foreign.status, 404);

    const notCard = await postSession(base, token, { id_pedido: transferencia.id_pedido });
    assert.equal(notCard.status, 409);
    assert.equal((await notCard.json()).code, 'PAYMENT_METHOD_NOT_SUPPORTED');

    // El body no puede fijar el monto: se ignora y se usa `ecom_pedido.monto_total`.
    const created = await postSession(base, token, { id_pedido: pedido.id_pedido, monto_total: 1 });
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.reutilizada, false);
    assert.equal(body.session.sessionId, `cs_test_${pedido.id_pedido}`);
    assert.equal(body.session.url, `https://checkout.stripe.test/pay/${body.session.sessionId}`);
    assert.equal(body.pago.estado, 'abierta');
    const pago = await setup.paymentRepository.findByOrder(pedido.id_pedido);
    assert.equal(pago.monto, 179980);

    // Segundo intento: reutiliza la sesión abierta en vez de crear otra.
    const reused = await postSession(base, token, { id_pedido: pedido.id_pedido });
    assert.equal(reused.status, 200);
    const reusedBody = await reused.json();
    assert.equal(reusedBody.reutilizada, true);
    assert.equal(reusedBody.session.sessionId, body.session.sessionId);

    // GET del estado propio y 404 para otro cliente.
    const own = await fetch(`${base}/api/pagos/stripe/session/${body.session.sessionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(own.status, 200);
    const ownBody = await own.json();
    assert.equal(ownBody.pago.estado, 'abierta');
    assert.equal(ownBody.pago.monto, 179980);
    assert.equal(ownBody.pago.moneda, 'clp');
    const foreignPayment = await fetch(`${base}/api/pagos/stripe/session/${body.session.sessionId}`, {
      headers: { Authorization: `Bearer ${other.token}` }
    });
    assert.equal(foreignPayment.status, 404);

    // Pedido ya pagado: no se abre otro intento.
    setup.pedidos.find(p => p.id_pedido === pedido.id_pedido).estado = 'Pagada';
    const paid = await postSession(base, token, { id_pedido: pedido.id_pedido });
    assert.equal(paid.status, 409);
    assert.equal((await paid.json()).code, 'ORDER_NOT_PAYABLE');
  });
});

test('endpoints: el gateway recibe las líneas con nombre y el monto del servidor', async t => {
  const setup = paymentsSetup();
  const pedido = await seedOrder(setup);
  const spy = {
    mode: 'spy',
    lastInput: null,
    async createCheckoutSession(input) {
      this.lastInput = input;
      return { sessionId: 'cs_spy_1', url: 'https://checkout.stripe.test/pay/cs_spy_1' };
    },
    async retrieveCheckoutSession() {
      return { status: 'open', url: 'https://checkout.stripe.test/pay/cs_spy_1' };
    }
  };
  const app = createApp({
    orders: setup.orders,
    inventory: setup.inventory,
    crm: setup.crm,
    paymentRepository: setup.paymentRepository,
    payments: spy
  });

  await withServer(t, app, async base => {
    const { token } = await loginAs(base);
    const response = await postSession(base, token, { id_pedido: pedido.id_pedido });
    assert.equal(response.status, 201);
    assert.equal(spy.lastInput.idPedido, pedido.id_pedido);
    assert.equal(spy.lastInput.idCliente, 1);
    assert.equal(spy.lastInput.monto, 179980);
    assert.equal(spy.lastInput.customerEmail, 'cliente@lesgo.cl');
    assert.match(spy.lastInput.idempotencyKey, /^[0-9a-f-]{36}$/);
    assert.deepEqual(spy.lastInput.lineas, [
      { nombre: 'Lego City - Isla de Prisión Costera', cantidad: 2, precio_unitario: 89990 }
    ]);
    const health = await fetch(`${base}/api/health`).then(r => r.json());
    assert.equal(health.payments, 'spy');
    assert.equal(health.paymentPersistence, 'mock');
  });
});

test('webhook: firma inválida 400 y body crudo real', async t => {
  const setup = paymentsSetup();
  await seedOrder(setup);

  await withServer(t, setup.app, async base => {
    const invalid = await sendWebhook(base, stripeEvent('checkout.session.completed'), 'otra-firma');
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, 'INVALID_SIGNATURE');
    const missing = await sendWebhook(base, stripeEvent('checkout.session.completed'), null);
    assert.equal(missing.status, 400);
    // El 200 prueba que `express.raw` corrió antes que `express.json`: el modo
    // fake exige un Buffer con JSON válido dentro.
    const ok = await sendWebhook(base, { id: 'evt_otro', type: 'customer.created', data: {} });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { received: true });
  });
});

const OPEN_PAYMENT = async (setup, pedido) => setup.paymentRepository.createAttempt({
  idPedido: pedido.id_pedido,
  idCliente: 1,
  sessionId: `cs_test_${pedido.id_pedido}`,
  monto: pedido.monto_total
});

test('webhook: completed pagado marca Pagada una sola vez y no duplica el CRM', async t => {
  const setup = paymentsSetup();
  const pedido = await seedOrder(setup);
  await OPEN_PAYMENT(setup, pedido);

  await withServer(t, setup.app, async base => {
    const first = await sendWebhook(base, stripeEvent('checkout.session.completed'));
    assert.equal(first.status, 200);
    assert.equal(setup.pedidos[0].estado, 'Pagada');
    const pago = await setup.paymentRepository.findBySession(`cs_test_${pedido.id_pedido}`);
    assert.equal(pago.estado, 'pagada');
    assert.ok(pago.pagado_en);
    assert.equal(setup.crm.calls, 1);

    const replay = await sendWebhook(base, stripeEvent('checkout.session.completed'));
    assert.equal(replay.status, 200);
    assert.equal(setup.crm.calls, 1, 'el replay no debe repetir la sincronización CRM');
  });
});

test('webhook: completed sin pagar espera, expired deja Pendiente y monto distinto va a revisión', async t => {
  const setup = paymentsSetup();
  const pedido = await seedOrder(setup);

  await withServer(t, setup.app, async base => {
    await OPEN_PAYMENT(setup, pedido);
    const pending = await sendWebhook(base, stripeEvent('checkout.session.completed', { payment_status: 'unpaid' }));
    assert.equal(pending.status, 200);
    assert.equal(setup.pedidos[0].estado, 'Pendiente');

    const mismatch = await sendWebhook(base, stripeEvent('checkout.session.completed', { amount_total: 1 }));
    assert.equal(mismatch.status, 200);
    const revision = await setup.paymentRepository.findBySession(`cs_test_${pedido.id_pedido}`);
    assert.equal(revision.estado, 'revision');
    assert.equal(setup.pedidos[0].estado, 'Pendiente');
    assert.equal(setup.crm.calls, 0);
  });

  // En otra app, `expired` deja el intento cerrado y el pedido sin pagar.
  const expiredSetup = paymentsSetup();
  const expiredPedido = await seedOrder(expiredSetup);
  await OPEN_PAYMENT(expiredSetup, expiredPedido);
  await withServer(t, expiredSetup.app, async base => {
    const expired = await sendWebhook(base, stripeEvent('checkout.session.expired'));
    assert.equal(expired.status, 200);
    const pago = await expiredSetup.paymentRepository.findBySession(`cs_test_${expiredPedido.id_pedido}`);
    assert.equal(pago.estado, 'expirada');
    assert.equal(expiredSetup.pedidos[0].estado, 'Pendiente');
    assert.equal(expiredSetup.crm.calls, 0);
  });
});

test('webhook: inserta el pago desde metadata y falla 500 si faltan datos del pedido', async t => {
  const setup = paymentsSetup();
  const pedido = await seedOrder(setup);

  await withServer(t, setup.app, async base => {
    // El webhook llega antes de que el backend guarde la sesión.
    const inserted = await sendWebhook(base, stripeEvent('checkout.session.async_payment_succeeded', {
      id: `cs_test_${pedido.id_pedido}`
    }));
    assert.equal(inserted.status, 200);
    const pago = await setup.paymentRepository.findBySession(`cs_test_${pedido.id_pedido}`);
    assert.equal(pago.estado, 'pagada');
    assert.equal(pago.monto, 179980);
    assert.equal(setup.pedidos[0].estado, 'Pagada');

    const missing = await sendWebhook(base, stripeEvent('checkout.session.completed', {
      id: 'cs_sin_metadata',
      metadata: {}
    }));
    assert.equal(missing.status, 500);
    assert.equal((await missing.json()).code, 'PAYMENT_METADATA_MISSING');
  });
});

test('pedido pagado: el detalle muestra estado pagada y completa el seguimiento', async t => {
  const setup = paymentsSetup();
  const pedido = await seedOrder(setup);
  await OPEN_PAYMENT(setup, pedido);
  const app = createApp({
    orders: setup.orders,
    inventory: setup.inventory,
    crm: setup.crm,
    paymentRepository: setup.paymentRepository,
    payments: createStripeGateway({ PAYMENT_MODE: 'fake' }),
    pedidoReader: {
      mode: 'mock',
      listByCustomer: idCliente => setup.orders.list(idCliente),
      getByCustomerAndOrderId: (idCliente, idPedido) => setup.orders.get(idCliente, idPedido)
    }
  });

  await withServer(t, app, async base => {
    const { token } = await loginAs(base);
    await sendWebhook(base, stripeEvent('checkout.session.completed'));

    const detail = await fetch(`${base}/api/pedidos/cliente/1/${pedido.id_pedido}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json());

    assert.equal(detail.pedido.estado_dominio, 'Pagada');
    assert.equal(detail.pedido.estado, 'pagada');
    assert.equal(detail.pedido.seguimiento[1].completado, true);
  });
});

test('webhook: el CRM se sincroniza una sola vez al confirmar el pago diferido', async () => {
  const setup = paymentsSetup();
  const pedido = await seedOrder(setup);
  // El pedido nace con el CRM diferido por tarjeta.
  assert.equal((await setup.orders.get(1, pedido.id_pedido)).event.status, 'pending');
  await OPEN_PAYMENT(setup, pedido);

  const service = createStripeWebhookService({
    paymentRepository: setup.paymentRepository,
    orders: setup.orders,
    crm: setup.crm
  });

  const event = stripeEvent('checkout.session.completed');
  const first = await service.handleEvent(event);
  assert.equal(first.transitioned, true);
  assert.equal(await first.crmSync, 'mock');
  assert.equal(setup.crm.calls, 1);
  assert.equal((await setup.orders.get(1, pedido.id_pedido)).event.status, 'mock');

  const replay = await service.handleEvent(event);
  assert.equal(replay.transitioned, false);
  assert.equal(replay.crmSync, null);
  assert.equal(setup.crm.calls, 1);
});

test('webhook: CRM caído deja el pago Pagada, el outbox pending y no falla', async () => {
  const setup = paymentsSetup({ crmFails: true });
  const pedido = await seedOrder(setup);
  await OPEN_PAYMENT(setup, pedido);

  const service = createStripeWebhookService({
    paymentRepository: setup.paymentRepository,
    orders: setup.orders,
    crm: setup.crm
  });

  const result = await service.handleEvent(stripeEvent('checkout.session.completed'));

  assert.equal(result.transitioned, true);
  assert.equal(await result.crmSync, 'pending');
  const pago = await setup.paymentRepository.findBySession(`cs_test_${pedido.id_pedido}`);
  assert.equal(pago.estado, 'pagada');
  assert.equal(setup.pedidos[0].estado, 'Pagada');
  assert.equal((await setup.orders.get(1, pedido.id_pedido)).event.status, 'pending');
});
