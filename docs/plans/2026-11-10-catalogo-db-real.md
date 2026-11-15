# Catálogo conectado a PostgreSQL real — Plan de implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reemplazar el catálogo simulado (`PRODUCTS` / `INVENTORY_MODE=mock`) por consultas reales a `inventario.inv_producto`, `inventario.inv_temas`, `inventario.inv_stock_bodega` y `ecommerce_ventas.ecom_catalogo`.

**Architecture:** El backend agrega un modo `postgres` a `createInventoryService` que lee productos activos con precio activo y stock agregado. El frontend deja de usar `PRODUCTS` y siempre consume `GET /api/productos`. `CatalogView` elimina el aviso de inventario simulado y el filtro de edad (la BD no tiene ese dato), usa placeholder de imagen y calcula el tope del slider de precio desde el producto más caro recibido.

**Tech Stack:** Node 24 + Express 5 + `pg`, React 18 + Vite + TypeScript, `node:test`.

**Decisiones ya confirmadas con el usuario:**
- Mostrar solo los productos con precio activo en `ecom_catalogo` (hoy 10 de 129).
- Ocultar el filtro de edad.
- Usar `/product-placeholder.svg` para todas las tarjetas.
- El máximo del slider de precio es dinámico: el precio más alto del catálogo recibido.

**NO COMMITEAR NADA.** El usuario pidió explícitamente no crear commits. Se omiten pasos de commit a propósito.

---

## Contexto de la BD real (verificado)

| Tabla | Columnas relevantes |
|---|---|
| `inventario.inv_producto` | `id_producto`, `id_tema`, `sku`, `nombre_set`, `cant_piezas`, `activo` |
| `inventario.inv_temas` | `id_tema`, `nombre_tema` |
| `inventario.inv_stock_bodega` | `id_producto`, `id_bodega`, `cantidad_disponible`, `cantidad_reservada` |
| `ecommerce_ventas.ecom_catalogo` | `id_catalogo`, `id_producto`, `precio_venta`, `activo` |

No existen columnas de edad, descripción ni imagen. Precio activo: 10 productos, rango 70.000–400.000 CLP.

---

## Task 1: Cargar `.env` y arrancar el backend con PostgreSQL

**Files:**
- Modify: `backend/index.js:1`
- Modify: `backend/.env`

**Step 1: Importar dotenv al arrancar**

`backend/index.js` hoy no carga `backend/.env`, por lo que `process.env` queda vacío al ejecutar `node index.js`. Reemplazar la primera línea:

```js
import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 5000;
const app = createApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor LesGo Backend ejecutándose en http://localhost:${port}`);
});
```

**Step 2: Actualizar `backend/.env`**

`ORDER_REPOSITORY=postgres` exige `DATABASE_URL` no vacío (ver `backend/repositories/orderRepository.js:79`). Además `INVENTORY_MODE` debe ser `postgres`. Dejar estas claves exactas (el `#` de la contraseña debe ir como `%23` dentro de la URL):

```dotenv
PORT=5000
NODE_ENV=development
INVENTORY_MODE=postgres
INVENTORY_API_URL=
INVENTORY_LIST_PATH=
INVENTORY_DETAIL_PATH=
INVENTORY_LIST_ROOT=
INVENTORY_DETAIL_ROOT=
INVENTORY_FIELD_MAP={}
INVENTORY_API_TOKEN=
INVENTORY_TIMEOUT_MS=5000
ORDER_REPOSITORY=postgres
DB_ACCESS_ENABLED=true
DB_HOST=ep-royal-glade-ac55fitc-pooler.sa-east-1.aws.neon.tech
DB_PORT=5432
DB_NAME=si2_22026
DB_USER=si2_22026
DB_PASSWORD="SuContrasenaSegura#2026!"
DATABASE_URL=postgresql://si2_22026:SuContrasenaSegura%232026!@ep-royal-glade-ac55fitc-pooler.sa-east-1.aws.neon.tech:5432/si2_22026?sslmode=require
CRM_MODE=disabled
CRM_IDEMPOTENCY_SUPPORTED=false
CRM_API_URL=
CRM_ORDER_PATH=
CRM_API_TOKEN=
CRM_TIMEOUT_MS=5000
```

**Step 3: Verificar que el backend arranca**

