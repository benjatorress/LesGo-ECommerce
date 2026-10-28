import { PRODUCTS, type Product } from '../data/products';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface FilterParams {
  categoria?: string;
  min_precio?: number;
  max_precio?: number;
  min_piezas?: number;
  max_piezas?: number;
  edad?: string;
  search?: string;
}

export interface ApiResponse {
  success: boolean;
  total: number;
  productos: Product[];
  filtrosAplicados?: Record<string, unknown>;
}

export interface ProductDetailResponse {
  success: boolean;
  producto: Product;
}

function getLocalProducts(filters: FilterParams): Product[] {
  const category = filters.categoria?.trim().toLowerCase();
  const search = filters.search?.trim().toLowerCase();
  const age = filters.edad?.trim().toLowerCase();
  const ageGroups: Record<string, string[]> = {
    kids: ['5', '7', '8'],
    teens: ['10', '12'],
    adults: ['16', '18']
  };

  return PRODUCTS.filter(product => {
    if (category && category !== 'all' && category !== 'todos' &&
        !product.category.toLowerCase().includes(category) &&
        !product.theme.toLowerCase().includes(category)) {
      return false;
    }
    if (filters.min_precio !== undefined && product.price < filters.min_precio) return false;
    if (filters.max_precio !== undefined && product.price > filters.max_precio) return false;
    if (filters.min_piezas !== undefined && product.pieces < filters.min_piezas) return false;
    if (filters.max_piezas !== undefined && product.pieces > filters.max_piezas) return false;

    if (age && age !== 'all') {
      const acceptedAges = ageGroups[age] || [age];
      if (!acceptedAges.some(value => product.age.toLowerCase().includes(value))) {
        return false;
      }
    }
    if (search) {
      const searchableFields = [product.name, product.theme, product.category, product.code];
      if (!searchableFields.some(value => value.toLowerCase().includes(search))) {
        return false;
      }
    }
    return true;
  }).map(product => ({ ...product, inventorySource: 'mock' }));
}

/**
 * Catálogo local por defecto; VITE_CATALOG_SOURCE=api consulta GET /api/productos.
 */
export async function getProductosApi(filters: FilterParams = {}): Promise<Product[]> {
  const source = import.meta.env.VITE_CATALOG_SOURCE || 'local';
  if (source === 'local') {
    return getLocalProducts(filters);
  }
  if (source !== 'api') {
    throw new Error('VITE_CATALOG_SOURCE debe ser local o api.');
  }

  const queryParams = new URLSearchParams();

  if (filters.categoria && filters.categoria !== 'all') {
    queryParams.append('categoria', filters.categoria);
  }
  if (filters.min_precio !== undefined && filters.min_precio > 0) {
    queryParams.append('min_precio', filters.min_precio.toString());
  }
  if (filters.max_precio !== undefined && filters.max_precio > 0) {
    queryParams.append('max_precio', filters.max_precio.toString());
  }
  if (filters.min_piezas !== undefined && filters.min_piezas > 0) {
    queryParams.append('min_piezas', filters.min_piezas.toString());
  }
  if (filters.max_piezas !== undefined && filters.max_piezas > 0) {
    queryParams.append('max_piezas', filters.max_piezas.toString());
  }
  if (filters.edad && filters.edad !== 'all') {
    queryParams.append('edad', filters.edad);
  }
  if (filters.search && filters.search.trim()) {
    queryParams.append('search', filters.search.trim());
  }

  const url = `${API_BASE_URL}/productos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error HTTP: ${res.status}`);
    }
    const data: ApiResponse = await res.json();
    if (data.success && Array.isArray(data.productos)) {
      return data.productos;
    }
    throw new Error('Respuesta de catálogo inválida.');
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.', { cause: error });
  }
}

/**
 * Consulta el detalle de un producto por ID o código GET /api/productos/:id
 */
export async function getProductoByIdApi(id: string, signal?: AbortSignal): Promise<Product | null> {
  const url = `${API_BASE_URL}/productos/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, { signal });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Error HTTP: ${res.status}`);
    }
    const data: ProductDetailResponse = await res.json();
    if (!data.success || !data.producto) throw new Error('Detalle de producto inválido.');
    return data.producto;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'No se pudo cargar el producto.', { cause: error });
  }
}

/* ==========================================================================
   SERVICIOS DE AUTENTICACIÓN (LOGIN / SESIÓN)
   ========================================================================== */

export interface Usuario {
  tipo: 'empleado' | 'cliente';
  id_empleado?: number;
  id_cliente?: number;
  nombre: string;
  apellido?: string;
  nombre_completo: string;
  rut: string;
  email: string;
  direccion?: string;
  telefono?: string;
  id_cargo?: number;
  id_departamento?: number;
  fecha_ingreso?: string;
  estado: string;
  acceso_modulo_ventas: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  usuario?: Usuario;
  reason?: 'missing_fields' | 'invalid_credentials' | 'user_inactive' | 'network_error' | 'unknown_error';
  statusHttp?: number;
}

