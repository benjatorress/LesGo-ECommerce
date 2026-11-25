import { API_BASE_URL, getSession } from './api';

/**
 * Cliente HTTP mínimo compartido por los módulos de API que hablan con el
 * backend autenticado: inyecta el token de la sesión y normaliza los errores
 * en un `Error` con el `message` que devuelve el servidor.
 */
export async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    const token = getSession().token;
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo nuevamente.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Error HTTP ${res.status}`);
  }
  return data;
}
