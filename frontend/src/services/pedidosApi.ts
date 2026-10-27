const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export type EstadoPedido = 'recibida' | 'pagada' | 'enviada' | 'entregada';
export type EstadoEnvio = 'en_transito' | 'en_reparto' | 'entregado';
export type EstadoReclamo = 'ingresado' | 'en_revision' | 'resuelto';

export interface PedidoResumen {
  id_pedido: number;
  id_cliente: number;
  fecha_pedido: string; // YYYY-MM-DD
  monto_total: number;
  estado: EstadoPedido;
  total_items: number;
  courier: string | null;
  numero_seguimiento: string | null;
}

export interface DetallePedidoItem {
  id_detalle_pedido: number;
  id_pedido: number;
  id_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  nombre: string;
  codigo: string;
  imagen: string;
}

export interface PasoSeguimiento {
  clave: string;
  titulo: string;
  descripcion: string;
  fecha: string | null; // ISO
  completado: boolean;
}

export interface EventoLogistica {
  fecha: string; // ISO
  descripcion: string;
  ubicacion: string;
}

/** Datos provistos por el módulo de Logística del ERP */
export interface Logistica {
  courier: string;
  numero_seguimiento: string;
  estado_envio: EstadoEnvio;
  fecha_despacho: string;
  fecha_entrega_estimada: string; // YYYY-MM-DD
  fecha_entrega: string | null;
  eventos: EventoLogistica[];
}

export interface Reclamo {
  id_reclamo: number;
  id_pedido: number;
  id_cliente: number;
  motivo: string;
  descripcion: string;
  estado: EstadoReclamo;
  fecha_creacion: string; // YYYY-MM-DD
}

export interface PedidoDetalle extends PedidoResumen {
  detalle: DetallePedidoItem[];
  seguimiento: PasoSeguimiento[];
  logistica: Logistica | null;
  reclamos: Reclamo[];
}

export interface NuevoReclamo {
  id_cliente: number;
  id_pedido: number;
  motivo: string;
  descripcion: string;
}

async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo nuevamente.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Error HTTP ${res.status}`);
  }
  return data;
}

/** GET /api/pedidos/cliente/:id */
export async function getPedidosApi(idCliente: number): Promise<PedidoResumen[]> {
  const data = await request(`/pedidos/cliente/${idCliente}`);
  return data.pedidos as PedidoResumen[];
}

/** GET /api/pedidos/cliente/:idCliente/:idPedido */
export async function getPedidoDetalleApi(idCliente: number, idPedido: number): Promise<PedidoDetalle> {
  const data = await request(`/pedidos/cliente/${idCliente}/${idPedido}`);
  return data.pedido as PedidoDetalle;
}

/** POST /api/reclamos */
export async function crearReclamoApi(reclamo: NuevoReclamo): Promise<Reclamo> {
  const data = await request('/reclamos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reclamo)
  });
  return data.reclamo as Reclamo;
}