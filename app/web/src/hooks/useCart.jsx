import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency } from '@/api/EcommerceApi';
import { toast } from 'sonner';

const CartContext = createContext();
const CART_STORAGE_KEY = 'e-commerce-cart';

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const storedCart = localStorage.getItem(CART_STORAGE_KEY);
      return storedCart ? JSON.parse(storedCart) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = useCallback((product, variant, quantity, availableQuantity, options = {}) => {
    return new Promise((resolve, reject) => {
      // Handle polymorphic arguments: e.g. addToCart(product, variant, quantity, { silent: true })
      let finalAvailable = availableQuantity;
      let finalOptions = options;
      if (typeof availableQuantity === 'object' && availableQuantity !== null) {
        finalOptions = availableQuantity;
        finalAvailable = undefined;
      }
      
      const silent = !!finalOptions.silent;
      const effectiveAvailable = finalAvailable !== undefined ? finalAvailable : (variant.inventory_quantity ?? 99);

      if (variant.manage_inventory) {
        const existingItem = cartItems.find((item) => item.variant.id === variant.id);
        const currentCartQuantity = existingItem ? existingItem.quantity : 0;
        if (currentCartQuantity + quantity > effectiveAvailable) {
          const errMsg = `Stock insuficiente para "${product.title}". Apenas ${effectiveAvailable} unidade${effectiveAvailable !== 1 ? 's' : ''} disponível${effectiveAvailable !== 1 ? 'eis' : ''}.`;
          if (!silent) {
            toast.error(errMsg);
          }
          reject(new Error(errMsg));
          return;
        }
      }

      setCartItems((prevItems) => {
        const existingItem = prevItems.find((item) => item.variant.id === variant.id);
        if (existingItem) {
          return prevItems.map((item) =>
            item.variant.id === variant.id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        }
        return [...prevItems, { product, variant, quantity }];
      });
      
      if (!silent) {
        toast.success(`"${product.title}" adicionado ao carrinho!`, {
          description: `${quantity}x · ${variant.name || 'Edição Standard'}`,
        });
      }
      resolve();
    });
  }, [cartItems]);

  const removeFromCart = useCallback((variantId) => {
    setCartItems((prevItems) => {
      const item = prevItems.find((i) => i.variant.id === variantId);
      if (item) {
        toast.info(`"${item.product.title}" removido do carrinho.`);
      }
      return prevItems.filter((item) => item.variant.id !== variantId);
    });
  }, []);

  const updateQuantity = useCallback((variantId, quantity) => {
    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.variant.id !== variantId) return item;
        const max = item.variant.manage_inventory ? (item.variant.inventory_quantity ?? 99) : 99;
        const safeQty = Math.max(1, Math.min(quantity, max));
        return { ...item, quantity: safeQty };
      }),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    toast.success('Carrinho limpo com sucesso.');
  }, []);

  const getCartTotalCents = useCallback(() => {
    return cartItems.reduce((total, item) => {
      const price = item.variant.sale_price_in_cents ?? item.variant.price_in_cents;
      return total + price * item.quantity;
    }, 0);
  }, [cartItems]);

  const getCartTotal = useCallback(() => {
    if (cartItems.length === 0) return formatCurrency(0);
    return formatCurrency(getCartTotalCents(), cartItems[0].variant.currency_info);
  }, [cartItems, getCartTotalCents]);

  const getCartCount = useCallback(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  // Pre-calculated values for reactive accessibility
  const cartCount = useMemo(() => getCartCount(), [getCartCount]);
  const cartTotalCents = useMemo(() => getCartTotalCents(), [getCartTotalCents]);
  const cartTotal = useMemo(() => getCartTotal(), [getCartTotal]);
  const cartTotalAmount = useMemo(() => cartTotalCents / 100, [cartTotalCents]);

  const value = useMemo(() => ({
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartTotalCents,
    getCartCount,
    cartCount,
    cartTotalCents,
    cartTotal,
    cartTotalAmount,
  }), [
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartTotalCents,
    getCartCount,
    cartCount,
    cartTotalCents,
    cartTotal,
    cartTotalAmount,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
