// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { CartProvider } from './context/CartContext';
import { PRODUCTS } from './data/products';
import { CheckoutView } from './components/CheckoutView';

const product = { ...PRODUCTS[0], name: 'Producto actualizado desde Inventario', stock: 2 };
const mount = () => render(<CartProvider><App /></CartProvider>);
beforeEach(() => {
  vi.stubEnv('VITE_CATALOG_SOURCE', 'local');
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/?view=catalog');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('catálogo local: muestra PRODUCTS sin consultar el backend', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('Backend no disponible'));
  vi.stubGlobal('fetch', fetchMock);
  mount();

  await screen.findByTitle(PRODUCTS[0].name);
  for (const product of PRODUCTS) {
    expect(screen.getByTitle(product.name)).toBeTruthy();
  }
  expect(screen.getByRole('note').textContent).toContain('simulado');
  expect(fetchMock).not.toHaveBeenCalled();
});

function completeShippingForm() {
  const labels = ['Dirección de entrega', 'Comuna', 'Ciudad', 'Teléfono de contacto'];
  for (const label of labels) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'Datos prueba' } });
  }
}

describe('detalle por ID y navegación', () => {
  it('abre desde catálogo, muestra carga, recupera detalle, añade carrito y permite atrás/adelante', async () => {
    let resolveDetail: (value: Response) => void = () => {};
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/productos/')) {
        return new Promise<Response>(resolve => { resolveDetail = resolve; });
      }
      return Promise.resolve(Response.json({ success: true, productos: [PRODUCTS[0]] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    mount();
    fireEvent.click(await screen.findByTitle(PRODUCTS[0].name));
    expect(screen.getByRole('status').textContent).toContain('Cargando');
    expect(window.location.search).toContain(`producto=${product.id}`);
    resolveDetail(Response.json({ success: true, producto: product }));
    expect(await screen.findByRole('heading', { name: product.name })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir al Carrito' }));
    await waitFor(() => {
      const cart = JSON.parse(localStorage.getItem('lesgo_cart') || '[]');
      expect(cart[0].product.name).toBe(product.name);
    });
    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    window.history.forward();
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Cargando'));
    resolveDetail(Response.json({ success: true, producto: product }));
    expect(await screen.findByRole('heading', { name: product.name })).toBeTruthy();
  });

  it.each([404, 503])('enlace directo: muestra error %s sin usar datos locales', async status => {
    window.history.replaceState({}, '', '/?producto=missing');
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const response = url.includes('/productos/')
        ? new Response(null, { status })
        : Response.json({ success: true, productos: [] });
      return Promise.resolve(response);
    }));
    mount();
    expect((await screen.findByRole('alert')).textContent).toContain(status === 404 ? 'no encontrado' : 'No se pudo cargar');
    expect(screen.queryByRole('button', { name: 'Añadir al Carrito' })).toBeNull();
  });
});

it('carrito → checkout: resumen actual, formulario y confirmación sin pago ni pérdida de carrito', async () => {
  localStorage.setItem('lesgo_cart', JSON.stringify([{ product, quantity: 2 }]));
  window.history.replaceState({}, '', '/?view=cart');
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }));
  expect(screen.getByRole('heading', { name: 'Checkout' })).toBeTruthy();
  expect(screen.getByLabelText('Resumen final de la orden').textContent).toContain('2 × $89.990 = $179.980');
  completeShippingForm();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(screen.getByRole('status').textContent).toContain('No se ha creado un pedido ni procesado un pago');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('lesgo_cart') || '[]')[0].quantity).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'Volver al carrito' }));
  expect(screen.getByRole('heading', { name: 'Carrito' })).toBeTruthy();
});

it('callback preparado para SCRUM-20: payload sin precio/cliente, fallo conserva carrito', async () => {
  localStorage.setItem('lesgo_cart', JSON.stringify([{ product, quantity: 2 }]));
  const confirm = vi.fn(async () => { throw new Error('Error de confirmación simulado'); });
  render(
    <CartProvider>
      <CheckoutView onBack={() => {}} onConfirm={confirm} />
    </CartProvider>
  );
  completeShippingForm();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

  expect((await screen.findByRole('status')).textContent).toContain('Tu carrito se conserva');
  expect(confirm).toHaveBeenCalledWith({
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
  expect(JSON.parse(localStorage.getItem('lesgo_cart') || '[]')[0].quantity).toBe(2);
});
