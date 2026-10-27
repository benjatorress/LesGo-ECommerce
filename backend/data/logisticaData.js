/**
 * Mock de la integración con el módulo de Logística del ERP.
 * Solo existen envíos para pedidos en estado 'enviada' o 'entregada'.
 *
 * estado_envio: 'en_transito' | 'en_reparto' | 'entregado'
 */
export const ENVIOS = [
  {
    id_envio: 1,
    id_pedido: 1,
    courier: 'Starken',
    numero_seguimiento: 'STK-7781230045',
    estado_envio: 'entregado',
    fecha_despacho: '2026-10-14T13:30:00Z',
    fecha_entrega_estimada: '2026-10-17',
    fecha_entrega: '2026-10-17T19:10:00Z',
    eventos: [
      { fecha: '2026-10-14T13:30:00Z', descripcion: 'Paquete retirado desde bodega LesGo', ubicacion: 'Antofagasta' },
      { fecha: '2026-10-15T09:15:00Z', descripcion: 'Ingresó a centro de distribución',     ubicacion: 'Antofagasta' },
      { fecha: '2026-10-17T14:00:00Z', descripcion: 'En reparto a domicilio',               ubicacion: 'Antofagasta' },
      { fecha: '2026-10-17T19:10:00Z', descripcion: 'Entregado al destinatario',            ubicacion: 'Antofagasta' }
    ]
  },
  {
    id_envio: 2,
    id_pedido: 5,
    courier: 'Starken',
    numero_seguimiento: 'STK-7779012233',
    estado_envio: 'entregado',
    fecha_despacho: '2026-09-30T14:00:00Z',
    fecha_entrega_estimada: '2026-10-03',
    fecha_entrega: '2026-10-03T17:45:00Z',
    eventos: [
      { fecha: '2026-09-30T14:00:00Z', descripcion: 'Paquete retirado desde bodega LesGo', ubicacion: 'Antofagasta' },
      { fecha: '2026-10-01T10:20:00Z', descripcion: 'Ingresó a centro de distribución',     ubicacion: 'Antofagasta' },
      { fecha: '2026-10-03T13:00:00Z', descripcion: 'En reparto a domicilio',               ubicacion: 'Antofagasta' },
      { fecha: '2026-10-03T17:45:00Z', descripcion: 'Entregado al destinatario',            ubicacion: 'Antofagasta' }
    ]
  },
  {
    id_envio: 3,
    id_pedido: 7,
    courier: 'Chilexpress',
    numero_seguimiento: 'CHX-4410098821',
    estado_envio: 'entregado',
    fecha_despacho: '2026-10-04T12:00:00Z',
    fecha_entrega_estimada: '2026-10-07',
    fecha_entrega: '2026-10-07T16:20:00Z',
    eventos: [
      { fecha: '2026-10-04T12:00:00Z', descripcion: 'Paquete retirado desde bodega LesGo', ubicacion: 'Antofagasta' },
      { fecha: '2026-10-05T08:40:00Z', descripcion: 'Ingresó a centro de distribución',     ubicacion: 'Antofagasta' },
      { fecha: '2026-10-07T16:20:00Z', descripcion: 'Entregado al destinatario',            ubicacion: 'Antofagasta' }
    ]
  },
  {
    id_envio: 4,
    id_pedido: 4,
    courier: 'Starken',
    numero_seguimiento: 'STK-7784456120',
    estado_envio: 'en_transito',
    fecha_despacho: '2026-10-26T14:10:00Z',
    fecha_entrega_estimada: '2026-10-29',
    fecha_entrega: null,
    eventos: [
      { fecha: '2026-10-26T14:10:00Z', descripcion: 'Paquete retirado desde bodega LesGo', ubicacion: 'Antofagasta' },
      { fecha: '2026-10-27T08:30:00Z', descripcion: 'Ingresó a centro de distribución',     ubicacion: 'Antofagasta' }
    ]
  },
  {
    id_envio: 5,
    id_pedido: 6,
    courier: 'Chilexpress',
    numero_seguimiento: 'CHX-4410123377',
    estado_envio: 'en_reparto',
    fecha_despacho: '2026-10-25T13:00:00Z',
    fecha_entrega_estimada: '2026-10-28',
    fecha_entrega: null,
    eventos: [
      { fecha: '2026-10-25T13:00:00Z', descripcion: 'Paquete retirado desde bodega LesGo', ubicacion: 'Antofagasta' },
      { fecha: '2026-10-26T09:10:00Z', descripcion: 'Ingresó a centro de distribución',     ubicacion: 'Antofagasta' },
      { fecha: '2026-10-27T11:45:00Z', descripcion: 'En reparto a domicilio',               ubicacion: 'Antofagasta' }
    ]
  }
];

/** Simula la consulta al módulo de Logística del ERP por número de pedido. */
export const getEnvioPorPedido = (idPedido) =>
  ENVIOS.find((envio) => envio.id_pedido === idPedido) ?? null;