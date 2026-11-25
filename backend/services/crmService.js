import { createHttpClient, configuredUrl } from './httpClient.js';

export function createCrmAdapter(env = process.env, fetchImpl = fetch) {
  const mode = env.CRM_MODE || 'disabled';
  if (!['disabled', 'mock', 'http'].includes(mode)) {
    throw new Error('CRM_MODE inválido');
  }
  if (mode === 'http' && env.CRM_IDEMPOTENCY_SUPPORTED !== 'true') {
    throw new Error('CRM HTTP requiere confirmar soporte de Idempotency-Key antes de habilitar envíos');
  }
  const url = mode === 'http' ? configuredUrl(env.CRM_API_URL, env.CRM_ORDER_PATH) : null;
  const request = createHttpClient({ timeout: Number(env.CRM_TIMEOUT_MS || 5000), token: env.CRM_API_TOKEN, fetchImpl });
  return {
    mode,
    async send(payload, key) {
      if (mode !== 'http') {
        return mode === 'mock' ? 'mock' : 'pending';
      }
      await request(url, {
        method: 'POST',
        body: payload,
        headers: { 'Idempotency-Key': key }
      });
      return 'synced';
    }
  };
}