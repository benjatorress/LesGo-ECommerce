import type { CartItem } from '../data/products';

export interface CheckoutForm {
  direccion_entrega: string;
  comuna_entrega: string;
  ciudad_entrega: string;
  telefono_contacto: string;
  metodo_pago: 'tarjeta' | 'transferencia';
  observaciones: string;
}

export interface CrearPedidoPayload {
  items: { id_producto: string; cantidad: number }[];
  envio: Omit<CheckoutForm, 'metodo_pago' | 'observaciones'>;
  metodo_pago: CheckoutForm['metodo_pago'];
  observaciones?: string;
}

export function toOrderPayload(form: CheckoutForm, items: CartItem[]): CrearPedidoPayload {
  const { metodo_pago, observaciones, ...envio } = form;
  return {
    items: items.map(item => ({ id_producto: item.product.id, cantidad: item.quantity })),
    envio,
    metodo_pago,
    observaciones
  };
}