Run: `cd backend; node index.js`
Expected: `Servidor LesGo Backend ejecutándose en http://localhost:5000` sin excepción de configuración. Detener con `Ctrl+C`.

---

## Task 2: Mapeador puro de filas de BD a `Product`

**Files:**
- Modify: `backend/adapters/inventoryMapper.js` (agregar export al final)
- Test: `backend/test/inventory-db.test.js` (crear)

**Step 1: Escribir el test que falla**

Crear `backend/test/inventory-db.test.js`:

```js
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
```

**Step 2: Ejecutar y ver el fallo**

Run: `cd backend; node --test test/inventory-db.test.js`
Expected: FAIL porque `normalizeDbProduct` no existe.

**Step 3: Implementar el mapeador**

Agregar al final de `backend/adapters/inventoryMapper.js`:

```js
export function normalizeDbProduct(row) {
  const id = Number(row?.id_producto);
  const price = Number(row?.precio_venta);
  const pieces = Number(row?.cant_piezas);
  const stock = Number(row?.stock ?? 0);
  const name = text(row?.nombre_set);
  const theme = text(row?.nombre_tema);
  const validId = Number.isInteger(id) && id > 0;
  const validPrice = Number.isFinite(price) && price >= 0;
  const validPieces = Number.isInteger(pieces) && pieces >= 0;
  const validStock = Number.isInteger(stock) && stock >= 0;
  if (!validId || !name || !validPrice || !validPieces || !validStock) {
    throw new AppError(502, 'INVENTORY_CONTRACT', 'Inventario devolvió datos de producto inválidos.');
  }
  return {
    id: String(id),
    name,
    price,
    stock,
    category: theme,
    categoria: theme,
    theme,
    code: text(row?.sku),
    pieces,
    age: '',
    description: '',
    images: [],
    image: '/product-placeholder.svg',
    formattedPrice: `$${price.toLocaleString('es-CL')}`,
    featured: false,
    highlights: [],
    specifications: {},
    inventorySource: 'postgres'
  };
}
```

**Step 4: Ejecutar y ver el paso**

Run: `cd backend; node --test test/inventory-db.test.js`
Expected: PASS (2 tests).

---

## Task 3: Modo `postgres` en `inventoryService`

**Files:**
- Modify: `backend/services/inventoryService.js`
- Test: `backend/test/inventory-db.test.js` (ampliar)

**Step 1: Ampliar el test que falla**

Agregar al final de `backend/test/inventory-db.test.js`:

```js
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
```

**Step 2: Ejecutar y ver el fallo**

Run: `cd backend; node --test test/inventory-db.test.js`
Expected: FAIL porque `INVENTORY_MODE=postgres` aún no está permitido.

**Step 3: Implementar el modo postgres**

En `backend/services/inventoryService.js`:

1. Importar el nuevo mapper y el pool:

```js
import { normalizeProduct, normalizeDbProduct, readPath } from '../adapters/inventoryMapper.js';
```

2. Cambiar la firma para inyectar un pool en tests:

```js
export function createInventoryService(env = process.env, fetchImpl = fetch, poolOverride = null) {
```

3. Cambiar la validación de modo:

```js
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
```

4. Agregar las dos consultas SQL dentro de la función (antes del `return`):

```js
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
```

5. Reemplazar `list()` por:

```js
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
}
```

6. Reemplazar `get(id)` por:

```js
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
```

**Step 4: Ejecutar toda la suite del backend**

Run: `cd backend; node --test`
Expected: PASS en todos los tests, incluidos los nuevos y los existentes (`inventory.test.js` no debe romperse porque `poolOverride` es opcional).

---

## Task 4: Quitar la simulación del cliente y del tipo `Product`

**Files:**
- Modify: `frontend/src/data/products.ts:14`
- Modify: `frontend/src/services/api.ts:1-115`

**Step 1: Ampliar el tipo `inventorySource`**

En `frontend/src/data/products.ts`:

```ts
inventorySource?: 'mock' | 'http' | 'postgres';
```

**Step 2: Eliminar `getLocalProducts` y forzar la API**

En `frontend/src/services/api.ts`:

1. Cambiar el import inicial a solo tipos:

```ts
import type { CartItem, Product } from '../data/products';
```

