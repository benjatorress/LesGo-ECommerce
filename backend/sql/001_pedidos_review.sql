-- SOLO REVISIÓN: no se ejecuta desde la aplicación ni desde CI.
-- Comparar con el DDL real y obtener autorización antes de aplicar.
-- No agrega FK a master ni modifica otros módulos.
BEGIN;
CREATE TABLE IF NOT EXISTS ecommerce_ventas.ecom_pedido (
  id_pedido INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente INTEGER NOT NULL,
  fecha_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  monto_total NUMERIC(14,2) NOT NULL CHECK (monto_total >= 0),
  estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
);
CREATE TABLE IF NOT EXISTS ecommerce_ventas.ecom_detalle_pedido (
  id_detalle_pedido INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pedido INTEGER NOT NULL REFERENCES ecommerce_ventas.ecom_pedido(id_pedido),
  id_producto UUID NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario >= 0)
);
ALTER TABLE ecommerce_ventas.ecom_pedido
  ADD COLUMN IF NOT EXISTS direccion_entrega VARCHAR(250),
  ADD COLUMN IF NOT EXISTS comuna_entrega VARCHAR(250),
  ADD COLUMN IF NOT EXISTS ciudad_entrega VARCHAR(250),
  ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(250),
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30),
  ADD COLUMN IF NOT EXISTS observaciones TEXT;
CREATE TABLE IF NOT EXISTS ecommerce_ventas.ecom_pedido_outbox (
  id_pedido INTEGER PRIMARY KEY REFERENCES ecommerce_ventas.ecom_pedido(id_pedido),
  id_cliente INTEGER NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  fingerprint TEXT NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending','synced','mock')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_cliente, idempotency_key)
);
CREATE INDEX IF NOT EXISTS ecom_pedido_cliente_fecha_idx ON ecommerce_ventas.ecom_pedido(id_cliente, fecha_pedido DESC, id_pedido DESC);
CREATE INDEX IF NOT EXISTS ecom_detalle_pedido_pedido_idx ON ecommerce_ventas.ecom_detalle_pedido(id_pedido);
COMMIT;
