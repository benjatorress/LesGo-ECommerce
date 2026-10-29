import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product, CartItem } from '../data/products';
import { getSession, updateCarritoItemApi } from '../services/api';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => boolean;
  updateQuantity: (productId: string, delta: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  replaceCart: (items: CartItem[]) => void;
  totalItems: number;
  toastMessage: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Cargar el estado inicial desde LocalStorage
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('lesgo_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showStockLimitMessage = (product: Product, currentQuantity: number) => {
    if (product.stock <= 0) {
      showToast('Este producto está agotado.');
      return;
    }

    if (currentQuantity > 0) {
      showToast(
        `Has alcanzado el máximo de unidades disponibles para este producto (${product.stock}). Ya tienes ${currentQuantity} en tu carrito.`
      );
      return;
    }

    showToast(
      `Solo hay ${product.stock} ${product.stock === 1 ? 'unidad disponible' : 'unidades disponibles'} de este producto.`
    );
  };

  // 2. Guardar en LocalStorage cada vez que cartItems cambie
  useEffect(() => {
    localStorage.setItem('lesgo_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // Guarda en la BD la cantidad de un ítem del carrito guardado; si falla, revierte el cambio local
  const persistQuantity = (productId: string, quantity: number, previousQuantity: number) => {
    const token = getSession().token;
    if (!token) return;
    updateCarritoItemApi(token, productId, quantity).catch(error => {
      console.warn('No se pudo guardar la cantidad del carrito:', error);
      setCartItems(prev => prev.map(item =>
        item.product.id === productId ? { ...item, quantity: previousQuantity } : item
      ));
      const reason = error instanceof Error ? error.message : 'sin conexión con el servidor';
      showToast(`No se pudo guardar el cambio en tu carrito: ${reason}`);
    });
  };

  const addToCart = (product: Product, quantity = 1) => {
    const current = cartItems.find(item => item.product.id === product.id);
    if (!Number.isInteger(quantity) || quantity < 1) {
      showToast('La cantidad debe ser de al menos 1 unidad.');
      return false;
    }

    const newQuantity = (current?.quantity ?? 0) + quantity;
    if (product.stock <= 0 || newQuantity > product.stock) {
      showStockLimitMessage(product, current?.quantity ?? 0);
      return false;
    }

    if (current?.saved) {
      persistQuantity(product.id, newQuantity, current.quantity);
    }

    setCartItems(prev => current
      ? prev.map(item =>
        item.product.id === product.id ? { ...item, quantity: newQuantity } : item
      )
      : [...prev, { product, quantity }]
    );
    return true;
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cartItems.find(i => i.product.id === productId);
    if (!item) return;

    const newQuantity = item.quantity + delta;
    if (delta > 0 && newQuantity > item.product.stock) {
      showStockLimitMessage(item.product, item.quantity);
      return;
    }

    // Evitar que la cantidad sea menor a 1
    const quantity = Math.max(1, newQuantity);
    if (quantity === item.quantity) return;

    setCartItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity } : i));
    if (item.saved) {
      persistQuantity(productId, quantity, item.quantity);
    }
  };

  const removeItem = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => setCartItems([]);

  const replaceCart = (items: CartItem[]) => setCartItems(items);

  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    // Se añade toastMessage al Provider
    <CartContext.Provider value={{ cartItems, addToCart, updateQuantity, removeItem, clearCart, replaceCart, totalItems, toastMessage }}>
      {children}
      
      {/* UI DEL TOAST: Se renderiza por encima de la app si hay un mensaje */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          backgroundColor: '#ef4444', color: 'white', 
          padding: '12px 24px', borderRadius: '8px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '8px'
        }} role="alert" aria-live="assertive">
          <span aria-hidden="true">⚠️</span> {toastMessage}
        </div>
      )}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de un CartProvider');
  return context;
};