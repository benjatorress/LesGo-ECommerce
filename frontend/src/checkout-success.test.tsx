// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { CartProvider } from './context/CartContext';
import { CheckoutSuccessView } from './components/CheckoutSuccessView';
import { PRODUCTS } from './data/products';

const product = { ...PRODUCTS[0], stock: 5 };
const mount = () => render(<CartProvider><App /></CartProvider>);

const pago = (estado: string) => ({
  success: true,
  pago: { estado, id_pedido: 12, monto: 179980, moneda: 'clp', pagado_en: '2026-11-14T12:00:00.000Z' }
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('vista de éxito', () => {
  it('pagada: aprueba, muestra el detalle y vacía el carrito', async () => {
    localStorage.setItem('lesgo_cart', JSON.stringify([{ product, quantity: 2 }]));
    localStorage.setItem('lesgo_auth_token', 'tok');
    window.history.replaceState({}, '', '/?view=checkout-success&session_id=cs_test_1');
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) => {
      if (url.includes('/pagos/stripe/session/')) return Promise.resolve(Response.json(pago('pagada')));
      return Promise.resolve(Response.json({ success: true, eliminados: 1 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    mount();

    expect(await screen.findByRole('heading', { name: 'Pago aprobado' })).toBeTruthy();
    expect(screen.getByText('#12')).toBeTruthy();
    expect(screen.getByText('$179.980')).toBeTruthy();
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('lesgo_cart') || '[]')).toEqual([]);
    });
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).endsWith('/api/carrito') && init?.method === 'DELETE'
    )).toBe(true);
  });

  it('expirada: informa el fallo y conserva el carrito', async () => {
    localStorage.setItem('lesgo_cart', JSON.stringify([{ product, quantity: 2 }]));
    window.history.replaceState({}, '', '/?view=checkout-success&session_id=cs_test_2');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json(pago('expirada')))));
    mount();

    expect(await screen.findByRole('heading', { name: 'El pago no se completó' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver al checkout' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('lesgo_cart') || '[]')[0].quantity).toBe(2);
  });

  it('sin session_id: pide volver al catálogo', async () => {
    window.history.replaceState({}, '', '/?view=checkout-success');
    vi.stubGlobal('fetch', vi.fn());
    mount();

    expect(screen.getByRole('heading', { name: 'No encontramos la sesión de pago' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ir al catálogo' })).toBeTruthy();
  });
});

describe('polling del estado de pago', () => {
  it('reintenta mientras está abierta y se detiene cuando el webhook confirma', async () => {
    window.history.replaceState({}, '', '/?view=checkout-success&session_id=cs_test_poll');
    let consultas = 0;
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => {
      consultas += 1;
      return Promise.resolve(Response.json(pago(consultas === 1 ? 'abierta' : 'pagada')));
    });
    vi.stubGlobal('fetch', fetchMock);

    const onClearCart = vi.fn();
    render(
      <CheckoutSuccessView
        onClearCart={onClearCart}
        onGoToOrders={vi.fn()}
        onGoToCatalog={vi.fn()}
        onBackToCheckout={vi.fn()}
      />
    );

    // Primer intento: el webhook todavía no llegó.
    expect(await screen.findByText('Tu pago aún se está procesando')).toBeTruthy();

    // Segundo intento (a los ~2000 ms) devuelve el pago confirmado.
    expect(
      await screen.findByRole('heading', { name: 'Pago aprobado' }, { timeout: 6000 })
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(onClearCart).toHaveBeenCalled());

    // Ya no hay más consultas: el polling se detuvo.
    await new Promise(resolve => setTimeout(resolve, 2200));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15000);
});
