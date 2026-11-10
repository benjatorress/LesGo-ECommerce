import { PRODUCTOS } from '../data/productosData.js';
import { normalizeProduct, normalizeDbProduct, readPath } from '../adapters/inventoryMapper.js';
import { createHttpClient, configuredUrl } from './httpClient.js';
import { AppError } from '../lib/errors.js';

export function createInventoryService(env = process.env, fetchImpl = fetch, poolOverride = null) {
  const mode = env.INVENTORY_MODE || 'mock';
  if (!['mock', 'http', 'postgres'].includes(mode)) {
    throw new Error('INVENTORY_MODE inválido');
  }
  if (env.NODE_ENV === 'production' && mode === 'mock') {
    throw new Error('Configura Inventario HTTP en producción');
  }
  if (mode === 'postgres' && env.DB_ACCESS_ENABLED !== 'true') {
    throw new Error('Inventario PostgreSQL requiere DB_ACCESS_ENABLED=true tras autorización');
  }
  let pool;
  const getPool = async () => {
    pool ||= poolOverride || (await import('../config/db.js')).pool;
    return pool;
  };
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
  const BASE_SELECT = `
  SELECT p.id_producto, p.sku, p.nombre_set, p.cant_piezas, p.activo,
         t.nombre_tema,
         c.precio_venta,
         GREATEST(
           COALESCE(s.cantidad_disponible, 0) - COALESCE(s.cantidad_reservada, 0),
           0
         ) AS stock
  FROM inventario.inv_producto p
  JOIN inventario.inv_temas t ON t.id_tema = p.id_tema
  JOIN LATERAL (
    SELECT ec.precio_venta
    FROM ecommerce_ventas.ecom_catalogo ec
    WHERE ec.id_producto = p.id_producto
      AND ec.activo
      AND ec.precio_venta > 0
    ORDER BY ec.id_catalogo DESC
    LIMIT 1
  ) c ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(sb.cantidad_disponible) AS cantidad_disponible,
           SUM(sb.cantidad_reservada) AS cantidad_reservada
    FROM inventario.inv_stock_bodega sb
    WHERE sb.id_producto = p.id_producto
  ) s ON TRUE
  WHERE p.activo
`;
  const LIST_SQL = `${BASE_SELECT} ORDER BY p.id_producto`;
  const DETAIL_SQL = `${BASE_SELECT} AND (p.id_producto::text = $1 OR p.sku = $1) LIMIT 1`;
  return {
    mode,
    async list() {
      if (mode === 'postgres') {
        try {
          const { rows } = await (await getPool()).query(LIST_SQL);
          return rows.map(normalizeDbProduct);
        } catch (error) {
          if (error instanceof AppError) throw error;
          console.error('Error consultando inventario:', error.code, error.message);
          throw new AppError(503, 'INVENTORY_UNAVAILABLE', 'No se pudo consultar Inventario.');
        }
      }
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
      if (mode === 'postgres') {
        try {
          const { rows } = await (await getPool()).query(DETAIL_SQL, [id.trim()]);
          if (!rows[0]) {
            throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado.');
          }
          return normalizeDbProduct(rows[0]);
        } catch (error) {
          if (error instanceof AppError) throw error;
          console.error('Error consultando producto:', error.code, error.message);
          throw new AppError(503, 'INVENTORY_UNAVAILABLE', 'No se pudo consultar Inventario.');
        }
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
