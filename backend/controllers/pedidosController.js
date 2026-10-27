import { PEDIDOS, DETALLE_PEDIDO } from '../data/pedidosData.js';
import { PRODUCTOS } from '../data/productosData.js';
import { getEnvioPorPedido } from '../data/logisticaData.js';
import { RECLAMOS } from '../data/reclamosData.js';

// Pasos del seguimiento visible para el cliente
const PASOS = [
  { clave: 'recibida',  titulo: 'Orden recibida',  descripcion: 'Registramos tu orden en LesGo.' },
  { clave: 'pagada',    titulo: 'Pago confirmado', descripcion: 'Tu pago fue aprobado.' },
  { clave: 'enviada',   titulo: 'Enviada',         descripcion: 'Entregamos tu orden al courier.' },
  { clave: 'entregada', titulo: 'Entregada',       descripcion: 'Tu orden llegó a destino.' }
];

// Cuántos pasos están completados según el estado del pedido
const PASOS_COMPLETADOS = { recibida: 1, pagada: 2, enviada: 3, entregada: 4 };

const parseId = (value) =>
  /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

const sumarHoras = (fecha, horas) => {
  const base = new Date(`${fecha}T09:00:00Z`).getTime();
  return new Date(base + horas * 3600 * 1000).toISOString();
};

const construirSeguimiento = (pedido, envio) => {
  const completados = PASOS_COMPLETADOS[pedido.estado] ?? 1;
  const f = pedido.fecha_pedido;
  const fechas = [
    sumarHoras(f, 0),
    sumarHoras(f, 2),
    envio?.fecha_despacho ?? sumarHoras(f, 48),
    envio?.fecha_entrega ?? sumarHoras(f, 120)
  ];

  return PASOS.map((paso, i) => ({
    ...paso,
    fecha: i < completados ? fechas[i] : null,
    completado: i < completados
  }));
};

const ordenarRecientesPrimero = (a, b) =>
  b.fecha_pedido.localeCompare(a.fecha_pedido) || b.id_pedido - a.id_pedido;

/**
 * GET /api/pedidos/cliente/:id
 * Lista los pedidos del cliente (más recientes primero), con el N° de seguimiento
 * de Logística cuando el pedido ya fue enviado.
 */
export const getPedidosById = (req, res) => {
  const idCliente = parseId(req.params.id);

  if (idCliente === null) {
    return res.status(400).json({
      success: false,
      message: 'El ID del cliente debe ser un entero positivo.'
    });
  }

  const pedidos = PEDIDOS
    .filter((pedido) => pedido.id_cliente === idCliente)
    .sort(ordenarRecientesPrimero)
    .map((pedido) => {
      const envio = getEnvioPorPedido(pedido.id_pedido);
      return {
        ...pedido,
        total_items: DETALLE_PEDIDO
          .filter((d) => d.id_pedido === pedido.id_pedido)
          .reduce((acc, d) => acc + d.cantidad, 0),
        courier: envio?.courier ?? null,
        numero_seguimiento: envio?.numero_seguimiento ?? null
      };
    });

  return res.json({
    success: true,
    total: pedidos.length,
    pedidos
  });
};

/**
 * GET /api/pedidos/cliente/:idCliente/:idPedido
 * Detalle del pedido + seguimiento + datos de Logística (ERP) + reclamos del pedido.
 * Si el pedido pertenece a otro cliente responde 404.
 */
export const getPedidoDetalle = (req, res) => {
  const idCliente = parseId(req.params.idCliente);
  const idPedido = parseId(req.params.idPedido);

  if (idCliente === null || idPedido === null) {
    return res.status(400).json({
      success: false,
      message: 'Los IDs de cliente y pedido deben ser enteros positivos.'
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

  const detalle = DETALLE_PEDIDO
    .filter((d) => d.id_pedido === pedido.id_pedido)
    .map((d) => {
      const producto = PRODUCTOS.find((p) => p.id === d.id_producto);
      return {
        ...d,
        nombre: producto?.name ?? 'Producto no disponible',
        codigo: producto?.code ?? '-',
        imagen: producto?.image ?? '',
        subtotal: d.cantidad * d.precio_unitario
      };
    });

  const envio = getEnvioPorPedido(pedido.id_pedido);

  return res.json({
    success: true,
    pedido: {
      ...pedido,
      total_items: detalle.reduce((acc, d) => acc + d.cantidad, 0),
      courier: envio?.courier ?? null,
      numero_seguimiento: envio?.numero_seguimiento ?? null,
      detalle,
      seguimiento: construirSeguimiento(pedido, envio),
      logistica: envio
        ? {
            courier: envio.courier,
            numero_seguimiento: envio.numero_seguimiento,
            estado_envio: envio.estado_envio,
            fecha_despacho: envio.fecha_despacho,
            fecha_entrega_estimada: envio.fecha_entrega_estimada,
            fecha_entrega: envio.fecha_entrega,
            eventos: envio.eventos
          }
        : null,
      reclamos: RECLAMOS
        .filter((r) => r.id_pedido === pedido.id_pedido)
        .sort((a, b) => b.id_reclamo - a.id_reclamo)
    }
  });
};