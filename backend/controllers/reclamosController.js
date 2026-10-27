import { PEDIDOS } from '../data/pedidosData.js';
import { RECLAMOS, MOTIVOS_RECLAMO } from '../data/reclamosData.js';

const parseId = (value) => {
  const text = String(value ?? '');
  return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null;
};

/**
 * POST /api/reclamos
 * Body: { id_cliente, id_pedido, motivo, descripcion }
 * - 400: datos inválidos
 * - 404: el pedido no existe o no pertenece al cliente
 * - 201: reclamo creado en estado 'ingresado'
 */
export const crearReclamo = (req, res) => {
  const { id_cliente, id_pedido, motivo, descripcion } = req.body || {};

  const idCliente = parseId(id_cliente);
  const idPedido = parseId(id_pedido);

  if (idCliente === null || idPedido === null) {
    return res.status(400).json({
      success: false,
      message: 'Debes indicar el cliente y el pedido del reclamo.'
    });
  }

  if (!MOTIVOS_RECLAMO.some((m) => m.id === motivo)) {
    return res.status(400).json({
      success: false,
      message: 'Selecciona un motivo de reclamo válido.'
    });
  }

  const texto = typeof descripcion === 'string' ? descripcion.trim() : '';
  if (texto.length < 10 || texto.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'La descripción debe tener entre 10 y 500 caracteres.'
    });
  }

  const pedido = PEDIDOS.find(
    (p) => p.id_pedido === idPedido && p.id_cliente === idCliente
  );
  if (!pedido) {
    return res.status(404).json({
      success: false,
      message: `No encontramos el pedido ${idPedido} para este cliente.`
    });
  }

  const reclamo = {
    id_reclamo: RECLAMOS.reduce((max, r) => Math.max(max, r.id_reclamo), 0) + 1,
    id_pedido: idPedido,
    id_cliente: idCliente,
    motivo,
    descripcion: texto,
    estado: 'ingresado',
    fecha_creacion: new Date().toISOString().slice(0, 10)
  };
  RECLAMOS.push(reclamo);

  return res.status(201).json({
    success: true,
    message: 'Recibimos tu reclamo. Te responderemos por correo.',
    reclamo
  });
};

/**
 * GET /api/reclamos/cliente/:id
 * Lista los reclamos del cliente (más recientes primero).
 */
export const getReclamosByCliente = (req, res) => {
  const idCliente = parseId(req.params.id);

  if (idCliente === null) {
    return res.status(400).json({
      success: false,
      message: 'El ID del cliente debe ser un entero positivo.'
    });
  }

  const reclamos = RECLAMOS
    .filter((r) => r.id_cliente === idCliente)
    .sort((a, b) => b.id_reclamo - a.id_reclamo);

  return res.json({ success: true, total: reclamos.length, reclamos });
};