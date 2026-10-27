import React, { useEffect, useState } from 'react';
import { X, Check, Loader2, AlertCircle, Truck, Send, CheckCircle2 } from 'lucide-react';
import {
  getPedidoDetalleApi,
  crearReclamoApi,
  type PedidoDetalle
} from '../services/pedidosApi';
import {
  ESTADO_ENVIO_LABEL,
  ESTADO_RECLAMO_META,
  MOTIVOS_RECLAMO,
  formatCLP,
  formatFecha,
  formatFechaHora,
  formatNumeroOrden,
  motivoLabel
} from '../utils/orderFormat';
import { OrderStatusBadge } from './OrderStatusBadge';

interface OrderDetailModalProps {
  idCliente: number;
  idPedido: number;
  onClose: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  idCliente,
  idPedido,
  onClose
}) => {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formulario de reclamo
  const [claimOpen, setClaimOpen] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS_RECLAMO[0].id);
  const [descripcion, setDescripcion] = useState('');
  const [sending, setSending] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSent, setClaimSent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPedidoDetalleApi(idCliente, idPedido)
      .then((data) => {
        if (!cancelled) setPedido(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [idCliente, idPedido]);

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();

    if (descripcion.trim().length < 10) {
      setClaimError('Cuéntanos qué pasó con al menos 10 caracteres.');
      return;
    }

    setSending(true);
    setClaimError(null);

    try {
      const reclamo = await crearReclamoApi({
        id_cliente: idCliente,
        id_pedido: idPedido,
        motivo,
        descripcion: descripcion.trim()
      });
      setPedido((prev) => (prev ? { ...prev, reclamos: [reclamo, ...prev.reclamos] } : prev));
      setClaimOpen(false);
      setDescripcion('');
      setClaimSent(true);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'No pudimos enviar tu reclamo.');
    } finally {
      setSending(false);
    }
  };

  // Primer paso aún no completado = "en curso"
  const indicePendiente = pedido ? pedido.seguimiento.findIndex((p) => !p.completado) : -1;
  const logistica = pedido?.logistica ?? null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card order-detail-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Cerrar detalle del pedido">
          <X size={18} />
        </button>

        {error ? (
          <div className="orders-state-card orders-state-inline">
            <AlertCircle size={28} color="#E52521" />
            <p className="orders-state-title">No pudimos cargar el pedido</p>
            <p className="orders-state-text">{error}</p>
          </div>
        ) : !pedido ? (
          <div className="orders-state-card orders-state-inline">
            <Loader2 size={28} className="animate-spin" color="#E52521" />
            <p className="orders-state-title">Cargando pedido…</p>
          </div>
        ) : (
          <>
            <div className="order-detail-header">
              <h2 className="modal-title">Pedido {formatNumeroOrden(pedido.id_pedido)}</h2>
              <div className="order-detail-sub">
                <span>Realizado el {formatFecha(pedido.fecha_pedido)}</span>
                <OrderStatusBadge estado={pedido.estado} />
              </div>
            </div>

            {/* Productos */}
            <section aria-label="Productos del pedido">
              <h3 className="order-section-title">Productos</h3>
              <ul className="order-items-list">
                {pedido.detalle.map((item) => (
                  <li key={item.id_detalle_pedido} className="order-item-row">
                    <div className="order-item-thumb">
                      <img src={item.imagen} alt={item.nombre} />
                    </div>
                    <div className="order-item-info">
                      <span className="order-item-name">{item.nombre}</span>
                      <span className="order-item-meta">
                        Set #{item.codigo} · {item.cantidad} × {formatCLP(item.precio_unitario)}
                      </span>
                    </div>
                    <span className="order-item-subtotal">{formatCLP(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="order-total-row">
                <span>Total</span>
                <strong>{formatCLP(pedido.monto_total)}</strong>
              </div>
            </section>

            {/* Seguimiento + Logística ERP */}
            <section aria-label="Seguimiento del pedido">
              <h3 className="order-section-title">Seguimiento</h3>

              {logistica ? (
                <div className="logistics-card">
                  <div className="logistics-head">
                    <div>
                      <span className="logistics-courier">
                        <Truck size={16} color="#6D28D9" />
                        {logistica.courier} · {ESTADO_ENVIO_LABEL[logistica.estado_envio]}
                      </span>
                      <p className="logistics-label">N° de seguimiento</p>
                      <p className="logistics-tracking-number">{logistica.numero_seguimiento}</p>
                    </div>
                    <p className="logistics-meta">
                      {logistica.fecha_entrega
                        ? `Entregado el ${formatFechaHora(logistica.fecha_entrega)}`
                        : `Entrega estimada: ${formatFecha(logistica.fecha_entrega_estimada)}`}
                    </p>
                  </div>

                  <ul className="logistics-events">
                    {[...logistica.eventos].reverse().map((ev) => (
                      <li key={ev.fecha} className="logistics-event">
                        <span>
                          {ev.descripcion} <span className="logistics-event-place">· {ev.ubicacion}</span>
                        </span>
                        <span className="logistics-event-date">{formatFechaHora(ev.fecha)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="logistics-source">Información provista por el módulo de Logística.</p>
                </div>
              ) : (
                <div className="logistics-empty">
                  El número de seguimiento aparecerá aquí cuando tu orden sea enviada.
                </div>
              )}

              <ol className="tracking-timeline">
                {pedido.seguimiento.map((paso, i) => {
                  const clase = paso.completado ? 'done' : i === indicePendiente ? 'current' : '';
                  return (
                    <li key={paso.clave} className={`tracking-step ${clase}`}>
                      <span className="tracking-marker" aria-hidden="true">
                        {paso.completado ? <Check size={13} strokeWidth={3} /> : null}
                      </span>
                      <div className="tracking-step-body">
                        <span className="tracking-step-title">{paso.titulo}</span>
                        <span className="tracking-step-desc">{paso.descripcion}</span>
                        <span className="tracking-step-date">
                          {paso.fecha ? formatFechaHora(paso.fecha) : 'Pendiente'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* Reclamos */}
            <section aria-label="Reclamos del pedido">
              <div className="claims-head">
                <h3 className="order-section-title">Reclamos</h3>
                {!claimOpen && (
                  <button
                    type="button"
                    className="claim-open-btn"
                    onClick={() => {
                      setClaimOpen(true);
                      setClaimSent(false);
                    }}
                  >
                    Levantar reclamo
                  </button>
                )}
              </div>

              {claimSent && (
                <div className="modal-alert-success" role="status">
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Reclamo enviado</strong>
                    <span>Lo recibimos y te responderemos por correo.</span>
                  </div>
                </div>
              )}

              {claimOpen && (
                <form className="claim-form" onSubmit={handleSubmitClaim}>
                  <div className="modal-input-group">
                    <label className="modal-input-label" htmlFor="claim-motivo">Motivo</label>
                    <select
                      id="claim-motivo"
                      className="modal-input"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                    >
                      {MOTIVOS_RECLAMO.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="modal-input-group">
                    <label className="modal-input-label" htmlFor="claim-descripcion">¿Qué pasó?</label>
                    <textarea
                      id="claim-descripcion"
                      className="modal-input claim-textarea"
                      rows={4}
                      maxLength={500}
                      value={descripcion}
                      onChange={(e) => {
                        setDescripcion(e.target.value);
                        if (claimError) setClaimError(null);
                      }}
                      placeholder="Describe el problema con el mayor detalle posible."
                    />
                    <span className="claim-counter">{descripcion.length}/500</span>
                  </div>

                  {claimError && (
                    <div className="modal-alert-error" role="alert">
                      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#DC2626' }} />
                      <div>{claimError}</div>
                    </div>
                  )}

                  <div className="claim-actions">
                    <button
                      type="button"
                      className="claim-cancel-btn"
                      onClick={() => {
                        setClaimOpen(false);
                        setClaimError(null);
                      }}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="orders-primary-btn claim-submit-btn" disabled={sending}>
                      {sending ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Enviando…</span>
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>Enviar reclamo</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {pedido.reclamos.length === 0 && !claimOpen ? (
                <p className="claims-empty">No has levantado reclamos para este pedido.</p>
              ) : (
                <ul className="claims-list">
                  {pedido.reclamos.map((r) => {
                    const meta = ESTADO_RECLAMO_META[r.estado];
                    return (
                      <li key={r.id_reclamo} className="claim-item">
                        <div className="claim-item-head">
                          <strong>{motivoLabel(r.motivo)}</strong>
                          <span className="order-status-badge" style={{ backgroundColor: meta.bg, color: meta.color }}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="claim-item-text">{r.descripcion}</p>
                        <span className="claim-item-date">Ingresado el {formatFecha(r.fecha_creacion)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};