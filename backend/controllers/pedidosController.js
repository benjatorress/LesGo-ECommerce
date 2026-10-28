import { PRODUCTOS } from '../data/productosData.js';
import { getEnvioPorPedido } from '../data/logisticaData.js';
import { RECLAMOS } from '../data/reclamosData.js';
import { createOrder, visualOrder } from '../services/orderService.js';

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
export const getPedidosById = async (req, res) => {
  const idCliente = parseId(req.params.id);

  if (idCliente === null) {
    return res.status(400).json({
      success: false,
      message: 'El ID del cliente debe ser un entero positivo.'
    });
  }

  if (idCliente !== req.customer.id_cliente) {
    return res.status(403).json({
      success: false,
      message: 'No tienes acceso a los pedidos de otro cliente.'
    });
  }
  const repository = req.app.locals.orders;
  const rows = await repository.list(idCliente);
  const pedidos = rows
    .sort(ordenarRecientesPrimero)
    .map(({ crm_status, has_crm_event, ...pedido }) => {
      const envio = repository.mode === 'mock' && !has_crm_event
        ? getEnvioPorPedido(pedido.id_pedido)
        : null;
      return {
        ...visualOrder(pedido),
        crm: { status: crm_status },
        courier: envio?.courier ?? null,
        numero_seguimiento: envio?.numero_seguimiento ?? null
      };
    });

  return res.json({
    success: true,
    persistence: repository.mode,
    total: pedidos.length,
    pedidos
  });
};

/**
 * GET /api/pedidos/cliente/:idCliente/:idPedido
 * Detalle del pedido + seguimiento + datos de Logística (ERP) + reclamos del pedido.
 * Si el pedido pertenece a otro cliente responde 404.
 */
export const getPedidoDetalle = async (req, res) => {
  const idCliente = parseId(req.params.idCliente);
  const idPedido = parseId(req.params.idPedido);

  if (idCliente === null || idPedido === null) {
    return res.status(400).json({
      success: false,
      message: 'Los IDs de cliente y pedido deben ser enteros positivos.'
    });
  }

  if (idCliente !== req.customer.id_cliente) {
    return res.status(403).json({
      success: false,
      message: 'No tienes acceso a los pedidos de otro cliente.'
    });
  }
  const repository = req.app.locals.orders;
  const stored = await repository.get(idCliente, idPedido);
  const pedido = stored?.pedido;

  if (!pedido) {
    return res.status(404).json({
      success: false,
      message: `No encontramos el pedido ${idPedido} para este cliente.`
    });
  }

  const detalle = stored.detalle
    .map((d) => {
      const snapshot = stored.event?.payload?.productos?.find(p => p.id_producto === d.id_producto);
      const producto = repository.mode === 'mock' ? PRODUCTOS.find((p) => p.id === d.id_producto) : null;
      return {
        ...d,
        nombre: snapshot?.nombre ?? producto?.name ?? 'Producto no disponible',
        codigo: snapshot?.codigo ?? producto?.code ?? '-',
        imagen: snapshot?.imagen ?? producto?.image ?? '',
        subtotal: d.cantidad * d.precio_unitario
      };
    });

  const envio = repository.mode === 'mock' && !stored.event ? getEnvioPorPedido(pedido.id_pedido) : null;

  return res.json({
    success: true,
    persistence: repository.mode,
    pedido: {
      ...visualOrder(pedido),
      crm: { status: stored.event?.status ?? 'not_registered' },
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
      reclamos: (repository.mode === 'mock' && !stored.event ? RECLAMOS : [])
        .filter((r) => r.id_pedido === pedido.id_pedido)
        .sort((a, b) => b.id_reclamo - a.id_reclamo)
    }
  });
};

export const postPedido = async (req, res) => {
  const { inventory, orders, crm } = req.app.locals;
  const result = await createOrder({
    body: req.body,
    customer: req.customer,
    key: req.get('Idempotency-Key'),
    inventory,
    orders,
    crm
  });
  const message = result.crmStatus === 'pending'
    ? 'Pedido creado en estado Pendiente. Sincronización CRM pendiente; no se ha procesado ningún pago.'
    : 'Pedido creado en estado Pendiente; no se ha procesado ningún pago.';

  res.status(result.replay ? 200 : 201).json({
    success: true,
    persistence: orders.mode,
    replay: !!result.replay,
    pedido: {
      ...visualOrder(result.pedido),
      detalle: result.detalle,
      total_items: result.detalle.reduce((sum, line) => sum + line.cantidad, 0),
      courier: null,
      numero_seguimiento: null
    },
    crm: { mode: crm.mode, status: result.crmStatus },
    message
  });
};
