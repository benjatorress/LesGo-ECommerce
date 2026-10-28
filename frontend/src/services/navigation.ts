import { useEffect, useState } from 'react';
import type { ViewType } from '../components/Navbar';

const views: ViewType[] = ['home', 'catalog', 'cart', 'checkout', 'nosotros', 'contacto', 'pedidos'];
function readLocation() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('view') as ViewType;
  const productId = params.get('producto');
  const defaultView: ViewType = productId ? 'catalog' : 'home';
  return {
    view: views.includes(requested) ? requested : defaultView,
    productId
  };
}

export function useNavigation() {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const sync = () => setLocation(readLocation());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  function navigate(view: ViewType, productId: string | null = null, replace = false) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    if (productId) {
      url.searchParams.set('producto', productId);
    } else {
      url.searchParams.delete('producto');
    }
    window.history[replace ? 'replaceState' : 'pushState']({ lesgoProduct: !!productId }, '', url);
    setLocation({ view, productId });
  }
  function closeProduct() {
    if (window.history.state?.lesgoProduct) {
      window.history.back();
    } else {
      navigate(location.view, null, true);
    }
  }
  return { ...location, navigate, closeProduct };
}
