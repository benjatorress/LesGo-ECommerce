import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder } from '../services/orderService.js';
import { createMockOrderRepository } from '../repositories/orderRepository.js';
import { createPostgresOrderRepository } from '../repositories/postgresOrderRepository.js';
import { createInventoryService } from '../services/inventoryService.js';
import { createCrmAdapter } from '../services/crmService.js';
import { createPedidoReadService } from '../services/pedidosService.js';
import { createApp } from '../app.js';

const customer = { id_cliente: 1, nombre: 'Cliente prueba', email: 'test@example.invalid' };
const body = () => ({
  items: [{ id_producto: 'lego-city-station', cantidad: 2 }],
  envio: {
    direccion_entrega: 'Calle 1',
    comuna_entrega: 'Centro',
    ciudad_entrega: 'Antofagasta',
    telefono_contacto: '123456789'
  },
  metodo_pago: 'tarjeta'
});
const dependencies = () => ({
  customer,
  key: 'test-key-123',
  inventory: createInventoryService({ INVENTORY_MODE: 'mock' }),
  orders: createMockOrderRepository({ pedidos: [], detalles: [] }),
  crm: createCrmAdapter({ CRM_MODE: 'mock' })
});

test('pedido válido, precio adulterado ignorado, Pendiente y líneas recuperables', async () => {
  const deps = dependencies();
  const payload = body();
  payload.items[0].precio_unitario = 1;
  payload.monto_total = 1;
  const result = await createOrder({ ...deps, body: payload });
  assert.equal(result.pedido.estado, 'Pendiente');
  assert.equal(result.pedido.monto_total, 179980);
  assert.equal(result.detalle[0].precio_unitario, 89990);
  assert.equal(result.crmStatus, 'mock');
  assert.equal((await deps.orders.get(1, result.pedido.id_pedido)).detalle.length, 1);
});
test('carrito vacío, cantidades inválidas, producto inexistente y stock insuficiente', async () => {
  for (const cantidad of [0, -1, 1.5, '2', null, 10001]) {
    const payload = body();
    payload.items[0].cantidad = cantidad;
    await assert.rejects(createOrder({ ...dependencies(), body: payload }), { status: 400 });
  }
  const emptyCart = { ...body(), items: [] };
  const missingProduct = { ...body(), items: [{ id_producto: 'missing', cantidad: 1 }] };
  const insufficientStock = { ...body(), items: [{ id_producto: 'lego-city-station', cantidad: 6 }] };
  await assert.rejects(createOrder({ ...dependencies(), body: emptyCart }), { status: 400 });
  await assert.rejects(createOrder({ ...dependencies(), body: missingProduct }), { status: 404 });
  await assert.rejects(createOrder({ ...dependencies(), body: insufficientStock }), { status: 409 });
});
test('CRM falla: orden no se pierde; reintentos y concurrencia no duplican pedido', async () => {
  const deps = dependencies();
  deps.crm = {
    mode: 'http',
    send: async () => { throw new Error('offline'); }
  };
  const results = await Promise.all([
    createOrder({ ...deps, body: body() }),
    createOrder({ ...deps, body: body() })
  ]);
  assert.equal(results[0].pedido.id_pedido, results[1].pedido.id_pedido);
  assert.equal(results[0].crmStatus, 'pending');
  assert.equal((await deps.orders.list(1)).length, 1);
  await assert.rejects(createOrder({ ...deps, body: { ...body(), metodo_pago: 'transferencia' } }), { status: 409 });
});
test('producto sin stock e Inventario caído impiden toda escritura', async () => {
  const noStock = async () => ({ id: 'lego-city-station', name: 'Sin stock', stock: 0, price: 100 });
  const unavailable = async () => { throw new Error('Inventario offline'); };
  for (const get of [noStock, unavailable]) {
    const deps = dependencies();
    deps.inventory = { get };
    await assert.rejects(createOrder({ ...deps, body: body() }));
    assert.equal((await deps.orders.list(1)).length, 0);
  }
});
test('CRM HTTP envía datos de cliente, clave idempotente y distingue fallo', async () => {
  let received;
  const env = {
    CRM_MODE: 'http',
    CRM_IDEMPOTENCY_SUPPORTED: 'true',
    CRM_API_URL: 'https://crm.invalid',
    CRM_ORDER_PATH: '/confirmed-contract'
  };
  const adapter = createCrmAdapter(env, async (url, init) => {
    received = init;
    return new Response(null, { status: 204 });
  });
  assert.equal(await adapter.send({ cliente: customer }, 'stable-key'), 'synced');
  assert.equal(JSON.parse(received.body).cliente.id_cliente, 1);
  assert.equal(received.headers['Idempotency-Key'], 'stable-key');
  assert.equal(await createCrmAdapter({ CRM_MODE: 'disabled' }).send({}, 'key'), 'pending');
  assert.throws(() => createCrmAdapter({ ...env, CRM_IDEMPOTENCY_SUPPORTED: 'false' }));
});
test('persistencia falla antes de CRM; no se registra un pedido parcial', async () => {
  const deps = dependencies();
  let sent = false;
  deps.orders.create = async () => { throw new Error('db unavailable'); };
  deps.crm.send = async () => { sent = true; };
  await assert.rejects(createOrder({ ...deps, body: body() }));
  assert.equal(sent, false);
  assert.equal((await deps.orders.list(1)).length, 0);
});

