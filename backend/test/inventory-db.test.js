import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDbProduct } from '../adapters/inventoryMapper.js';

const row = {
  id_producto: 1,
  sku: '60380-1',
  nombre_set: 'Downtown',
  cant_piezas: 2010,
  activo: true,
  nombre_tema: 'City',
  precio_venta: '70000.00',
  stock: 7
};

test('normalizeDbProduct mapea una fila real de inventario', () => {
  const product = normalizeDbProduct(row);
  assert.equal(product.id, '1');
  assert.equal(product.name, 'Downtown');
  assert.equal(product.code, '60380-1');
  assert.equal(product.category, 'City');
  assert.equal(product.theme, 'City');
  assert.equal(product.price, 70000);
  assert.equal(product.formattedPrice, '$70.000');
  assert.equal(product.pieces, 2010);
  assert.equal(product.stock, 7);
  assert.equal(product.image, '/product-placeholder.svg');
  assert.equal(product.age, '');
  assert.equal(product.inventorySource, 'postgres');
});

test('normalizeDbProduct rechaza precio o stock inválidos', () => {
  assert.throws(() => normalizeDbProduct({ ...row, precio_venta: null }), { status: 502 });
  assert.throws(() => normalizeDbProduct({ ...row, stock: -1 }), { status: 502 });
  assert.throws(() => normalizeDbProduct({ ...row, nombre_set: '' }), { status: 502 });
});

import { createInventoryService } from '../services/inventoryService.js';

const dbRow = {
  id_producto: 1,
  sku: '60380-1',
  nombre_set: 'Downtown',
  cant_piezas: 2010,
  activo: true,
  nombre_tema: 'City',
  precio_venta: '70000.00',
  stock: 7
};

function fakePool({ listRows = [dbRow], detailRows = [dbRow] } = {}) {
  return {
    query: async (sql) => ({ rows: sql.includes('= $1') ? detailRows : listRows })
  };
}

test('modo postgres: lista solo productos del catálogo real', async () => {
  const service = createInventoryService(
    { INVENTORY_MODE: 'postgres', DB_ACCESS_ENABLED: 'true' },
    fetch,
    fakePool()
  );
  const list = await service.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].inventorySource, 'postgres');
});

test('modo postgres: get por id/sku y 404 cuando no existe', async () => {
  const service = createInventoryService(
    { INVENTORY_MODE: 'postgres', DB_ACCESS_ENABLED: 'true' },
    fetch,
    fakePool()
  );
  assert.equal((await service.get('1')).id, '1');
  assert.equal((await service.get('60380-1')).id, '1');

  const empty = createInventoryService(
    { INVENTORY_MODE: 'postgres', DB_ACCESS_ENABLED: 'true' },
    fetch,
    fakePool({ detailRows: [] })
  );
  await assert.rejects(empty.get('missing'), { status: 404 });
});

test('modo postgres sin autorización de BD falla al crear el servicio', () => {
  assert.throws(
    () => createInventoryService({ INVENTORY_MODE: 'postgres', DB_ACCESS_ENABLED: 'false' }, fetch, fakePool()),
    /DB_ACCESS_ENABLED/
  );
});
