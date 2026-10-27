import React, { useEffect, useState } from 'react';
import { Truck, RotateCcw, AlertCircle, LogIn, Package, Loader2 } from 'lucide-react';
import type { Usuario } from '../services/api';
import { getPedidosApi, type PedidoResumen } from '../services/pedidosApi';
import { formatCLP, formatFecha, formatNumeroOrden } from '../utils/orderFormat';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderDetailModal } from './OrderDetailModal';
import '../orders.css';

interface OrdersViewProps {
  currentUser: Usuario | null;
  onOpenLogin: () => void;
  onGoToCatalog: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  currentUser,
  onOpenLogin,
  onGoToCatalog
}) => {
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPedidoId, setSelectedPedidoId] = useState<number | null>(null);

  const idCliente = currentUser?.tipo === 'cliente' ? (currentUser.id_cliente ?? null) : null;

  useEffect(() => {
    if (idCliente === null) return;
    let cancelled = false;

    getPedidosApi(idCliente)
      .then((data) => {
        if (cancelled) return;
        setPedidos(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idCliente, reloadKey]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  // Sin sesión
  if (!currentUser) {
    return (
      <div className="orders-view">
        <div className="orders-state-card">
          <LogIn size={30} color="#E52521" />
          <p className="orders-state-title">Inicia sesión para ver tus pedidos</p>
          <p className="orders-state-text">Aquí encontrarás tus compras y el estado de cada despacho.</p>
          <button type="button" className="orders-primary-btn" onClick={onOpenLogin}>
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  // Sesión de empleado
  if (idCliente === null) {
    return (
      <div className="orders-view">
        <div className="orders-state-card">
          <AlertCircle size={30} color="#E52521" />
          <p className="orders-state-title">El historial es solo para clientes</p>
          <p className="orders-state-text">
            Estás conectado como empleado. Cierra sesión e ingresa con una cuenta de cliente para ver pedidos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-view">
      <div className="orders-header-row">
        <h1 className="orders-heading">Mis pedidos</h1>
        {!loading && !error && (
          <span className="orders-counter-tag">
            {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="orders-state-card">
          <Loader2 size={28} className="animate-spin" color="#E52521" />
          <p className="orders-state-title">Cargando tus pedidos…</p>
        </div>
      ) : error ? (
        <div className="orders-state-card">
          <AlertCircle size={30} color="#E52521" />
          <p className="orders-state-title">No pudimos cargar tus pedidos</p>
          <p className="orders-state-text">{error}</p>
          <button type="button" className="orders-primary-btn" onClick={handleRetry}>
            <RotateCcw size={15} />
            <span>Reintentar</span>
          </button>
        </div>
      ) : pedidos.length === 0 ? (
        <div className="orders-state-card">
          <Package size={30} color="#E52521" />
          <p className="orders-state-title">Aún no has hecho pedidos</p>
          <p className="orders-state-text">Cuando compres un set, aparecerá aquí con su seguimiento.</p>
          <button type="button" className="orders-primary-btn" onClick={onGoToCatalog}>
            Explorar catálogo
          </button>
        </div>
      ) : (
        <section className="orders-table-card" aria-label="Historial de pedidos">
          <div className="orders-table-scroll">
            <table className="orders-table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">N° Orden</th>
                  <th scope="col" className="orders-col-right">Total</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="orders-col-right">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id_pedido}>
                    <td>{formatFecha(pedido.fecha_pedido)}</td>
                    <td>
                      <span className="order-number">{formatNumeroOrden(pedido.id_pedido)}</span>
                      <span className="order-items-hint">
                        {pedido.total_items} {pedido.total_items === 1 ? 'set' : 'sets'}
                      </span>
                    </td>
                    <td className="orders-col-right">
                      <span className="order-total">{formatCLP(pedido.monto_total)}</span>
                    </td>
                    <td>
                      <OrderStatusBadge estado={pedido.estado} />
                      {pedido.numero_seguimiento && (
                        <span className="order-items-hint">
                          {pedido.courier} · {pedido.numero_seguimiento}
                        </span>
                      )}
                    </td>
                    <td className="orders-col-right">
                      <button
                        type="button"
                        className="order-detail-btn"
                        onClick={() => setSelectedPedidoId(pedido.id_pedido)}
                      >
                        <Truck size={15} />
                        <span>Ver Detalle / Tracking</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedPedidoId !== null && idCliente !== null && (
        <OrderDetailModal
          idCliente={idCliente}
          idPedido={selectedPedidoId}
          onClose={() => setSelectedPedidoId(null)}
        />
      )}
    </div>
  );
};