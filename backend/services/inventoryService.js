import { PRODUCTOS } from '../data/productosData.js';
import { normalizeProduct, readPath } from '../adapters/inventoryMapper.js';
import { createHttpClient, configuredUrl } from './httpClient.js';
import { AppError } from '../lib/errors.js';

export function createInventoryService(env = process.env, fetchImpl = fetch) {
  const mode = env.INVENTORY_MODE || 'mock';
  if (!['mock', 'http'].includes(mode)) {
    throw new Error('INVENTORY_MODE inválido');
  }
  if (env.NODE_ENV === 'production' && mode === 'mock') {
    throw new Error('Configura Inventario HTTP en producción');
  }
  const fields = JSON.parse(env.INVENTORY_FIELD_MAP || '{}');
  const request = createHttpClient({
    timeout: Number(env.INVENTORY_TIMEOUT_MS || 5000),
    token: env.INVENTORY_API_TOKEN,
    fetchImpl
  });
  const listUrl = mode === 'http'
    ? configuredUrl(env.INVENTORY_API_URL, env.INVENTORY_LIST_PATH)
    : null;
  if (mode === 'http' && !env.INVENTORY_DETAIL_PATH?.includes('{id}')) {
    throw new Error('INVENTORY_DETAIL_PATH requiere {id}');
  }
  return {
    mode,
    async list() {
      if (mode === 'mock') {
        return PRODUCTOS.map(product => ({ ...normalizeProduct(product), inventorySource: 'mock' }));
      }
      const raw = readPath(await request(listUrl), env.INVENTORY_LIST_ROOT);
      if (!Array.isArray(raw)) {
        throw new AppError(502, 'INVENTORY_CONTRACT', 'Formato de catálogo de Inventario inválido.');
      }
      return raw.map(product => ({ ...normalizeProduct(product, fields), inventorySource: 'http' }));
    },
    async get(id) {
      if (typeof id !== 'string' || !id.trim() || ['.', '..'].includes(id) || id.length > 200) {
        throw new AppError(400, 'INVALID_PRODUCT_ID', 'Identificador de producto inválido.');
      }
      let product;
      if (mode === 'mock') {
        product = PRODUCTOS.find(p => p.id === id || p.code === id);
      } else {
        const detailPath = env.INVENTORY_DETAIL_PATH.replace('{id}', encodeURIComponent(id));
        const url = configuredUrl(env.INVENTORY_API_URL, detailPath);
        const response = await request(url, { notFound: true });
        if (response !== null) {
          product = readPath(response, env.INVENTORY_DETAIL_ROOT);
          if (!product) {
            throw new AppError(502, 'INVENTORY_CONTRACT', 'Detalle de Inventario inválido.');
          }
        }
      }
      if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado.');
      }
      return {
        ...normalizeProduct(product, mode === 'http' ? fields : {}),
        inventorySource: mode
      };
    }
  };
}
