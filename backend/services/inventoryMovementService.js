import { PRODUCTOS } from '../data/productosData.js';
import { createHttpClient, configuredUrl } from './httpClient.js';

export function createInventoryMovementService(env = process.env, fetchImpl = fetch) {
  const mode = env.INVENTORY_MOVEMENT_MODE || 'disabled';
  if (!['disabled', 'mock', 'http'].includes(mode)) {
    throw new Error('INVENTORY_MOVEMENT_MODE inválido');
  }
  if (mode === 'http' && !env.INVENTORY_API_TOKEN?.trim()) {
    throw new Error('INVENTORY_API_TOKEN es obligatorio cuando INVENTORY_MOVEMENT_MODE=http');
  }

  const url = mode === 'http'
    ? configuredUrl(env.INVENTORY_MOVEMENT_API_URL, env.INVENTORY_EGRESS_PATH || '/api/v1/movimientos/reserva')
    : null;

  const request = createHttpClient({
    timeout: Number(env.INVENTORY_TIMEOUT_MS || 5000),
    token: env.INVENTORY_API_TOKEN,
    fetchImpl
  });

  const history = [];

  return {
    mode,
    history,
    async registerEgress({ idPedido, lineas }) {
      const pedidoIdNum = Number(idPedido);
      if (!Number.isSafeInteger(pedidoIdNum) || pedidoIdNum <= 0) {
        throw new Error(`id_pedido inválido para movimiento de inventario: ${idPedido}`);
      }

      if (!Array.isArray(lineas) || lineas.length === 0) {
        return { status: 'skipped', reason: 'empty_lines' };
      }

      const normalizedLines = lineas.map(l => {
        const prodId = mode === 'http' ? Number(l.id_producto) : l.id_producto;
        const cantidad = Number(l.cantidad);
        if (mode === 'http' && (!Number.isSafeInteger(prodId) || prodId <= 0)) {
          throw new Error(`id_producto debe ser entero positivo en modo http (recibido: ${l.id_producto})`);
        }
        if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
          throw new Error(`cantidad inválida en línea de inventario: ${l.cantidad}`);
        }
        return { id_producto: prodId, cantidad };
      });

      const payload = {
        id_pedido: pedidoIdNum,
        lineas: normalizedLines
      };

      if (mode === 'disabled') {
        return { status: 'disabled' };
      }

      if (mode === 'mock') {
        for (const linea of payload.lineas) {
          const prod = PRODUCTOS.find(p => String(p.id) === String(linea.id_producto));
          if (prod) {
            prod.stock = Math.max(0, prod.stock - linea.cantidad);
          }
        }
        history.push({ ...payload, status: 'mock', timestamp: new Date().toISOString() });
        console.log('[Mock Inventario] Reserva/Descuento registrado:', JSON.stringify(payload));
        return { status: 'mock', payload };
      }

      try {
        const response = await request(url, {
          method: 'POST',
          body: payload
        });
        history.push({ ...payload, status: 'reserved', timestamp: new Date().toISOString() });
        return { status: 'reserved', payload, response };
      } catch (error) {
        const status = error?.status === 409 ? 'out_of_stock_conflict' : 'failed';
        history.push({ ...payload, status, error: error.message, timestamp: new Date().toISOString() });
        throw error;
      }
    }
  };
}