const STORAGE_KEY_TOKEN = 'lesgo_auth_token';
const STORAGE_KEY_USER = 'lesgo_auth_user';

/**
 * Guarda el token y el usuario en LocalStorage (y SessionStorage de respaldo)
 */
export function saveSession(token: string, usuario: Usuario): void {
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(usuario));
    sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
    sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(usuario));
  } catch (err) {
    console.warn('No se pudo guardar la sesión en Storage:', err);
  }
}

/**
 * Obtiene la sesión almacenada actualmente
 */
export function getSession(): { token: string | null; usuario: Usuario | null } {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN) || sessionStorage.getItem(STORAGE_KEY_TOKEN);
    const rawUser = localStorage.getItem(STORAGE_KEY_USER) || sessionStorage.getItem(STORAGE_KEY_USER);
    const usuario = rawUser ? (JSON.parse(rawUser) as Usuario) : null;
    return { token, usuario };
  } catch {
    return { token: null, usuario: null };
  }
}

/**
 * Elimina la sesión de LocalStorage y SessionStorage
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_USER);
  } catch (err) {
    console.warn('Error al limpiar la sesión:', err);
  }
}

/**
 * Llama a la API de inicio de sesión POST /api/auth/login
 * Maneja códigos HTTP 200, 400 y 401
 */
export async function loginApi(credentials: LoginCredentials): Promise<AuthResponse> {
  const url = `${API_BASE_URL}/auth/login`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Error de autenticación',
        reason: data.reason || (response.status === 401 ? 'invalid_credentials' : 'unknown_error'),
        statusHttp: response.status
      };
    }

    // Si la autenticación fue exitosa y trae token
    if (data.success && data.token && data.usuario) {
      saveSession(data.token, data.usuario);
    }

    return {
      success: true,
      message: data.message || 'Inicio de sesión exitoso',
      token: data.token,
      usuario: data.usuario,
      statusHttp: response.status
    };
  } catch (error) {
    if (import.meta.env.VITE_AUTH_OFFLINE_DEMO !== 'true') {
      return {
        success: false,
        message: 'No se pudo conectar con el servidor de autenticación.',
        reason: 'network_error'
      };
    }
    console.warn('Fallo de conexión con backend al iniciar sesión, evaluando respaldo local:', error);
    
    // Fallback de contingencia frontend con la misma lógica si el backend no está disponible
    const email = credentials.email?.trim().toLowerCase();
    const pass = credentials.password?.trim();

    if (!email || !pass) {
      return {
        success: false,
        message: 'Debe ingresar su correo electrónico y contraseña.',
        reason: 'missing_fields',
        statusHttp: 400
      };
    }

    if (email === 'inactivo@lesgo.cl') {
      return {
        success: false,
        message: 'Tu cuenta de empleado se encuentra inactiva. Contacta al administrador del ERP o RRHH.',
        reason: 'user_inactive',
        statusHttp: 401
      };
    }

    if (email === 'vendedor@lesgo.cl' && pass === 'password123') {
      const usuario: Usuario = {
        tipo: 'empleado',
        id_empleado: 1,
        id_cargo: 2,
        id_departamento: 3,
        nombre: 'Carlos',
        apellido: 'Santana',
        nombre_completo: 'Carlos Santana',
        rut: '18.452.981-4',
        email: 'vendedor@lesgo.cl',
        estado: 'activo',
        acceso_modulo_ventas: true
      };
      const token = `token_offline_emp_${Date.now()}`;
      saveSession(token, usuario);
      return {
        success: true,
        message: 'Inicio de sesión exitoso como Empleado (Modo local).',
        token,
        usuario,
        statusHttp: 200
      };
    }

    if (email === 'cliente@lesgo.cl' && pass === 'password123') {
      const usuario: Usuario = {
        tipo: 'cliente',
        id_cliente: 1,
        nombre: 'Valentina Soto',
        nombre_completo: 'Valentina Soto',
        rut: '20.345.678-9',
        email: 'cliente@lesgo.cl',
        estado: 'activo',
        acceso_modulo_ventas: false
      };
      const token = `token_offline_cli_${Date.now()}`;
      saveSession(token, usuario);
      return {
        success: true,
        message: 'Inicio de sesión exitoso como Cliente (Modo local).',
        token,
        usuario,
        statusHttp: 200
      };
    }

    return {
      success: false,
      message: 'Correo o contraseña incorrectos.',
      reason: 'invalid_credentials',
      statusHttp: 401
    };
  }
}

/**
 * Solicita recuperación / cambio de contraseña POST /api/auth/forgot-password
 */
export async function solicitarCambioPasswordApi(email: string): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}/auth/forgot-password`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    return {
      success: response.ok && data.success,
      message: data.message || 'Se ha procesado tu solicitud.'
    };
  } catch {
    return {
      success: true,
      message: `Enlace para cambiar contraseña generado y enviado a ${email} (Modo simulado).`
    };
  }
}
