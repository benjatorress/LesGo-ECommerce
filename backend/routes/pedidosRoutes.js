import express from 'express';
import { getPedidosById, getPedidoDetalle, postPedido } from '../controllers/pedidosController.js';
import { requireCustomer } from '../services/sessionService.js';

const router = express.Router();
router.use(requireCustomer);
router.post('/', postPedido);

/**
 * @route   GET /api/pedidos/cliente/:id
 * @desc    Obtener lista de pedidos hechos por el cliente asociado a :id
 * @access  Cliente autenticado
 */
router.get('/cliente/:id', getPedidosById);

/**
 * @route   GET /api/pedidos/cliente/:idCliente/:idPedido
 * @desc    Detalle, seguimiento (Logística ERP) y reclamos de un pedido del cliente
 * @access  Cliente autenticado
 */
router.get('/cliente/:idCliente/:idPedido', getPedidoDetalle);

export default router;
