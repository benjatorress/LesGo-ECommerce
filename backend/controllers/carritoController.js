import { CARRITOS_DB } from '../data/carritoData.js';

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

  // Sincronización en memoria simulando transacción de base de datos
  CARRITOS_DB[usuarioId] = items;
  console.log(`[Mock DB] Carrito sincronizado para usuario ID ${usuarioId} con ${items.length} ítems.`);

  return res.status(200).json({ 
    success: true, 
    message: 'Carrito sincronizado correctamente con la base de datos.',
    carrito: CARRITOS_DB[usuarioId]
  });
};