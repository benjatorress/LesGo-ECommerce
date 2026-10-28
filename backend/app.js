import express from 'express';
import cors from 'cors';
import productosRoutes from './routes/productosRoutes.js';
import authRoutes from './routes/authRoutes.js';
import carritoRoutes from './routes/carritoRoutes.js';
import pedidosRoutes from './routes/pedidosRoutes.js';
import reclamosRoutes from './routes/reclamosRoutes.js';
import { createInventoryService } from './services/inventoryService.js';
import { createOrderRepository } from './repositories/orderRepository.js';
import { createCrmAdapter } from './services/crmService.js';
import { pedidoReadService } from './services/pedidosService.js';
import { errorHandler } from './lib/errors.js';

export function createApp({ inventory, orders, crm, pedidoReader } = {}) {
  const app = express();
  app.locals.inventory = inventory || createInventoryService();
  app.locals.orders = orders || createOrderRepository();
  app.locals.crm = crm || createCrmAdapter();
  app.locals.pedidoReader = pedidoReader || pedidoReadService;
  app.use(cors());
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (req, res) => res.json({
    status: 'ok',
    service: 'LesGo E-Commerce Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    inventory: app.locals.inventory.mode,
    persistence: app.locals.orders.mode,
    crm: app.locals.crm.mode
  }));
  app.use('/api/auth', authRoutes);
  app.use('/api/productos', productosRoutes);
  app.use('/api/products', productosRoutes);
  app.use('/api/carrito', carritoRoutes);
  app.use('/api/pedidos', pedidosRoutes);
  app.use('/api/reclamos', reclamosRoutes);
  app.use((req, res) => res.status(404).json({ success: false, message: 'Ruta no encontrada.' }));
  app.use(errorHandler);
  return app;
}
