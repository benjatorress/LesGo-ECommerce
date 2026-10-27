import express from 'express';
import { getPedidosById, getPedidoDetalle } from '../controllers/pedidosController.js';

const router = express.Router();

/**
 * @route   GET /api/pedidos/cliente/:id
 * @desc    Obtener lista de pedidos hechos por el cliente asociado a :id
 * @access  Público
 */
router.get('/cliente/:id', getPedidosById);

/**
 * @route   GET /api/pedidos/cliente/:idCliente/:idPedido
 * @desc    Detalle, seguimiento (Logística ERP) y reclamos de un pedido del cliente
 * @access  Público
 */
router.get('/cliente/:idCliente/:idPedido', getPedidoDetalle);

export default router;