2. Borrar íntegramente la función `getLocalProducts` (líneas 27-62) y el bloque `const source = ...` (líneas 68-74).

3. Dejar `getProductosApi` así:

```ts
/**
 * Catálogo real: siempre consulta GET /api/productos (sin fallback local).
 */
export async function getProductosApi(filters: FilterParams = {}): Promise<Product[]> {
  const queryParams = new URLSearchParams();

  if (filters.categoria && filters.categoria !== 'all') {
    queryParams.append('categoria', filters.categoria);
  }
  if (filters.min_precio !== undefined && filters.min_precio > 0) {
    queryParams.append('min_precio', filters.min_precio.toString());
  }
  if (filters.max_precio !== undefined && filters.max_precio > 0) {
    queryParams.append('max_precio', filters.max_precio.toString());
  }
  if (filters.min_piezas !== undefined && filters.min_piezas > 0) {
    queryParams.append('min_piezas', filters.min_piezas.toString());
  }
  if (filters.max_piezas !== undefined && filters.max_piezas > 0) {
    queryParams.append('max_piezas', filters.max_piezas.toString());
  }
  if (filters.edad && filters.edad !== 'all') {
    queryParams.append('edad', filters.edad);
  }
  if (filters.search && filters.search.trim()) {
    queryParams.append('search', filters.search.trim());
  }

  const url = `${API_BASE_URL}/productos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error HTTP: ${res.status}`);
    }
    const data: ApiResponse = await res.json();
    if (data.success && Array.isArray(data.productos)) {
      return data.productos;
    }
    throw new Error('Respuesta de catálogo inválida.');
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.', { cause: error });
  }
}
```

**Step 3: Verificar que compila**

Run: `cd frontend; npx tsc -b --noEmit`
Expected: sin errores. (Si el proyecto no soporta `-b`, usar `npx tsc --noEmit -p tsconfig.app.json`.)

---

## Task 5: Limpiar `CatalogView.tsx` y hacer dinámico el rango de precio

**Files:**
- Modify: `frontend/src/components/CatalogView.tsx`

**Step 1: Quitar el filtro de edad y el aviso de simulación**

1. En el import de `lucide-react`, quitar `Baby`:
```ts
import { Search, Plus, X, SlidersHorizontal, RotateCcw, Layers, Coins } from 'lucide-react';
```

2. Borrar el arreglo `ageOptions` y el estado `selectedAge`.

3. Borrar la sección JSX `{/* Sección 4: Filtro por Edad Recomendada */}` completa (desde `<div className="sidebar-filter-box">` de edad hasta su cierre).

4. Borrar la línea:
```tsx
{products.some(product => product.inventorySource === 'mock') && (
  <p role="note">Inventario simulado · modo de desarrollo</p>
)}
```

5. Quitar `edad: selectedAge,` de la llamada `getProductosApi` y `selectedAge` de las dependencias del `useEffect`.

6. Borrar el chip de edad en `active-filter-chips-row`.

7. En `handleResetFilters` y `hasActiveFilters`, quitar toda referencia a `selectedAge`.

**Step 2: Reemplazar el rango fijo por el tope dinámico**

1. Agregar estado junto a `maxPrice`:
```ts
// Tope dinámico: precio del set más caro que devuelve la BD.
const [priceCeiling, setPriceCeiling] = useState<number>(0);
```

2. Inicializar `maxPrice` en `0`:
```ts
const [maxPrice, setMaxPrice] = useState<number>(0);
```

3. En el `.then()` del `useEffect`, después de `setProducts(data)`, calcular el tope la primera vez:
```ts
if (priceCeiling === 0 && data.length > 0) {
  const highest = data.reduce((max, product) => Math.max(max, product.price), 0);
  const rounded = Math.ceil(highest / 5000) * 5000;
  setPriceCeiling(rounded);
  setMaxPrice(rounded);
}
```

4. En la llamada `getProductosApi`, enviar el máximo solo si el usuario lo bajó del tope:
```ts
max_precio: priceCeiling > 0 && maxPrice < priceCeiling ? maxPrice : undefined,
```

5. Agregar `priceCeiling` y `maxPrice` al arreglo de dependencias del `useEffect`.

