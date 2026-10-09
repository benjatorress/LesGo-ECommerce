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
