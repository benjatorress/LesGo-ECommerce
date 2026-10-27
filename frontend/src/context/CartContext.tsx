import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product, CartItem } from '../data/products';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
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

  // 2. Guardar en LocalStorage cada vez que cartItems cambie
  useEffect(() => {
    localStorage.setItem('lesgo_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product: Product, quantity = 1) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {

        // Verificar si la nueva cantidad excede el stock
        const newQuantity = existing.quantity + quantity;
        if (newQuantity > product.stock) {
          showToast('Stock máximo alcanzado');
          return prev; // Retorna el estado sin cambios
        }

        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      // Verificar si la cantidad inicial excede el stock
      if (quantity > product.stock) {
        showToast('Stock máximo alcanzado');
        return prev;
      }

      return [...prev, { product, quantity }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;

        // Evitar que la cantidad sea menor a 1
        if (delta > 0 && newQuantity > item.product.stock) {
          showToast('Stock máximo alcanzado');
          return item; // Retorna sin sumar
        }

        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => setCartItems([]);

  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    // Se añade toastMessage al Provider
    <CartContext.Provider value={{ cartItems, addToCart, updateQuantity, removeItem, clearCart, totalItems, toastMessage }}>
      {children}
      
      {/* UI DEL TOAST: Se renderiza por encima de la app si hay un mensaje */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          backgroundColor: '#ef4444', color: 'white', 
          padding: '12px 24px', borderRadius: '8px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          ⚠️ {toastMessage}
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