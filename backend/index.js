import express from 'express';
import cors from 'cors';
import productosRoutes from './routes/productosRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pedidosRoutes from './routes/pedidosRoutes.js';
import carritoRoutes from './routes/carritoRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares globales
app.use(cors());
app.use(express.json());

// Endpoint de verificación de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LesGo E-Commerce Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de productos (soporta tanto /api/productos como /api/products)
app.use('/api/productos', productosRoutes);
app.use('/api/products', productosRoutes);

app.use('/api/pedidos', pedidosRoutes);
// Rutas de carrito
app.use('/api/carrito', carritoRoutes);

// Manejador para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor LesGo Backend ejecutándose en http://localhost:${PORT}`);
  console.log(`📦 Endpoint de productos: http://localhost:${PORT}/api/productos`);
  console.log(`🔐 Endpoint de autenticación: http://localhost:${PORT}/api/auth/login`);
  console.log(`🧾 Endpoint de pedidos: http://localhost:${PORT}/api/pedidos/cliente/:id`);
  console.log(`🛒 Endpoint de carrito: http://localhost:${PORT}/api/carrito`);
});
