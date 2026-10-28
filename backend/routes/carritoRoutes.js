import express from 'express';
import { getCart, syncCart, updateCartItem } from '../controllers/carritoController.js';
import { requireCustomer } from '../services/sessionService.js';

const router = express.Router();

/**
 * @route   GET /api/carrito
 * @desc    Obtener el carrito guardado en la base de datos del cliente autenticado
 * @access  Cliente autenticado
 */
router.get('/', requireCustomer, getCart);

/**
 * @route   PATCH /api/carrito/items/:idProducto
 * @desc    Guardar en la base de datos la nueva cantidad de un producto del carrito
 * @access  Cliente autenticado
 */
router.patch('/items/:idProducto', requireCustomer, updateCartItem);

/**
 * @route   POST /api/carrito
 * @desc    Crear o sincronizar el carrito en la base de datos
 */
router.post('/', syncCart);

/**
 * @route   PUT /api/carrito
 * @desc    Actualizar el carrito en la base de datos
 */
router.put('/', syncCart);

export default router;
