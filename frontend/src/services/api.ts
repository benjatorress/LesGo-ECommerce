import { PRODUCTS, type Product } from '../data/products';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  filtrosAplicados?: Record<string, any>;
}

export interface ProductDetailResponse {
  success: boolean;
  producto: Product;
}

/**
 * Consulta el endpoint GET /api/productos con soporte de filtros
 */
export async function getProductosApi(filters: FilterParams = {}): Promise<Product[]> {
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
    return data.productos || [];
  } catch (error) {
    console.warn('No se pudo conectar con el backend en', url, 'usando filtrado local de respaldo:', error);
    
    // Respaldo resiliente en frontend si el servidor no responde
    return PRODUCTS.filter((prod) => {
      if (filters.categoria && filters.categoria !== 'all') {
        const cat = filters.categoria.toLowerCase();
        if (!prod.category.toLowerCase().includes(cat) && !prod.theme.toLowerCase().includes(cat)) {
          return false;
        }
      }
      if (filters.min_precio !== undefined && prod.price < filters.min_precio) {
        return false;
      }
      if (filters.max_precio !== undefined && prod.price > filters.max_precio) {
        return false;
      }
      if (filters.min_piezas !== undefined && prod.pieces < filters.min_piezas) {
        return false;
      }
      if (filters.max_piezas !== undefined && prod.pieces > filters.max_piezas) {
        return false;
      }
      if (filters.edad && filters.edad !== 'all') {
        const prodAge = prod.age.toLowerCase();
        if (filters.edad === 'kids' && !prodAge.includes('5') && !prodAge.includes('7') && !prodAge.includes('8')) {
          return false;
        } else if (filters.edad === 'teens' && !prodAge.includes('10') && !prodAge.includes('12')) {
          return false;
        } else if (filters.edad === 'adults' && !prodAge.includes('16') && !prodAge.includes('18')) {
          return false;
        } else if (filters.edad !== 'kids' && filters.edad !== 'teens' && filters.edad !== 'adults' && !prodAge.includes(filters.edad)) {
          return false;
        }
      }
      if (filters.search && filters.search.trim()) {
        const s = filters.search.toLowerCase();
        if (!prod.name.toLowerCase().includes(s) && !prod.theme.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });
  }
}

/**
 * Consulta el detalle de un producto por ID o código GET /api/productos/:id
 */
export async function getProductoByIdApi(id: string): Promise<Product | null> {
  const url = `${API_BASE_URL}/productos/${id}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error HTTP: ${res.status}`);
    }
    const data: ProductDetailResponse = await res.json();
    return data.producto || null;
  } catch (error) {
    console.warn('Error al consultar producto por ID en el backend, usando fallback local:', error);
    return PRODUCTS.find((p) => p.id === id || p.code === id) || null;
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

