import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { mapCartLine } from '../repositories/cartRepository.js';
import { issueSession } from '../services/sessionService.js';

const line = (overrides = {}) => ({
  id_detalle_car: 10,
  id_producto: '11111111-1111-4111-8111-111111111111',
  cantidad: 2,
  sku: '60130',
  nombre_set: 'Isla de Prisión',
  cant_piezas: 754,
  producto_activo: true,
  precio_venta: '89990.00',
  ...overrides
});

test('mapCartLine: arma el CartItem del frontend con datos de la BD', () => {
  const item = mapCartLine(line());
  assert.equal(item.quantity, 2);
  assert.equal(item.product.id, '11111111-1111-4111-8111-111111111111');
  assert.equal(item.product.name, 'Isla de Prisión');
  assert.equal(item.product.code, '60130');
  assert.equal(item.product.price, 89990);
  assert.equal(item.product.pieces, 754);
  assert.ok(item.product.stock >= item.quantity);
});

test('mapCartLine: omite productos inactivos o sin precio activo en catálogo', () => {
  assert.equal(mapCartLine(line({ producto_activo: false })), null);
  assert.equal(mapCartLine(line({ producto_activo: null })), null);
  assert.equal(mapCartLine(line({ precio_venta: null })), null);
});

async function withServer(carts, work) {
  const server = createApp({ carts }).listen(0);
  try {
    await work(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('PATCH /api/carrito/items/:id: valida entrada y guarda la cantidad del cliente de la sesión', async () => {
  const productId = '11111111-1111-4111-8111-111111111111';
  const calls = [];
  const carts = {
    updateQuantity: async (customerId, id, quantity) => {
      calls.push([customerId, id, quantity]);
      return id === productId ? { id_detalle_car: 10, id_producto: id, cantidad: quantity } : null;
    }
  };
  await withServer(carts, async base => {
    const patch = (id, body, token) => fetch(`${base}/api/carrito/items/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    });
    assert.equal((await patch(productId, { cantidad: 3 })).status, 401);

    const token = issueSession({ id_cliente: 2, nombre: 'Felipe' });
    const ok = await patch(productId, { cantidad: 3 }, token);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).item.cantidad, 3);
    assert.deepEqual(calls, [[2, productId, 3]]);

    for (const cantidad of [0, -1, 1.5, '2', null, 100]) {
      assert.equal((await patch(productId, { cantidad }, token)).status, 400);
    }
    assert.equal((await patch('22222222-2222-4222-8222-222222222222', { cantidad: 1 }, token)).status, 404);
    assert.equal((await patch('lego-city-station', { cantidad: 1 }, token)).status, 404);
    assert.equal((await patch('x'.repeat(201), { cantidad: 1 }, token)).status, 400);
    assert.equal(calls.length, 3);
  });
});

test('GET /api/carrito: exige sesión y consulta el carrito del cliente de la sesión', async () => {
  const requested = [];
  const carts = {
    getByCustomer: async id => {
      requested.push(id);
      return { carrito: { id_carrito: 7 }, items: [mapCartLine(line())], omitidos: [] };
    }
  };
  await withServer(carts, async base => {
    assert.equal((await fetch(`${base}/api/carrito`)).status, 401);

    const token = issueSession({ id_cliente: 2, nombre: 'Felipe' });
    const response = await fetch(`${base}/api/carrito`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.success, true);
    assert.equal(data.items.length, 1);
    assert.deepEqual(requested, [2]);

    const employeeToken = issueSession({ id_empleado: 1 });
    const forbidden = await fetch(`${base}/api/carrito`, { headers: { authorization: `Bearer ${employeeToken}` } });
    assert.equal(forbidden.status, 403);
  });
});
