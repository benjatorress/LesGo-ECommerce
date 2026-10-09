import { PRODUCTOS } from '../data/productosData.js';

/**
 * Controlador para obtener productos con filtros:
 * - categoria (o category)
 * - min_precio (o min_price)
 * - max_precio (o max_price)
 * - min_piezas
 * - max_piezas
 * - edad
 * - search (o q)
 * - orden (precio_asc, precio_desc, nombre, piezas)
 */
export const getProductos = (req, res) => {
  try {
    const {
      categoria,
      category,
      min_precio,
      min_price,
      max_precio,
      max_price,
      min_piezas,
      max_piezas,
      edad,
      search,
      q,
      orden
    } = req.query;

    const targetCategory = (categoria || category || '').trim().toLowerCase();
    const minPriceNum = parseFloat(min_precio || min_price);
    const maxPriceNum = parseFloat(max_precio || max_price);
    const minPiecesNum = parseFloat(min_piezas);
    const maxPiecesNum = parseFloat(max_piezas);
    const targetEdad = (edad || '').trim().toLowerCase();
    const searchQuery = (search || q || '').trim().toLowerCase();

    let resultado = PRODUCTOS.filter((prod) => {
      // Filtro por categoría (soporta 'all' o 'todos' para traer todo)
      if (targetCategory && targetCategory !== 'all' && targetCategory !== 'todos') {
        const matchesCategory =
          prod.categoria.toLowerCase().includes(targetCategory) ||
          prod.theme.toLowerCase().includes(targetCategory);
        if (!matchesCategory) return false;
      }

      // Filtro por precio mínimo
      if (!isNaN(minPriceNum) && prod.price < minPriceNum) {
        return false;
      }

      // Filtro por precio máximo
      if (!isNaN(maxPriceNum) && prod.price > maxPriceNum) {
        return false;
      }

      // Filtro por piezas mínimas
      if (!isNaN(minPiecesNum) && prod.pieces < minPiecesNum) {
        return false;
      }

      // Filtro por piezas máximas
      if (!isNaN(maxPiecesNum) && prod.pieces > maxPiecesNum) {
        return false;
      }

      // Filtro por edad
      if (targetEdad && targetEdad !== 'all') {
        const prodAge = prod.age.toLowerCase();
        if (targetEdad === 'kids' && !prodAge.includes('5') && !prodAge.includes('7') && !prodAge.includes('8')) {
          return false;
        } else if (targetEdad === 'teens' && !prodAge.includes('10') && !prodAge.includes('12')) {
          return false;
        } else if (targetEdad === 'adults' && !prodAge.includes('16') && !prodAge.includes('18')) {
          return false;
        } else if (targetEdad !== 'kids' && targetEdad !== 'teens' && targetEdad !== 'adults' && !prodAge.includes(targetEdad)) {
          return false;
        }
      }

      // Filtro por búsqueda de texto
      if (searchQuery) {
        const matchesSearch =
          prod.name.toLowerCase().includes(searchQuery) ||
          prod.theme.toLowerCase().includes(searchQuery) ||
          prod.categoria.toLowerCase().includes(searchQuery) ||
          prod.code.toLowerCase().includes(searchQuery);
        if (!matchesSearch) return false;
      }

      return true;
    });

    // Ordenamiento opcional
    if (orden === 'precio_asc') {
      resultado.sort((a, b) => a.price - b.price);
    } else if (orden === 'precio_desc') {
      resultado.sort((a, b) => b.price - a.price);
    } else if (orden === 'nombre') {
      resultado.sort((a, b) => a.name.localeCompare(b.name));
    } else if (orden === 'piezas') {
      resultado.sort((a, b) => b.pieces - a.pieces);
    }

    return res.json({
      success: true,
      total: resultado.length,
      filtrosAplicados: {
        categoria: targetCategory || null,
        min_precio: !isNaN(minPriceNum) ? minPriceNum : null,
        max_precio: !isNaN(maxPriceNum) ? maxPriceNum : null,
        min_piezas: !isNaN(minPiecesNum) ? minPiecesNum : null,
        max_piezas: !isNaN(maxPiecesNum) ? maxPiecesNum : null,
        edad: targetEdad || null,
        search: searchQuery || null,
        orden: orden || null
      },
      productos: resultado
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al procesar los productos',
      error: error.message
    });
  }
};

/**
 * Controlador para obtener un producto por ID
 */
export const getProductoById = (req, res) => {
  try {
    const { id } = req.params;
    const producto = PRODUCTOS.find((p) => p.id === id || p.code === id);

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: `Producto con ID o Código "${id}" no encontrado.`
      });
    }

    return res.json({
      success: true,
      producto
    });
  } catch (error) {
    console.error('Error al buscar producto:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al buscar el producto',
      error: error.message
    });
  }
};
