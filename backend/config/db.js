import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Sin timeout, un host que no responde deja `pool.connect()` esperando para
  // siempre: la petición queda colgada y la UI no muestra ningún error. 15 s
  // porque el compute de Neon se suspende y el primer handshake tarda en despertar.
  connectionTimeoutMillis: 15000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Un cliente idle que Neon corta emite 'error' en el pool; sin listener el
// evento es no controlado y tumba el proceso (el contenedor reinicia solo).
pool.on('error', () => console.error('Conexión PostgreSQL interrumpida.'));