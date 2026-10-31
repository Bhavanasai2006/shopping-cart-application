import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import API_URL from "../api";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

const CART_STORAGE_KEY = "sole_cart_v2";
const WISHLIST_STORAGE_KEY = "sole_wishlist_v1";

export function CartProvider({ children }) {
  const { isAuthenticated, authFetch, loading: authLoading } = useAuth();

  // -------------------------------------------------------------
  // Cart & Wishlist State
  // -------------------------------------------------------------
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [authoritativeNotice, setAuthoritativeNotice] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const prevAuthRef = useRef(isAuthenticated);

  // -------------------------------------------------------------
  // Persist guest cart to localStorage when unauthenticated
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch {
        // Fallback for storage quota
      }
    }
  }, [cart, isAuthenticated]);

  // Persist Wishlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // Fallback
    }
  }, [wishlist]);

  // -------------------------------------------------------------
  // Cloud Cart Syncing (Authenticated)
  // -------------------------------------------------------------
  const syncCloudCart = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsSyncing(true);
    try {
      // Check if guest cart has items to merge on login
      let guestItems = [];
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        guestItems = saved ? JSON.parse(saved) : [];
      } catch {
        guestItems = [];
      }

      if (guestItems.length > 0) {
        // Merge guest items into cloud cart
        const payload = {
          items: guestItems.map((item) => ({
            productId: item._id || item.productId,
            quantity: item.cartQty || item.quantity || 1
          }))
        };

        const mergeRes = await authFetch(`${API_URL}/cart/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (mergeRes.ok) {
          const mergeData = await mergeRes.json();
          setCart(mergeData.items || []);
          // Clear guest items after successful merge
          localStorage.removeItem(CART_STORAGE_KEY);
          return;
        }
      }

      // If no guest items to merge, fetch active cloud cart
      const res = await authFetch(`${API_URL}/cart`);
      if (res.ok) {
        const data = await res.json();
        setCart(data.items || []);
      }
    } catch {
      // Non-fatal sync fallback; prevent sensitive error logging
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, authFetch]);

  // Sync on authentication change & listen to global logout events
  useEffect(() => {
    function handleLogout() {
      setCart([]);
      try {
        localStorage.removeItem(CART_STORAGE_KEY);
      } catch {
        // Safe fallback
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("sole:logout", handleLogout);
    }

    if (authLoading) return;

    if (isAuthenticated) {
      syncCloudCart();
    } else if (prevAuthRef.current && !isAuthenticated) {
      // User logged out: restore clean guest cart state
      setCart([]);
    }

    prevAuthRef.current = isAuthenticated;

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("sole:logout", handleLogout);
      }
    };
  }, [isAuthenticated, authLoading, syncCloudCart]);

  // -------------------------------------------------------------
  // Authoritative Price & Stock Verification (Public fallback)
  // -------------------------------------------------------------
  const verifyAuthoritativeData = useCallback(async () => {
    if (isAuthenticated) {
      await syncCloudCart();
      return;
    }

    if (cart.length === 0) return;

    try {
      const res = await fetch(`${API_URL}/products`);
      if (!res.ok) return;

      const data = await res.json();
      const liveProducts = Array.isArray(data) ? data : data.products || [];
      if (liveProducts.length === 0) return;

      const liveMap = new Map(liveProducts.map((p) => [String(p._id), p]));
      let adjusted = false;

      const verifiedCart = cart.map((item) => {
        const live = liveMap.get(String(item._id || item.productId));
        if (!live) return item;

        const maxStock = live.quantity != null ? live.quantity : item.quantity;
        const validPrice =
          live.productPrice != null ? live.productPrice : item.productPrice;

        let validQty = item.cartQty;
        if (validQty > maxStock) {
          validQty = Math.max(1, maxStock);
          adjusted = true;
        }

        return {
          ...item,
          productPrice: validPrice,
          originalPrice: live.originalPrice || item.originalPrice,
          quantity: maxStock,
          productName: live.productName || item.productName,
          image: live.image || item.image,
          cartQty: validQty
        };
      });

      if (adjusted) {
        setAuthoritativeNotice(
          "Some item quantities were adjusted to match live stock."
        );
      }

      setCart(verifiedCart);
    } catch {
      // Offline fallback
    }
  }, [cart, isAuthenticated, syncCloudCart]);

  // -------------------------------------------------------------
  // Cart Actions (Cloud synchronized or Local guest)
  // -------------------------------------------------------------
  async function addToCart(product, qty = 1) {
    const pId = product._id || product.productId;

    if (isAuthenticated) {
      try {
        const res = await authFetch(`${API_URL}/cart/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: pId,
            quantity: qty
          })
        });

        if (res.ok) {
          const data = await res.json();
          setCart(data.items || []);
          return;
        }
      } catch {
        // Fall back locally on network interruption; avoid logging sensitive payload
      }
    }

    // Guest / fallback local logic
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => (item._id || item.productId) === pId
      );
      const availableStock = product.quantity != null ? product.quantity : 99;

      if (existingIndex > -1) {
        const currentQty = prev[existingIndex].cartQty;
        const newQty = currentQty + qty;

        if (newQty > availableStock) {
          return prev;
        }

        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          cartQty: newQty
        };
        return updated;
      }

      if (qty > availableStock) {
        return prev;
      }

      return [
        ...prev,
        {
          _id: pId,
          productId: pId,
          productName: product.productName,
          subtitle: product.subtitle || "",
          productPrice: product.productPrice,
          originalPrice: product.originalPrice,
          size: product.size || "50 ml",
          category: product.category || "Skincare",
          quantity: availableStock,
          image: product.image,
          cartQty: qty
        }
      ];
    });
  }

  async function updateQty(productId, newQty) {
    if (isAuthenticated) {
      try {
        const res = await authFetch(`${API_URL}/cart/items/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: newQty })
        });

        if (res.ok) {
          const data = await res.json();
          setCart(data.items || []);
          return;
        }
      } catch {
        // Fall back locally
      }
    }

    // Guest / fallback local logic
    setCart((prev) =>
      prev
        .map((item) => {
          if ((item._id || item.productId) !== productId) return item;
          const maxStock = item.quantity != null ? item.quantity : 99;
          const clampedQty = Math.max(1, Math.min(newQty, maxStock));
          return { ...item, cartQty: clampedQty };
        })
        .filter((item) => item.cartQty > 0)
    );
  }

  async function removeFromCart(productId) {
    if (isAuthenticated) {
      try {
        const res = await authFetch(`${API_URL}/cart/items/${productId}`, {
          method: "DELETE"
        });

        if (res.ok) {
          const data = await res.json();
          setCart(data.items || []);
          return;
        }
      } catch {
        // Fall back locally
      }
    }

    // Guest / fallback local logic
    setCart((prev) =>
      prev.filter((item) => (item._id || item.productId) !== productId)
    );
  }

  async function clearCart() {
    if (isAuthenticated) {
      try {
        await authFetch(`${API_URL}/cart`, {
          method: "DELETE"
        });
      } catch {
        // Fall back locally
      }
    }

    setCart([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Storage fallback
    }
  }

  // -------------------------------------------------------------
  // Wishlist Actions
  // -------------------------------------------------------------
  function toggleWishlist(product) {
    const pId = product._id || product.productId;
    setWishlist((prev) => {
      const exists = prev.some((item) => (item._id || item.productId) === pId);
      if (exists) {
        return prev.filter((item) => (item._id || item.productId) !== pId);
      }
      return [
        ...prev,
        {
          _id: pId,
          productId: pId,
          productName: product.productName,
          subtitle: product.subtitle || "",
          productPrice: product.productPrice,
          originalPrice: product.originalPrice,
          size: product.size || "50 ml",
          category: product.category || "Skincare",
          quantity: product.quantity,
          image: product.image
        }
      ];
    });
  }

  function isInWishlist(productId) {
    return wishlist.some(
      (item) => (item._id || item.productId) === productId
    );
  }

  function removeFromWishlist(productId) {
    setWishlist((prev) =>
      prev.filter((item) => (item._id || item.productId) !== productId)
    );
  }

  function moveToCart(product) {
    addToCart(product, 1);
    removeFromWishlist(product._id || product.productId);
  }

  // -------------------------------------------------------------
  // Authoritative Totals Calculation
  // -------------------------------------------------------------
  const itemsSubtotal = cart.reduce(
    (sum, item) => sum + (item.productPrice || 0) * (item.cartQty || 1),
    0
  );
  const delivery = cart.length > 0 ? (itemsSubtotal >= 100 ? 0.0 : 10.0) : 0;
  const discount = cart.length > 0 ? 3.0 : 0;
  const grandTotal = Math.max(0, itemsSubtotal + delivery - discount);
  const totalItemCount = cart.reduce(
    (sum, item) => sum + (item.cartQty || 1),
    0
  );

  const value = {
    cart,
    setCart,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    wishlist,
    toggleWishlist,
    isInWishlist,
    removeFromWishlist,
    moveToCart,
    totalItemCount,
    wishlistCount: wishlist.length,
    totals: {
      itemsSubtotal,
      delivery,
      discount,
      grandTotal
    },
    authoritativeNotice,
    isSyncing,
    verifyAuthoritativeData,
    syncCloudCart
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