6. Slider mínimo:
```tsx
<input
  type="range"
  min={0}
  max={priceCeiling || 500000}
  step={5000}
  value={minPrice}
  onChange={handleMinPriceChange}
  className="lego-range-slider lego-slider-yellow"
  aria-label="Precio mínimo"
/>
```

7. Slider máximo:
```tsx
<input
  type="range"
  min={0}
  max={priceCeiling || 500000}
  step={5000}
  value={maxPrice}
  onChange={handleMaxPriceChange}
  className="lego-range-slider lego-slider-red"
  aria-label="Precio máximo"
/>
```

8. Reemplazar las comparaciones `maxPrice < 250000` y `setMaxPrice(250000)` por `maxPrice < priceCeiling` y `setMaxPrice(priceCeiling)` en:
   - `hasActiveFilters`
   - chip de precio
   - `handleResetFilters`
   - cualquier otro uso de `250000`.

9. En `handleMaxPriceChange`, quitar el clamp fijo de `250000`; usar el tope:
```ts
const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const val = Number(e.target.value);
  setMaxPrice(val);
  if (val < minPrice) {
    setMinPrice(Math.max(0, val - 10000));
  }
};
```

**Step 3: Verificar tipos y build**

Run: `cd frontend; npx tsc -b --noEmit; npm run build`
Expected: compilación y build sin errores.

---

## Task 6: Ajustar variables de entorno del frontend

**Files:**
- Modify: `frontend/.env`

**Step 1: Dejar explícito que no hay modo local**

Reemplazar el contenido de `frontend/.env` por:

```dotenv
# Same-origin /api usa Vite proxy localmente y Nginx en Docker.
VITE_API_URL=/api
# El catálogo siempre consulta el backend; ya no existe catálogo local simulado.
VITE_AUTH_OFFLINE_DEMO=false
DB_HOST=ep-royal-glade-ac55fitc-pooler.sa-east-1.aws.neon.tech
DB_PORT=5432
DB_NAME=si2_22026
DB_USER=si2_22026
DB_PASSWORD="SuContrasenaSegura#2026!"
```

`VITE_CATALOG_SOURCE` se elimina porque `api.ts` ya no lo lee.

---

## Task 7: Verificación end-to-end contra la BD real

**Files:** ninguno (solo ejecución).

**Step 1: Suite de backend**

Run: `cd backend; node --test`
Expected: PASS.

**Step 2: Levantar backend**

Run: `cd backend; npm start`
Expected log: `Servidor LesGo Backend ejecutándose en http://localhost:5000`.

**Step 3: Verificar el endpoint real**

En otra terminal:
```powershell
Invoke-RestMethod http://localhost:5000/api/productos | ConvertTo-Json -Depth 4
```
Expected:
- `success: true`
- `source: "postgres"`
- `total: 10`
- cada producto con `inventorySource: "postgres"`, `image: "/product-placeholder.svg"`, `price` entre 70000 y 400000.

**Step 4: Verificar detalle y 404**

```powershell
Invoke-RestMethod http://localhost:5000/api/productos/1 | ConvertTo-Json -Depth 4
Invoke-RestMethod http://localhost:5000/api/productos/no-existe
```
Expected: el primero devuelve `Downtown`; el segundo responde 404 `PRODUCT_NOT_FOUND`.

**Step 5: Levantar frontend y revisar catálogo**

Run: `cd frontend; npm run dev`
Expected en el navegador:
- No aparece el texto "Inventario simulado".
- Aparecen 10 sets.
- No hay sección "Edad Recomendada".
- El slider de precio llega hasta 400.000 aproximadamente (tope dinámico).
- Los filtros de categoría (City, Star Wars, etc.), piezas, precio y búsqueda siguen funcionando.
- Si el backend está apagado, se muestra el mensaje de error, sin datos simulados.

---

## Notas de riesgo

- Solo 10 productos tienen precio; los otros 119 no aparecen hasta que exista una fila activa en `ecom_catalogo`. Esto es intencional y consistente con el carrito.
- `backend/repositories/orderRepository.js` no usa `DB_HOST`; exige `DATABASE_URL`. Por eso Task 1 la define. Si se prefiere, se puede refactorizar después para reutilizar `config/db.js`, pero queda fuera de este plan.
- No se agregan columnas ni se modifica el esquema de la BD.
