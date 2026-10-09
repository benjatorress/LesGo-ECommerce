import React, { useState, useEffect } from 'react';
import { Search, Plus, X, SlidersHorizontal, RotateCcw, Layers, Baby, Coins } from 'lucide-react';
import type { Product } from '../data/products';
import { getProductosApi } from '../services/api';

interface CatalogViewProps {
  initialCategory?: string;
  onAddToCart?: (product: Product) => void;
  onSelectProduct?: (product: Product) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  initialCategory = 'all',
  onAddToCart,
  onSelectProduct
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);

  // Filtros de Rango de Precio
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(250000);

  // Filtros de Piezas
  const [minPieces, setMinPieces] = useState<number>(0);
  const [piecesPreset, setPiecesPreset] = useState<string>('all');

  // Filtro de Edad
  const [selectedAge, setSelectedAge] = useState<string>('all');

  // Estado de productos y carga
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const categories = [
    { id: 'all', label: 'Todos los Sets', color: '#E52521' },
    { id: 'City', label: 'Lego City', color: '#10B981' },
    { id: 'Star Wars', label: 'Star Wars', color: '#0284C7' },
    { id: 'Marvel', label: 'Marvel & DC', color: '#F59E0B' },
    { id: 'Ninjago', label: 'Lego Ninjago', color: '#EC4899' },
    { id: 'Especiales', label: 'Especiales', color: '#8B5CF6' }
  ];

  const piecePresets = [
    { id: 'all', label: 'Cualquiera', min: 0, max: undefined },
    { id: 'under300', label: '< 300 pcs', min: 0, max: 300 },
    { id: '300to800', label: '300-800 pcs', min: 300, max: 800 },
    { id: 'over800', label: '800+ pcs', min: 800, max: undefined }
  ];

  const ageOptions = [
    { id: 'all', label: 'Todas las edades', badge: 'Todos' },
    { id: 'kids', label: '5 - 7 años', badge: 'Kids' },
    { id: 'teens', label: '8 - 12 años', badge: 'Junior' },
    { id: 'adults', label: '16+ años', badge: 'Adults' }
  ];

  // Llamada a la API con todos los filtros combinados
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    const activePiecePreset = piecePresets.find(p => p.id === piecesPreset);
    let calculatedMinPieces: number | undefined = undefined;
    let calculatedMaxPieces: number | undefined = undefined;

    if (piecesPreset === 'custom') {
      if (minPieces > 0) calculatedMinPieces = minPieces;
    } else if (activePiecePreset && activePiecePreset.id !== 'all') {
      calculatedMinPieces = activePiecePreset.min > 0 ? activePiecePreset.min : undefined;
      calculatedMaxPieces = activePiecePreset.max;
    }

    const timer = setTimeout(() => {
      getProductosApi({
        categoria: selectedCategory,
        min_precio: minPrice > 0 ? minPrice : undefined,
        max_precio: maxPrice < 250000 ? maxPrice : undefined,
        min_piezas: calculatedMinPieces,
        max_piezas: calculatedMaxPieces,
        edad: selectedAge,
        search: searchQuery
      })
        .then((data) => {
          if (!isCancelled) {
            setProducts(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error('Error al cargar productos:', err);
          if (!isCancelled) setLoading(false);
        });
    }, 180); // Debounce de 180ms para interactividad suave

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [selectedCategory, minPrice, maxPrice, minPieces, piecesPreset, selectedAge, searchQuery]);

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setMinPrice(val);
    if (val > maxPrice) {
      setMaxPrice(Math.min(250000, val + 10000));
    }
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setMaxPrice(val);
    if (val < minPrice) {
      setMinPrice(Math.max(0, val - 10000));
    }
  };

  const handlePiecesSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setMinPieces(val);
    setPiecesPreset('custom');
  };

  const handlePiecePresetClick = (presetId: string) => {
    setPiecesPreset(presetId);
    const p = piecePresets.find(item => item.id === presetId);
    if (p) {
      setMinPieces(p.min);
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setMinPrice(0);
    setMaxPrice(250000);
    setMinPieces(0);
    setPiecesPreset('all');
    setSelectedAge('all');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    minPrice > 0 ||
    maxPrice < 250000 ||
    piecesPreset !== 'all' ||
    minPieces > 0 ||
    selectedAge !== 'all' ||
    searchQuery.trim().length > 0;

  const handleCardClick = (product: Product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else if (onAddToCart) {
      onAddToCart(product);
    }
  };

  const formatCLP = (val: number) => `$${val.toLocaleString('es-CL')}`;

  return (
    <div className="catalog-layout">
      {/* Sidebar Izquierda: Estrictamente alineada a la izquierda y profesional */}
      <div className="catalog-sidebar" aria-label="Filtros del catálogo Lego">
        {/* Encabezado de la barra lateral */}
        <div className="sidebar-header-row">
          <div className="sidebar-header-title">
            <SlidersHorizontal size={15} color="#E52521" />
            <span>Filtros Lego</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="sidebar-reset-btn"
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={11} />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Sección 1: Categorías con Studs / Ladrillos 3D de Lego */}
        <div className="sidebar-section">
          <span className="sidebar-heading">Categorías</span>
          <div className="sidebar-categories-list">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`sidebar-category-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  title={`Filtrar por ${cat.label}`}
                >
                  {/* Auténtico bloque / stud de Lego 1x1 con botón cilíndrico en 3D */}
                  <div
                    className="lego-brick-stud-icon"
                    style={{ '--brick-color': cat.color } as React.CSSProperties}
                    aria-hidden="true"
                  >
                    <div className="lego-brick-stud-pin" />
                  </div>
                  <span className="category-pill-label">{cat.label}</span>
                  {isActive && <div className="category-active-pip" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sección 2: Slider de Precio Min y Max Tematizado Lego */}
        <div className="sidebar-filter-box">
          <div className="filter-box-header">
            <Coins size={14} color="#FFD500" />
            <span className="filter-box-title">Rango de Precio</span>
          </div>

          <div className="price-display-pill">
            <span className="price-range-text">
              {formatCLP(minPrice)} – {formatCLP(maxPrice)}
            </span>
          </div>

          {/* Slider Min */}
          <div className="lego-slider-wrapper">
            <div className="slider-label-row">
              <span className="slider-sublabel">Mínimo</span>
              <span className="slider-value-badge">{formatCLP(minPrice)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={150000}
              step={5000}
              value={minPrice}
              onChange={handleMinPriceChange}
              className="lego-range-slider lego-slider-yellow"
              aria-label="Precio mínimo"
            />
          </div>

          {/* Slider Max */}
          <div className="lego-slider-wrapper">
            <div className="slider-label-row">
              <span className="slider-sublabel">Máximo</span>
              <span className="slider-value-badge">{formatCLP(maxPrice)}</span>
            </div>
            <input
              type="range"
              min={30000}
              max={250000}
              step={5000}
              value={maxPrice}
              onChange={handleMaxPriceChange}
              className="lego-range-slider lego-slider-red"
              aria-label="Precio máximo"
            />
          </div>
        </div>

        {/* Sección 3: Cantidad de Piezas (Presets y Slider Lego) */}
        <div className="sidebar-filter-box">
          <div className="filter-box-header">
            <Layers size={14} color="#38BDF8" />
            <span className="filter-box-title">Piezas de Construcción</span>
          </div>

          {/* Presets rápidos */}
          <div className="pieces-presets-grid">
            {piecePresets.map((preset) => {
              const isSelected = piecesPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`pieces-preset-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => handlePiecePresetClick(preset.id)}
                >
                  <span className="chip-stud" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Slider de Piezas Mínimas */}
          <div className="lego-slider-wrapper" style={{ marginTop: '8px' }}>
            <div className="slider-label-row">
              <span className="slider-sublabel">Mínimo de piezas</span>
              <span className="slider-value-badge">
                {minPieces === 0 ? 'Cualquiera' : `${minPieces} pcs+`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1500}
              step={50}
              value={minPieces}
              onChange={handlePiecesSliderChange}
              className="lego-range-slider lego-slider-blue"
              aria-label="Mínimo de piezas"
            />
          </div>
        </div>

        {/* Sección 4: Filtro por Edad Recomendada */}
        <div className="sidebar-filter-box">
          <div className="filter-box-header">
            <Baby size={14} color="#4ADE80" />
            <span className="filter-box-title">Edad Recomendada</span>
          </div>

          <div className="age-options-list">
            {ageOptions.map((opt) => {
              const isSelected = selectedAge === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`age-option-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedAge(opt.id)}
                >
                  <div className="age-pill-left">
                    <span className="age-lego-stud" />
                    <span className="age-pill-text">{opt.label}</span>
                  </div>
                  <span className="age-badge-tag">{opt.badge}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Área Central: Buscador, Badges de Filtros Activos y Grilla de Productos */}
      <main className="catalog-main">
        {/* Barra de Búsqueda Minimalista y Limpia */}
        <div className="search-bar-wrapper">
          <div className="search-bar">
            <Search className="search-bar-icon" size={19} />
            <input
              type="text"
              className="search-bar-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar sets, personajes o franquicias (ej: Batman, Star Wars, City...)"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Barra de Estado y Etiquetas de Filtros Activos */}
        <div className="catalog-status-bar">
          <div className="catalog-count-label">
            Mostrando <strong>{products.length}</strong> {products.length === 1 ? 'set Lego disponible' : 'sets Lego disponibles'}
          </div>

          {/* Badges interactivos para remover filtros rápidamente */}
          {hasActiveFilters && (
            <div className="active-filter-chips-row">
              {selectedCategory !== 'all' && (
                <span className="active-filter-chip">
                  <span>Tema: {selectedCategory}</span>
                  <button type="button" onClick={() => setSelectedCategory('all')}>×</button>
                </span>
              )}
              {(minPrice > 0 || maxPrice < 250000) && (
                <span className="active-filter-chip">
                  <span>Precio: {formatCLP(minPrice)} - {formatCLP(maxPrice)}</span>
                  <button type="button" onClick={() => { setMinPrice(0); setMaxPrice(250000); }}>×</button>
                </span>
              )}
              {(piecesPreset !== 'all' || minPieces > 0) && (
                <span className="active-filter-chip">
                  <span>Piezas: {piecesPreset !== 'custom' ? piecesPreset : `${minPieces}+`}</span>
                  <button type="button" onClick={() => { setMinPieces(0); setPiecesPreset('all'); }}>×</button>
                </span>
              )}
              {selectedAge !== 'all' && (
                <span className="active-filter-chip">
                  <span>Edad: {selectedAge}</span>
                  <button type="button" onClick={() => setSelectedAge('all')}>×</button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Grilla de Productos */}
        {loading ? (
          <div className="catalog-empty-state">
            <div style={{ fontSize: '32px', marginBottom: '10px', animation: 'spin 1.5s infinite linear' }}>🧱</div>
            <p style={{ fontWeight: 700, fontSize: '16px', color: '#1E293B' }}>Filtrando catálogo en tiempo real...</p>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Buscando las mejores piezas de construcción</p>
          </div>
        ) : products.length === 0 ? (
          <div className="catalog-empty-state">
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🧩</div>
            <p style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B' }}>No se encontraron sets con los filtros seleccionados</p>
            <p style={{ fontSize: '14px', marginTop: '6px', color: '#64748B' }}>Prueba ajustando el rango de precio, piezas o edades.</p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="empty-state-reset-btn"
            >
              <RotateCcw size={14} />
              <span>Restablecer Filtros</span>
            </button>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <div
                key={product.id}
                className="product-card"
                onClick={() => handleCardClick(product)}
              >
                {/* Contenedor Blanco de Imagen con Chips */}
                <div className="product-card-image-box">
                  <span className="product-tag-chip">{product.theme}</span>
                  <span className="product-pieces-chip">{product.pieces} pcs</span>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="product-card-img"
                    loading="lazy"
                  />
                </div>

                {/* Píldora Inferior: Estilo Moderno y Funcional */}
                <div className="product-card-pill">
                  <span className="product-pill-title" title={product.name}>
                    {product.name}
                  </span>

                  <div className="product-pill-price-box">
                    <span className="product-pill-price">
                      {product.formattedPrice}
                    </span>
                    <button
                      type="button"
                      className="product-quick-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart?.(product);
                      }}
                      title="Añadir al carrito"
                    >
                      <Plus size={15} strokeWidth={2.8} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