const columns = {
  ecom_pedido: [
    'id_pedido', 'id_cliente', 'fecha_pedido', 'monto_total', 'estado',
    'direccion_entrega', 'comuna_entrega', 'ciudad_entrega', 'telefono_contacto',
    'metodo_pago', 'observaciones'
  ],
  ecom_detalle_pedido: ['id_pedido', 'id_producto', 'cantidad', 'precio_unitario'],
  ecom_pedido_outbox: ['id_pedido', 'id_cliente', 'idempotency_key', 'fingerprint', 'payload', 'status', 'updated_at']
};

function schemaRows() {
  const rows = [];
  for (const [table_name, names] of Object.entries(columns)) {
    for (const column_name of names) {
      let data_type = 'text';
      if (column_name === 'id_producto') data_type = 'uuid';
      if (['id_cliente', 'id_pedido'].includes(column_name)) data_type = 'integer';
      rows.push({ table_name, column_name, data_type });
    }
  }
  return rows;
}

test('PostgreSQL simulado: rollback y release ante error de detalle, sin COMMIT', async () => {
  const queries = [];
  let released = false;
  const client = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('information_schema')) {
        return { rows: schemaRows() };
      }
      if (sql.includes('INSERT INTO ecommerce_ventas.ecom_pedido\n')) {
        return { rows: [{ id_pedido: 1 }] };
      }
      if (sql.startsWith('INSERT INTO ecommerce_ventas.ecom_detalle')) {
        throw new Error('detail error');
      }
      return { rows: [] };
    },
    release: () => { released = true; }
  };
  const repository = createPostgresOrderRepository({ connect: async () => client });
  const order = {
    ...body().envio,
    id_cliente: 1,
    monto_total: 1,
    estado: 'Pendiente',
    metodo_pago: 'tarjeta'
  };
  const lines = [{
    id_producto: '00000000-0000-4000-8000-000000000001',
    cantidad: 1,
    precio_unitario: 1
  }];
  const event = { key: 'test-key-123', fingerprint: 'hash', payload: {} };
  await assert.rejects(repository.create(order, lines, event));
  assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
  assert.ok(!queries.some(q => q.sql === 'COMMIT'));
  assert.ok(queries.find(q => q.sql.startsWith('INSERT INTO ecommerce_ventas.ecom_detalle')).params);
  assert.equal(released, true);
});
test('PostgreSQL simulado rechaza esquema desconocido y libera conexión sin escribir', async () => {
  let released = false;
  const queries = [];
  const client = {
    query: async sql => {
      queries.push(sql);
      return { rows: [] };
    },
    release: () => { released = true; }
  };
  const repository = createPostgresOrderRepository({ connect: async () => client });
  await assert.rejects(repository.list(1), { code: 'SCHEMA_NOT_READY' });
  assert.equal(released, true);
  assert.equal(queries.length, 1);
});

test('servicio de historial consulta pedidos y agrega cantidades de detalle', async () => {
  let received;
  const service = createPedidoReadService({
    query: async (sql, params) => {
      received = { sql, params };
      return {
        rows: [{
          id_pedido: '8',
          id_cliente: '4',
          fecha_pedido: '2026-10-12',
          monto_total: '25981.00',
          estado: 'Pendiente',
          total_items: '2'
        }]
      };
    }
  });

  const rows = await service.listByCustomer(4);

  assert.deepEqual(received.params, [4]);
  assert.match(received.sql, /ecommerce_ventas\.ecom_pedido/);
  assert.match(received.sql, /ecommerce_ventas\.ecom_detalle_pedido/);
  assert.deepEqual(rows, [{
    id_pedido: 8,
    id_cliente: 4,
    fecha_pedido: '2026-10-12',
    monto_total: 25981,
    estado: 'Pendiente',
    total_items: 2,
    crm_status: 'not_registered'
  }]);
});

