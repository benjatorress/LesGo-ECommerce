import express from 'express';
import { getPedidosById } from '../controllers/pedidosController.js';

const router = express.Router();

/**
 * @route   GET /api/pedidos/cliente/:id
 * @desc    Obtener lista de pedidos hechos por el cliente asociado a :id
 * @access  Público
 */
router.get('/cliente/:id', getPedidosById);

export default router;