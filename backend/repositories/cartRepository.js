import { AppError } from '../lib/errors.js';

// La BD no expone stock por producto; se usa un tope por línea en el carrito.
export const MAX_QUANTITY_PER_LINE = 99;

const LATEST_CART_FILTER = `
  SELECT id_carrito
  FROM ecommerce_ventas.ecom_carrito
  WHERE id_cliente = $1
  ORDER BY fecha_creacion DESC, id_carrito DESC
  LIMIT 1`;

const UPDATE_QUANTITY_SQL = `
  UPDATE ecommerce_ventas.ecom_detalle_carrito
  SET cantidad = $3
  WHERE id_producto = $2 AND id_carrito = (${LATEST_CART_FILTER})
  RETURNING id_detalle_car, id_producto, cantidad`;

const LATEST_CART_SQL = `
  SELECT id_carrito, fecha_creacion
  FROM ecommerce_ventas.ecom_carrito
  WHERE id_cliente = $1
  ORDER BY fecha_creacion DESC, id_carrito DESC
  LIMIT 1`;

const CART_LINES_SQL = `
  SELECT d.id_detalle_car, d.id_producto, d.cantidad,
         p.sku, p.nombre_set, p.cant_piezas, p.activo AS producto_activo,
         cat.precio_venta
  FROM ecommerce_ventas.ecom_detalle_carrito d
  LEFT JOIN inventario.inv_producto p ON p.id_producto = d.id_producto
  LEFT JOIN LATERAL (
    SELECT c.precio_venta
    FROM ecommerce_ventas.ecom_catalogo c
    WHERE c.id_producto = d.id_producto AND c.activo
    ORDER BY c.id_catalogo DESC
    LIMIT 1
  ) cat ON TRUE
  WHERE d.id_carrito = $1
  ORDER BY d.id_detalle_car`;

/**
 * Convierte una fila de detalle de carrito al formato CartItem del frontend.
 * Devuelve null si el producto está inactivo o no tiene precio activo en el catálogo.
 */
export function mapCartLine(row) {
  if (row.producto_activo !== true || row.precio_venta === null || row.precio_venta === undefined) {
    return null;
  }
  const price = Number(row.precio_venta);
  if (!Number.isFinite(price) || price < 0) {
    return null;
  }
  return {
    id_detalle_car: row.id_detalle_car,
    quantity: row.cantidad,
    product: {
      id: String(row.id_producto),
      name: row.nombre_set,
      code: row.sku,
      price,
      formattedPrice: `$${price.toLocaleString('es-CL')}`,
      pieces: row.cant_piezas ?? 0,
      category: '',
      theme: '',
      age: '',
      image: '/product-placeholder.svg',
      stock: Math.max(MAX_QUANTITY_PER_LINE, row.cantidad)
    }
  };
}

export function createCartRepository(env = process.env) {
  let poolPromise;
  const getPool = () => {
    poolPromise ||= import('../config/db.js').then(module => module.pool);
    return poolPromise;
  };

  return {
    mode: env.DB_HOST ? 'postgres' : 'unconfigured',
    /** Actualiza la cantidad de un producto en el carrito más reciente del cliente. Devuelve null si no existe. */
    async updateQuantity(customerId, productId, quantity) {
      try {
        const pool = await getPool();
        const { rows } = await pool.query(UPDATE_QUANTITY_SQL, [customerId, productId, quantity]);
        return rows[0] || null;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        // 22P02: el identificador no tiene el formato del tipo de la columna (no puede existir)
        if (error.code === '22P02') {
          return null;
        }
        console.error('Error actualizando el carrito:', error.code, error.message);
        throw new AppError(503, 'CART_UNAVAILABLE', 'No se pudo actualizar el carrito.');
      }
    },
    async getByCustomer(customerId) {
      try {
        const pool = await getPool();
        const cart = (await pool.query(LATEST_CART_SQL, [customerId])).rows[0];
        if (!cart) {
          return { carrito: null, items: [], omitidos: [] };
        }
        const { rows } = await pool.query(CART_LINES_SQL, [cart.id_carrito]);
        const items = [];
        const omitidos = [];
        for (const row of rows) {
          const item = mapCartLine(row);
          if (item) {
            items.push(item);
          } else {
            omitidos.push(row.id_detalle_car);
          }
        }
        return { carrito: cart, items, omitidos };
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        console.error('Error consultando el carrito:', error.code, error.message);
        throw new AppError(503, 'CART_UNAVAILABLE', 'No se pudo consultar el carrito.');
      }
    }
  };
}
