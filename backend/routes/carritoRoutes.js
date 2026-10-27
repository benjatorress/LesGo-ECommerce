import express from 'express';
import { syncCart } from '../controllers/carritoController.js';

const router = express.Router();

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