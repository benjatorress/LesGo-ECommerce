import { AppError } from '../lib/errors.js';

export const readPath = (value, path) => (
  path ? path.split('.').reduce((item, key) => item?.[key], value) : value
);
const text = (value) => typeof value === 'string' ? value : '';
const imageUrl = (value) => typeof value === 'string' && (/^https?:\/\//.test(value) || /^\/(?!\/)/.test(value));

export function normalizeProduct(raw, fields = {}) {
  const get = (key) => readPath(raw, fields[key] || key);
  const id = get('id');
  const price = get('price');
  const stock = get('stock');
  if (typeof id !== 'string' || !id.trim() || !text(get('name')) || typeof price !== 'number' ||
      !Number.isSafeInteger(Math.round(price * 100)) || price < 0 || !Number.isSafeInteger(stock) || stock < 0) {
    throw new AppError(502, 'INVENTORY_CONTRACT', 'Inventario devolvió datos de producto inválidos.');
  }
  const images = [get('image'), ...(Array.isArray(get('images')) ? get('images') : [])].filter(imageUrl);
  const category = text(get('category')) || text(raw.categoria);
  const specifications = get('specifications');
  const technicalDetails = {};
  if (specifications && typeof specifications === 'object' && !Array.isArray(specifications)) {
    for (const [name, value] of Object.entries(specifications)) {
      if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
        technicalDetails[name] = value;
      }
    }
  }

  return {
    id,
    name: get('name'),
    price,
    stock: get('active') === false ? 0 : stock,
    category,
    categoria: category,
    theme: text(get('theme')),
    code: text(get('code')),
    pieces: Number.isInteger(get('pieces')) ? get('pieces') : 0,
    age: text(get('age')),
    description: text(get('description')),
    images: [...new Set(images)],
    image: images[0] || '/product-placeholder.svg',
    formattedPrice: `$${price.toLocaleString('es-CL')}`,
    featured: get('featured') === true,
    ...(Number.isInteger(get('minifigures')) ? { minifigures: get('minifigures') } : {}),
    highlights: Array.isArray(get('highlights')) ? get('highlights').filter(v => typeof v === 'string') : [],
    specifications: technicalDetails
  };
}

export function normalizeDbProduct(row) {
  const id = Number(row?.id_producto);
  const rawPrice = row?.precio_venta;
  const price = Number(rawPrice);
  const pieces = Number(row?.cant_piezas);
  const stock = Number(row?.stock ?? 0);
  const name = text(row?.nombre_set);
  const theme = text(row?.nombre_tema);
  const validId = Number.isInteger(id) && id > 0;
  const validPrice = rawPrice !== null && rawPrice !== undefined && rawPrice !== '' &&
    Number.isFinite(price) && price >= 0;
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
