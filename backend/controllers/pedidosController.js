import { PEDIDOS } from '../data/pedidosData.js';

export const getPedidosById = (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'El ID del cliente debe ser un entero positivo.'
    });
  }

  const idCliente = Number(id);
  if (!Number.isSafeInteger(idCliente)) {
    return res.status(400).json({
      success: false,
      message: 'El ID del cliente no es válido.'
    });
  }

  const pedidos = PEDIDOS.filter((pedido) => pedido.id_cliente === idCliente);

  return res.json({
    success: true,
    total: pedidos.length,
    pedidos
  });
};
