// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { CartProvider } from './context/CartContext';
import { PRODUCTS } from './data/products';

// `window.location.assign` es read-only en jsdom: se stubear sólo el wrapper.
const { redirigirAStripe } = vi.hoisted(() => ({ redirigirAStripe: vi.fn() }));
vi.mock('./services/pagosApi', async importOriginal => {
  const actual = await importOriginal<typeof import('./services/pagosApi')>();
  return { ...actual, redirigirAStripe };
});

const product = { ...PRODUCTS[0], name: 'Set de prueba', price: 89990, stock: 5 };
const URL_STRIPE = 'https://checkout.stripe.com/c/pay/cs_test_123';

const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));

const pedidoCreado = {
  success: true,
  persistence: 'postgres',
  replay: false,
  pedido: {
    id_pedido: 42,
    id_cliente: 1,
    fecha_pedido: '2026-11-14',
    monto_total: 179980,
    estado: 'recibida',
    estado_dominio: 'Pendiente',
    total_items: 2,
    courier: null,
    numero_seguimiento: null
  },
  crm: { mode: 'disabled', status: 'pending' },
  message: 'Pedido creado en estado Pendiente; queda pendiente de pago.'
};

const carritoGuardado = {
  success: true,
  carrito: { id_carrito: 7, fecha_creacion: '2026-11-14T10:00:00.000Z' },
  items: [{ product, quantity: 2, saved: true }],
  omitidos: []
};

const sesionCreada = {
  success: true,
  reutilizada: false,
  session: { sessionId: 'cs_test_123', url: URL_STRIPE },
  pago: { id_pago: 5, estado: 'abierta' }
};

/** Deja al usuario como cliente autenticado con el carrito guardado en la BD. */
function iniciarSesionCliente() {
  localStorage.setItem('lesgo_auth_token', 'token-cliente');
  localStorage.setItem('lesgo_auth_user', JSON.stringify({
    tipo: 'cliente',
    id_cliente: 1,
    nombre: 'Valentina',
    nombre_completo: 'Valentina Soto',
    rut: '20.345.678-9',
    email: 'cliente@lesgo.cl',
    estado: 'activo',
    acceso_modulo_ventas: false
  }));
}

function montarCheckout() {
  localStorage.setItem('lesgo_cart', JSON.stringify([{ product, quantity: 2 }]));
  window.history.replaceState({}, '', '/?view=cart');
  render(<CartProvider><App /></CartProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }));
}

function completarFormulario() {
  for (const label of ['Dirección de entrega', 'Comuna', 'Ciudad', 'Teléfono de contacto']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'Datos prueba' } });
  }
}

const cantidadEnCarrito = () => JSON.parse(localStorage.getItem('lesgo_cart') || '[]')[0]?.quantity;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  redirigirAStripe.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('checkout con tarjeta', () => {
  it('crea el pedido, abre la sesión de Stripe y redirige sin vaciar el carrito', async () => {
    iniciarSesionCliente();
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url, init) => {
      if (url.endsWith('/api/carrito') && (init?.method ?? 'GET') === 'GET') return json(carritoGuardado);
      if (url.endsWith('/api/pedidos') && init?.method === 'POST') return json(pedidoCreado, 201);
      if (url.endsWith('/api/pagos/stripe/session') && init?.method === 'POST') return json(sesionCreada, 201);
      return json({ success: false, message: `fetch inesperado: ${url}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    montarCheckout();
    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));

    await waitFor(() => expect(redirigirAStripe).toHaveBeenCalledWith(URL_STRIPE));

    const llamadaPedido = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/pedidos') && init?.method === 'POST'
    );
    expect(llamadaPedido).toBeTruthy();
    const [, initPedido] = llamadaPedido!;
    const headers = initPedido!.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/^[a-zA-Z0-9_-]{8,128}$/);
    expect(JSON.parse(String(initPedido!.body))).toEqual({
      items: [{ id_producto: product.id, cantidad: 2 }],
      envio: {
        direccion_entrega: 'Datos prueba',
        comuna_entrega: 'Datos prueba',
        ciudad_entrega: 'Datos prueba',
        telefono_contacto: 'Datos prueba'
      },
      metodo_pago: 'tarjeta',
      observaciones: ''
    });

    const llamadaSesion = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/pagos/stripe/session') && init?.method === 'POST'
    );
    expect(JSON.parse(String(llamadaSesion![1]!.body))).toEqual({ id_pedido: 42 });

    // El carrito sólo se vacía cuando el backend confirma el pago.
    expect(cantidadEnCarrito()).toBe(2);
  });

  it('si falla la creación de la sesión muestra el error, conserva el carrito y permite reintentar', async () => {
    iniciarSesionCliente();
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url, init) => {
      if (url.endsWith('/api/carrito') && (init?.method ?? 'GET') === 'GET') return json(carritoGuardado);
      if (url.endsWith('/api/pedidos') && init?.method === 'POST') return json(pedidoCreado, 201);
      if (url.endsWith('/api/pagos/stripe/session')) {
        return json({ success: false, message: 'No se pudo iniciar el pago con tarjeta.' }, 503);
      }
      return json({ success: false, message: `fetch inesperado: ${url}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    montarCheckout();
    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));

    expect((await screen.findByRole('status')).textContent).toContain('No se pudo iniciar el pago con tarjeta.');
    expect(redirigirAStripe).not.toHaveBeenCalled();
    expect(cantidadEnCarrito()).toBe(2);
    // El botón vuelve a estar habilitado para reintentar.
    expect(screen.getByRole('button', { name: 'Pagar con tarjeta' }).hasAttribute('disabled')).toBe(false);
  });

  it('sin sesión de cliente abre el login y no llama al backend de pagos', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      () => json({ success: false, message: 'fetch inesperado' }, 500)
    );
    vi.stubGlobal('fetch', fetchMock);

    montarCheckout();
    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));

    expect((await screen.findByRole('status')).textContent).toContain('Inicia sesión como cliente');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Iniciar Sesión' })).toBeTruthy();
    const llamadas = fetchMock.mock.calls.map(([url]) => String(url));
    expect(llamadas.some(url => url.includes('/api/pagos/'))).toBe(false);
    expect(llamadas.some(url => url.endsWith('/api/pedidos'))).toBe(false);
    expect(redirigirAStripe).not.toHaveBeenCalled();
    expect(cantidadEnCarrito()).toBe(2);
  });
});

describe('checkout con transferencia', () => {
  it('crea el pedido, vacía el carrito y navega a pedidos sin pasar por Stripe', async () => {
    iniciarSesionCliente();
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url, init) => {
      if (url.endsWith('/api/carrito') && (init?.method ?? 'GET') === 'GET') return json(carritoGuardado);
      if (url.endsWith('/api/pedidos') && init?.method === 'POST') return json(pedidoCreado, 201);
      if (url.includes('/api/pedidos/cliente/')) return json({ success: true, pedidos: [] });
      return json({ success: false, message: `fetch inesperado: ${url}` }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    montarCheckout();
    completarFormulario();
    fireEvent.change(screen.getByLabelText('Método de pago'), { target: { value: 'transferencia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    expect(await screen.findByRole('heading', { name: 'Mis pedidos' })).toBeTruthy();
    expect(await screen.findByText('Aún no has hecho pedidos')).toBeTruthy();
    expect(redirigirAStripe).not.toHaveBeenCalled();
    expect(cantidadEnCarrito()).toBeUndefined();

    const llamadas = fetchMock.mock.calls.map(([url]) => String(url));
    expect(llamadas.some(url => url.includes('/api/pagos/'))).toBe(false);
  });
});
