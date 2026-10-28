import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products';
import { getProductosApi, type FilterParams } from './api';

beforeEach(() => {
  vi.stubEnv('VITE_CATALOG_SOURCE', 'local');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('usa PRODUCTS por defecto sin red ni mutaciones de los fixtures', async () => {
  vi.stubEnv('VITE_CATALOG_SOURCE', undefined);
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  const products = await getProductosApi();
  expect(products).toEqual(PRODUCTS.map(product => ({ ...product, inventorySource: 'mock' })));
  expect(products[0]).not.toBe(PRODUCTS[0]);
  expect(fetchMock).not.toHaveBeenCalled();
});

const filterCases: { filters: FilterParams; ids: string[] }[] = [
  { filters: { categoria: 'City', min_precio: 80000 }, ids: ['lego-city-station'] },
  { filters: { max_precio: 30000 }, ids: ['lego-city-jungle'] },
  { filters: { min_piezas: 1200, max_piezas: 1300 }, ids: ['lego-star-wars-atat'] },
  { filters: { edad: 'adults' }, ids: ['lego-batmobile-tumbler'] },
  { filters: { edad: 'teens' }, ids: ['lego-city-station', 'lego-star-wars-atat', 'lego-city-jungle'] },
  { filters: { categoria: 'City', edad: 'kids', max_piezas: 100 }, ids: ['lego-city-jungle'] },
  { filters: { search: ' 60157 ' }, ids: ['lego-city-jungle'] },
  { filters: { search: 'batman inexistente' }, ids: [] }
];

it.each(filterCases)('conserva filtros locales: $filters', async ({ filters, ids }) => {
  const products = await getProductosApi(filters);
  expect(products.map(product => product.id)).toEqual(ids);
});

it('modo api conserva la consulta HTTP y los parámetros del catálogo', async () => {
  vi.stubEnv('VITE_CATALOG_SOURCE', 'api');
  const apiProduct = { ...PRODUCTS[0], name: 'Producto recibido de API' };
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true, productos: [apiProduct] }));
  vi.stubGlobal('fetch', fetchMock);

  expect(await getProductosApi({ categoria: 'City', search: '60130' })).toEqual([apiProduct]);
  expect(fetchMock).toHaveBeenCalledWith('/api/productos?categoria=City&search=60130');
});

it('modo api no cambia a PRODUCTS cuando falla el servidor', async () => {
  vi.stubEnv('VITE_CATALOG_SOURCE', 'api');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expect(getProductosApi()).rejects.toThrow('Error HTTP: 503');
});
