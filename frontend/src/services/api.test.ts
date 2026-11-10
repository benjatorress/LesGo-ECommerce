import { afterEach, expect, it, vi } from 'vitest';
import { getProductosApi } from './api';
import type { Product } from '../data/products';

const apiProduct: Product = {
  id: '1',
  name: 'Downtown',
  category: 'City',
  theme: 'City',
  price: 70000,
  formattedPrice: '$70.000',
  pieces: 2010,
  age: '',
  code: '60380-1',
  image: '/product-placeholder.svg',
  stock: 7,
  inventorySource: 'postgres'
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('siempre consulta GET /api/productos y devuelve los productos del backend', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json({ success: true, productos: [apiProduct] })
  );
  vi.stubGlobal('fetch', fetchMock);

  expect(await getProductosApi({ categoria: 'City', search: '60380' })).toEqual([apiProduct]);
  expect(fetchMock).toHaveBeenCalledWith('/api/productos?categoria=City&search=60380');
});

it('no usa datos locales cuando falla el servidor', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

  await expect(getProductosApi()).rejects.toThrow('Error HTTP: 503');
});

it('envía todos los filtros activos como query params', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json({ success: true, productos: [] })
  );
  vi.stubGlobal('fetch', fetchMock);

  await getProductosApi({
    min_precio: 70000,
    max_precio: 400000,
    min_piezas: 100,
    max_piezas: 2000,
    edad: 'all',
    search: '  x '
  });

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/productos?min_precio=70000&max_precio=400000&min_piezas=100&max_piezas=2000&search=x'
  );
});
