import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryService } from '../services/inventoryService.js';

const env = {
  INVENTORY_MODE: 'http',
  INVENTORY_API_URL: 'https://inventory.invalid',
  INVENTORY_LIST_PATH: '/documented/list',
  INVENTORY_DETAIL_PATH: '/documented/{id}',
  INVENTORY_LIST_ROOT: 'data'
};
const product = {
  id: 'external-contract-fixture',
  name: 'Set',
  price: 10,
  stock: 0,
  categoria: 'City',
  images: ['https://example.com/a.jpg']
};

test('mock explícito: catálogo, categoría, stock e ID/código existente', async () => {
  const service = createInventoryService({ INVENTORY_MODE: 'mock' });
  const list = await service.list();
  assert.ok(list[0].category);
  assert.equal((await service.get(list[0].code)).id, list[0].id);
  await assert.rejects(service.get('missing'), { status: 404 });
});
test('HTTP disponible, normalización, producto sin stock y producto inexistente', async () => {
  const service = createInventoryService(env, async url => (
    Response.json(url.includes('/list') ? { data: [product] } : product)
  ));
  assert.equal((await service.list())[0].category, 'City');
  assert.equal((await service.get(product.id)).stock, 0);
  assert.equal((await service.get(product.id)).image, product.images[0]);
  const missingProduct = createInventoryService(env, async () => new Response('', { status: 404 }));
  await assert.rejects(missingProduct.get('missing'), { status: 404 });
});
test('HTTP conexión, timeout, error HTTP y contrato inválido no usan fallback', async () => {
  const connectionFailure = async () => { throw new Error('internal upstream message'); };
  const httpFailure = async () => new Response('', { status: 500 });
  for (const fetchImpl of [connectionFailure, httpFailure]) {
    await assert.rejects(createInventoryService(env, fetchImpl).list(), { status: 503 });
  }
  const invalidStock = createInventoryService(env, async () => (
    Response.json({ data: [{ ...product, stock: -1 }] })
  ));
  await assert.rejects(invalidStock.list(), { status: 502 });
  const timeoutFetch = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
    setTimeout(resolve, 50);
  });
  const slowService = createInventoryService({ ...env, INVENTORY_TIMEOUT_MS: '5' }, timeoutFetch);
  await assert.rejects(slowService.list(), { status: 503 });
});

test('contrato configurable: roots, campos anidados, atributos técnicos e inactivos', async () => {
  const externalProduct = {
    id_producto: 'fixture-external-id',
    nombre: 'Producto del proveedor simulado',
    precio: 14990,
    existencias: { activas: 7 },
    categoria: { nombre: 'City' },
    active: false,
    specifications: { peso: '200 g', ancho: 30, noAdmitido: { nested: true } }
  };
  const config = {
    ...env,
    INVENTORY_DETAIL_ROOT: 'data.producto',
    INVENTORY_FIELD_MAP: JSON.stringify({
      id: 'id_producto',
      name: 'nombre',
      price: 'precio',
      stock: 'existencias.activas',
      category: 'categoria.nombre'
    })
  };
  const service = createInventoryService(config, async () => (
    Response.json({ data: { producto: externalProduct } })
  ));
  const normalized = await service.get(externalProduct.id_producto);
  assert.equal(normalized.category, 'City');
  assert.equal(normalized.price, 14990);
  assert.equal(normalized.stock, 0);
  assert.equal(normalized.image, '/product-placeholder.svg');
  assert.equal(normalized.inventorySource, 'http');
  assert.deepEqual(normalized.specifications, { peso: '200 g', ancho: 30 });
});