test('servicio de detalle verifica propiedad y normaliza líneas de ecom_detalle_pedido', async () => {
  const queries = [];
  const service = createPedidoReadService({
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM ecommerce_ventas.ecom_pedido')) {
        return {
          rows: [{
            id_pedido: '8',
            id_cliente: '4',
            fecha_pedido: '2026-10-12',
            monto_total: '25981.00',
            estado: 'Pendiente'
          }]
        };
      }
      return {
        rows: [{
          id_detalle_pedido: '12',
          id_pedido: '8',
          id_producto: '71',
          cantidad: '2',
          precio_unitario: '12990.50'
        }]
      };
    }
  });

  const stored = await service.getByCustomerAndOrderId(4, 8);

  assert.deepEqual(queries.map(query => query.params), [[4, 8], [8]]);
  assert.match(queries[1].sql, /ecommerce_ventas\.ecom_detalle_pedido/);
  assert.match(queries[1].sql, /id_detalle_ped AS id_detalle_pedido/);
  assert.equal(stored.pedido.id_cliente, 4);
  assert.deepEqual(stored.detalle, [{
    id_detalle_pedido: 12,
    id_pedido: 8,
    id_producto: 71,
    cantidad: 2,
    precio_unitario: 12990.5
  }]);
});

test('endpoints: sesión real emitida, POST/GET compartidos, acceso ajeno denegado', async t => {
  const deps = dependencies();
  const app = createApp({
    ...deps,
    pedidoReader: {
      mode: 'mock',
      listByCustomer: idCliente => deps.orders.list(idCliente),
      getByCustomerAndOrderId: (idCliente, idPedido) => deps.orders.get(idCliente, idPedido)
    }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const loginAs = async email => fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  }).then(response => response.json());
  const login = await loginAs('cliente@lesgo.cl');
  const headers = {
    Authorization: `Bearer ${login.token}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': 'endpoint-test-key'
  };
  assert.equal((await fetch(`${base}/pedidos/cliente/1`)).status, 401);
  assert.equal((await fetch(`${base}/pedidos/cliente/2`, { headers })).status, 403);
  const created = await fetch(`${base}/pedidos`, { method: 'POST', headers, body: JSON.stringify(body()) });
  assert.equal(created.status, 201);
  const data = await created.json();
  assert.equal(data.pedido.estado_dominio, 'Pendiente');
  assert.equal(data.pedido.estado, 'recibida');
  const history = await fetch(`${base}/pedidos/cliente/1`, { headers }).then(response => response.json());
  assert.equal(history.pedidos[0].total_items, 2);
  assert.equal(history.pedidos[0].crm.status, 'mock');
  assert.equal(history.pedidos[0].courier, null);
  assert.equal('has_crm_event' in history.pedidos[0], false);
  const detail = await fetch(`${base}/pedidos/cliente/1/${data.pedido.id_pedido}`, { headers }).then(r => r.json());
  assert.equal(detail.pedido.detalle.length, 1);
  assert.equal(detail.pedido.seguimiento[1].completado, false);
  assert.equal(detail.pedido.logistica, null);
  const another = await loginAs('felipe@lesgo.cl');
  const anotherCustomerResponse = await fetch(`${base}/pedidos/cliente/2/${data.pedido.id_pedido}`, {
    headers: { Authorization: `Bearer ${another.token}` }
  });
  assert.equal(anotherCustomerResponse.status, 404);
  const forgedIdentityResponse = await fetch(`${base}/pedidos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body(), id_cliente: 2 })
  });
  assert.equal(forgedIdentityResponse.status, 403);
  assert.equal((await fetch(`${base}/productos/missing`)).status, 404);
  const list = await fetch(`${base}/productos?categoria=City&min_precio=80000`).then(r => r.json());
  assert.equal(list.productos.length, 1);
  assert.equal(list.source, 'mock');

  const syncCart = (quantity, productId = 'lego-city-station') => fetch(`${base}/carrito`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuarioId: 'isolated-test-customer',
      items: [{ product: { id: productId }, quantity }]
    })
  });
  assert.equal((await syncCart(1)).status, 200);
  assert.equal((await syncCart(6)).status, 409);
  assert.equal((await syncCart(0)).status, 400);
  assert.equal((await syncCart(1, 'missing')).status, 404);
});
