import { useEffect, useState } from 'react';
import type { Product } from '../data/products';
import { getProductoByIdApi } from '../services/api';
import { ProductDetailModal } from './ProductDetailModal';

interface Props {
  id: string;
  onClose: () => void;
  onAddToCart: (product: Product, quantity?: number) => boolean;
  onBuyNow: (product: Product, quantity?: number) => boolean;
}

export function ProductDetailLoader({ id, ...actions }: Props) {
  const [result, setResult] = useState<{ product?: Product; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    getProductoByIdApi(id, controller.signal).then(product => {
      if (!controller.signal.aborted) {
        setResult(product ? { product } : { error: 'Producto no encontrado.' });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setResult({ error: 'No se pudo cargar el producto. Inténtalo más tarde.' });
      }
    });
    return () => controller.abort();
  }, [id]);

  if (result.product) {
    return <ProductDetailModal product={result.product} {...actions} />;
  }
  return (
    <div className="product-modal-overlay" role="dialog" aria-modal="true" aria-label="Detalle de producto">
      <div className="product-detail-card">
        <button type="button" onClick={actions.onClose} aria-label="Cerrar detalle de producto">
          Cerrar
        </button>
        <p role={result.error ? 'alert' : 'status'}>{result.error || 'Cargando producto…'}</p>
      </div>
    </div>
  );
}
