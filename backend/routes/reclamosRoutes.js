import express from 'express';
import { crearReclamo, getReclamosByCliente } from '../controllers/reclamosController.js';

const router = express.Router();

/**
 * @route   POST /api/reclamos
 * @desc    Levantar un reclamo sobre un pedido del cliente
 */
router.post('/', crearReclamo);

/**
 * @route   GET /api/reclamos/cliente/:id
 * @desc    Listar los reclamos del cliente
 */
router.get('/cliente/:id', getReclamosByCliente);

export default router;