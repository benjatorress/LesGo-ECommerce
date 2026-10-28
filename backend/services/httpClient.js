import { AppError } from '../lib/errors.js';

export function createHttpClient({ timeout = 5000, token, fetchImpl = fetch } = {}) {
  if (!Number.isInteger(Number(timeout)) || Number(timeout) <= 0) {
    throw new Error('Timeout inválido');
  }
  return async function request(url, { method = 'GET', body, headers = {}, notFound = false } = {}) {
    try {
      const response = await fetchImpl(url, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(Number(timeout)),
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (response.status === 404 && notFound) {
        return null;
      }
      if (!response.ok) {
        throw new Error('HTTP externo');
      }
      if (response.status === 204) {
        return null;
      }
      return await response.json();
    } catch {
      throw new AppError(503, 'UPSTREAM_UNAVAILABLE', 'El servicio externo no está disponible. Inténtalo más tarde.');
    }
  };
}

export function configuredUrl(base, path) {
  if (!base || !path) {
    throw new Error('Falta URL o ruta del servicio externo');
  }
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('URL externa inválida');
  }
  return url.toString();
}
