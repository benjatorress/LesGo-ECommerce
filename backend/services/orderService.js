import { createHash } from 'node:crypto';
import { AppError } from '../lib/errors.js';

const invalid = (message) => new AppError(400, 'INVALID_ORDER', message);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const shippingFields = [
  'direccion_entrega',
  'comuna_entrega',
  'ciudad_entrega',
  'telefono_contacto'
];

export const visualOrder = (pedido) => ({
  ...pedido,
  estado_dominio: pedido.estado,
  estado: pedido.estado === 'Pendiente' ? 'recibida' : pedido.estado
});

function validateRequest(body, customer, key) {
  if (!key || !/^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
    throw invalid('Envía Idempotency-Key (8 a 128 caracteres).');
  }
  if (!body || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    throw invalid('El pedido requiere entre 1 y 100 productos.');
  }
  if (body.id_cliente !== undefined && body.id_cliente !== customer.id_cliente) {
    throw new AppError(403, 'CUSTOMER_MISMATCH', 'El cliente no coincide con la sesión.');
  }

  const order = { id_cliente: customer.id_cliente, estado: 'Pendiente' };
  for (const name of shippingFields) {
    const value = body.envio?.[name];
    if (typeof value !== 'string' || !value.trim() || value.length > 250) {
      throw invalid(`Campo de envío requerido o inválido: ${name}.`);
    }
    order[name] = value.trim();
  }
  if (!['tarjeta', 'transferencia'].includes(body.metodo_pago)) {
    throw invalid('Método de pago no admitido.');
  }
  if (body.observaciones !== undefined &&
      (typeof body.observaciones !== 'string' || body.observaciones.length > 1000)) {
    throw invalid('Observaciones inválidas.');
  }
  order.metodo_pago = body.metodo_pago;
  order.observaciones = body.observaciones || '';

  const quantities = new Map();
  for (const item of body.items) {
    if (typeof item?.id_producto !== 'string' || !item.id_producto.trim() ||
        !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 || item.cantidad > 10000) {
      throw invalid('Producto o cantidad inválidos.');
    }
    const previousQuantity = quantities.get(item.id_producto) || 0;
    quantities.set(item.id_producto, previousQuantity + item.cantidad);
  }

  const items = [...quantities].sort(([first], [second]) => first.localeCompare(second));
  return { order, items };
}

async function resolveLines(items, inventory, persistenceMode) {
  const lines = [];
  const snapshots = [];
  const canonicalIds = new Set();
  let totalCents = 0;

  for (const [id, quantity] of items) {
    const product = await inventory.get(id);
    if (persistenceMode === 'postgres' && !uuidPattern.test(product.id)) {
      throw invalid('PostgreSQL requiere el UUID real de Inventario; no se convierten slugs.');
    }
    if (canonicalIds.has(product.id)) {
      throw invalid('Producto duplicado mediante identificadores alternativos.');
    }
    canonicalIds.add(product.id);

    if (quantity > product.stock) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', `Stock insuficiente para ${product.name}.`);
    }
    const unitPriceCents = Math.round(product.price * 100);
    if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
      throw new AppError(502, 'INVALID_PRICE', 'Precio de Inventario inválido.');
    }
    totalCents += unitPriceCents * quantity;
    if (!Number.isSafeInteger(totalCents)) {
      throw invalid('Total de pedido fuera de rango.');
    }

    lines.push({
      id_producto: product.id,
      cantidad: quantity,
      precio_unitario: unitPriceCents / 100
    });
    snapshots.push({
      id_producto: product.id,
      nombre: product.name,
      codigo: product.code,
      imagen: product.image
    });
  }
  return { lines, snapshots, total: totalCents / 100 };
}

export async function createOrder({ body, customer, key, inventory, orders, crm }) {
  const { order, items } = validateRequest(body, customer, key);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ order, items }))
    .digest('hex');

  let result = await orders.findByKey(customer.id_cliente, key);
  if (result) {
    result = { ...result, replay: true };
  } else {
    const { lines, snapshots, total } = await resolveLines(items, inventory, orders.mode);
    order.monto_total = total;
    const payload = {
      version: 1,
      cliente: {
        id_cliente: customer.id_cliente,
        nombre: customer.nombre,
        email: customer.email,
        rut: customer.rut
      },
      envio: Object.fromEntries(shippingFields.map(name => [name, order[name]])),
      metodo_pago: order.metodo_pago,
      monto_total: order.monto_total,
      estado: 'Pendiente',
      items: lines,
      productos: snapshots
    };
    result = await orders.create(order, lines, { key, fingerprint, payload });
  }

  if (result.event.fingerprint !== fingerprint) {
    throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'La clave ya corresponde a otra solicitud.');
  }

  let crmStatus = result.event.status;
  if (crmStatus !== 'synced') {
    try {
      const crmPayload = { ...result.event.payload, id_pedido: result.pedido.id_pedido };
      const crmKey = `lesgo-order-${customer.id_cliente}-${key}`;
      crmStatus = await crm.send(crmPayload, crmKey);
      await orders.markCrm(result.pedido.id_pedido, crmStatus);
    } catch {
      crmStatus = 'pending';
    }
  }
  return { ...result, crmStatus };
}
