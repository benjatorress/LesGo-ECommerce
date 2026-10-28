import { CARRITOS_DB } from '../data/carritoData.js';
import { MAX_QUANTITY_PER_LINE } from '../repositories/cartRepository.js';


/**
 * GET /api/carrito
 * Devuelve el carrito guardado en la BD para el cliente de la sesión.
 */
export const getCart = async (req, res) => {
  const { carrito, items, omitidos } = await req.app.locals.carts.getByCustomer(req.customer.id_cliente);
  return res.json({ success: true, carrito, items, omitidos });
};

/**
 * PATCH /api/carrito/items/:idProducto  { cantidad }
 * Guarda en la BD la nueva cantidad de un producto del carrito del cliente de la sesión.
 */
export const updateCartItem = async (req, res) => {
  const { idProducto } = req.params;
  const { cantidad } = req.body || {};

  if (!idProducto.trim() || idProducto.length > 200) {
    return res.status(400).json({ success: false, message: 'Identificador de producto inválido.' });
  }
  if (!Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > MAX_QUANTITY_PER_LINE) {
    return res.status(400).json({
      success: false,
      message: `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY_PER_LINE}.`
    });
  }

  const item = await req.app.locals.carts.updateQuantity(req.customer.id_cliente, idProducto, cantidad);
  if (!item) {
    return res.status(404).json({ success: false, message: 'El producto no está en tu carrito guardado.' });
  }
  return res.json({ success: true, item });
};

export const syncCart = async (req, res) => {
  const { usuarioId, items } = req.body || {};

  // Validación de usuario
  if (!usuarioId) {
    return res.status(401).json({ 
      success: false, 
      message: 'Usuario no autenticado o ID faltante.' 
    });
  }

  // Validación de formato de ítems
  if (!Array.isArray(items)) {
    return res.status(400).json({ 
      success: false, 
      message: 'El formato de items es incorrecto. Se espera un arreglo.' 
    });
  }

  // Validación de stock para cada producto en el carrito
  for (const item of items) {
    if (!item?.product?.id || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Producto o cantidad inválidos.'
      });
    }
    const productoSolicitado = item.product;
    const cantidadSolicitada = item.quantity;

    const productoEnInventario = await req.app.locals.inventory.get(productoSolicitado.id);

    // Comparamos la cantidad solicitada con el stock disponible
    // (Usamos un fallback de 0 por seguridad si a algún producto le falta el campo)
    const stockDisponible = productoEnInventario.stock || 0;

    if (cantidadSolicitada > stockDisponible) {
      return res.status(409).json({ // 409 Conflict es ideal para reglas de negocio / stock
        success: false,
        error_type: 'STOCK_EXCEEDED',
        message: `No hay stock suficiente para "${productoEnInventario.name}". Solicitaste ${cantidadSolicitada}, pero solo quedan ${stockDisponible} unidades disponibles.`
      });
    }
  }

  // Sincronización en memoria simulando transacción de base de datos
  CARRITOS_DB[usuarioId] = items;
  console.log(`[Mock DB] Carrito sincronizado para usuario ID ${usuarioId} con ${items.length} ítems.`);

  return res.status(200).json({ 
    success: true, 
    message: 'Carrito sincronizado correctamente con la base de datos.',
    carrito: CARRITOS_DB[usuarioId]
  });
};
