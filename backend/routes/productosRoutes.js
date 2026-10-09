import express from 'express';
import { getProductos, getProductoById } from '../controllers/productosController.js';

const router = express.Router();

/**
 * @route   GET /api/productos
 * @desc    Obtener lista de productos con filtros (categoria, min_precio, max_precio, search)
 * @access  Público
 */
router.get('/', getProductos);

/**
 * @route   GET /api/productos/:id
 * @desc    Obtener detalle de un producto por ID o código
 * @access  Público
 */
router.get('/:id', getProductoById);

export default router;
