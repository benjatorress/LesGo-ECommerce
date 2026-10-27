import { CARRITOS_DB } from '../data/carritoData.js';
import { PRODUCTOS } from '../data/productosData.js';

export const syncCart = (req, res) => {
  const { usuarioId, items } = req.body;

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
    const productoSolicitado = item.product;
    const cantidadSolicitada = item.quantity;

    // Buscamos el producto real en la base de datos
    const productoEnInventario = PRODUCTOS.find(p => p.id === productoSolicitado.id);

    if (!productoEnInventario) {
      return res.status(404).json({
        success: false,
        message: `El producto con ID "${productoSolicitado.id}" no existe en el catálogo.`
      });
    }

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