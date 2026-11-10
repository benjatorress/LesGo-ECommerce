# LesGo E-Commerce

Node/Express backend + React/Vite frontend. Postgres (Neon) for orders/inventory.

## graphify
Check `graphify-out/graph.json` before answering codebase questions; rebuild after code changes: `graphify --update`.

## DB
Backend `.env`: ORDER_REPOSITORY=postgres, DB_ACCESS_ENABLED=true. DB creds in backend/.env (from frontend/.env). Tables: inventario.inv_producto, ecommerce_ventas.ecom_venta.

## Key files
- backend/config/db.js — pg Pool
- backend/repositories/cartRepository.js — joins inventario.inv_producto
- backend/.env.example — config template
