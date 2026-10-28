import { randomBytes } from 'node:crypto';
import { AppError } from '../lib/errors.js';

const sessions = new Map();
const TTL = 8 * 60 * 60 * 1000;

export function issueSession(usuario) {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expires <= now) {
      sessions.delete(token);
    }
  }
  const token = randomBytes(32).toString('hex');
  const customer = { ...usuario };
  delete customer.password;
  sessions.set(token, { customer, expires: now + TTL });
  return token;
}

export function requireCustomer(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return next(new AppError(503, 'AUTH_NOT_CONFIGURED', 'La autenticación de producción está pendiente de integración.'));
  }
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  const session = sessions.get(token);
  if (!session || session.expires <= Date.now()) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Inicia sesión nuevamente.'));
  }
  if (!session.customer.id_cliente) {
    return next(new AppError(403, 'CUSTOMER_REQUIRED', 'Se requiere una sesión de cliente.'));
  }
  req.customer = session.customer;
  next();
}
