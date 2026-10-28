import { pool } from './config/db.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 5000;

try {
  const result = await pool.query('SELECT NOW()');

  console.log('✅ PostgreSQL conectado');
  console.log(result.rows[0]);
} catch (error) {
  console.error('❌ Error conexión PostgreSQL');
  console.error(error);
}

const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor LesGo Backend ejecutándose en http://localhost:${PORT}`);
  console.log(`📦 Endpoint de productos: http://localhost:${PORT}/api/productos`);
  console.log(`🔐 Endpoint de autenticación: http://localhost:${PORT}/api/auth/login`);
  console.log(`🧾 Endpoint de pedidos: http://localhost:${PORT}/api/pedidos/cliente/:id`);
  console.log(`🛒 Endpoint de carrito: http://localhost:${PORT}/api/carrito`);
});
