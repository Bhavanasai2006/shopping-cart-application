import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import API_URL from "../api";
import { useAuth } from "./AuthContext";
import {
  loadScopedWishlist,
  saveScopedWishlist,
  GUEST_CART_KEY
} from "../utils/customerStorage";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user, isAuthenticated, authFetch, loading: authLoading } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  // -------------------------------------------------------------
  // Cart & Wishlist State (Scoped & Isolated)
  // -------------------------------------------------------------
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(GUEST_CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState(() => {
    return loadScopedWishlist(null);
  });

  const [authoritativeNotice, setAuthoritativeNotice] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const prevAuthRef = useRef(isAuthenticated);
  const prevUserRef = useRef(user);
  const isSyncingRef = useRef(false);
  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // -------------------------------------------------------------
  // Account Identity Switching & Scoped Data Hydration
  // -------------------------------------------------------------
  useEffect(() => {
    const prev = prevUserRef.current;
    const currentUid = user?.userId || user?._id || user?.emailId;
    const prevUid = prev?.userId || prev?._id || prev?.emailId;
    const roleChanged = user?.role !== prev?.role;

    if (currentUid !== prevUid || roleChanged) {
      if (user?.role === "admin") {
        // Administrators must NEVER inherit or hold customer wishlist or cart
        setCart([]);
        setWishlist([]);
      } else if (user && user.role !== "admin") {
        // Authenticated customer: hydrate their identity-scoped wishlist
        setWishlist(loadScopedWishlist(user));
      } else {
        // Guest / unauthenticated: restore guest-scoped wishlist
        setWishlist(loadScopedWishlist(null));
      }
    }

    prevUserRef.current = user;
  }, [user]);

  // -------------------------------------------------------------
  // Persist guest cart to localStorage when unauthenticated
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated && !isAdmin) {
      try {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
      } catch {
        // Fallback for storage quota
      }
    }
  }, [cart, isAuthenticated, isAdmin]);

  // Persist Wishlist to identity-scoped storage
  useEffect(() => {
    if (!isAdmin) {
      saveScopedWishlist(user, wishlist);
    }
  }, [wishlist, user, isAdmin]);

  // -------------------------------------------------------------
  // Cloud Cart Syncing (Authenticated Customers ONLY)
  // -------------------------------------------------------------
  const syncCloudCart = useCallback(async () => {
    if (!isAuthenticated || isAdmin || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      // Check if guest cart has items to merge on login
      let guestItems = [];
      try {
        const saved = localStorage.getItem(GUEST_CART_KEY);
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
          localStorage.removeItem(GUEST_CART_KEY);
          return;
        } else {
          // If merge failed, clear local guest items to prevent persistent retry failure
          localStorage.removeItem(GUEST_CART_KEY);
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
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isAuthenticated, isAdmin, authFetch]);

  // Sync on authentication change & listen to global logout events
  useEffect(() => {
    function handleLogout() {
      setCart([]);
      setWishlist([]);
      try {
        localStorage.removeItem(GUEST_CART_KEY);
      } catch {
        // Safe fallback
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("sole:logout", handleLogout);
    }

    if (authLoading) return;

    if (isAuthenticated && !isAdmin) {
      syncCloudCart();
    } else if (prevAuthRef.current && !isAuthenticated) {
      // User logged out: restore clean guest cart state
      setCart([]);
      setWishlist([]);
    }

    prevAuthRef.current = isAuthenticated;

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("sole:logout", handleLogout);
      }
    };
  }, [isAuthenticated, isAdmin, authLoading, syncCloudCart]);

  // -------------------------------------------------------------
  // Authoritative Price & Stock Verification (Public fallback)
  // -------------------------------------------------------------
  const verifyAuthoritativeData = useCallback(async () => {
    if (isAdmin) return;

    if (isAuthenticated) {
      await syncCloudCart();
      return;
    }

    const currentCart = cartRef.current;
    if (!currentCart || currentCart.length === 0) return;

    try {
      const res = await fetch(`${API_URL}/products`);
      if (!res.ok) return;

      const data = await res.json();
      const liveProducts = Array.isArray(data) ? data : data.products || [];
      if (liveProducts.length === 0) return;

      const liveMap = new Map(liveProducts.map((p) => [String(p._id), p]));
      let adjusted = false;

      const verifiedCart = currentCart.map((item) => {
        const live = liveMap.get(String(item._id || item.productId));
        if (!live) {
          if (item.isActive !== false) {
            adjusted = true;
          }
          return {
            ...item,
            isActive: false,
            quantity: 0
          };
        }

        const maxStock = live.quantity != null ? live.quantity : item.quantity;
        const validPrice =
          live.productPrice != null ? live.productPrice : item.productPrice;

        let validQty = item.cartQty;
        if (validQty > maxStock) {
          validQty = Math.max(1, maxStock);
          adjusted = true;
        }

        if (
          validPrice !== item.productPrice ||
          maxStock !== item.quantity ||
          validQty !== item.cartQty ||
          item.isActive === false
        ) {
          adjusted = true;
          return {
            ...item,
            isActive: true,
            productPrice: validPrice,
            originalPrice: live.originalPrice || item.originalPrice,
            quantity: maxStock,
            productName: live.productName || item.productName,
            image: live.image || item.image,
            cartQty: validQty
          };
        }

        return item;
      });

      if (adjusted) {
        setAuthoritativeNotice(
          "Some items in your cart were updated or are currently unavailable."
        );
        setCart(verifiedCart);
      }
    } catch {
      // Offline fallback
    }
  }, [isAuthenticated, isAdmin, syncCloudCart]);

  // -------------------------------------------------------------
  // Cart Actions (Cloud synchronized or Local guest)
  // -------------------------------------------------------------
  async function addToCart(product, qty = 1) {
    if (isAdmin) return;
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
    if (isAdmin) return;
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
    if (isAdmin) return;

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
    if (isAdmin) return;

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
      localStorage.removeItem(GUEST_CART_KEY);
    } catch {
      // Storage fallback
    }
  }

  // -------------------------------------------------------------
  // Wishlist Actions
  // -------------------------------------------------------------
  function toggleWishlist(product) {
    if (isAdmin) return;

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
    if (isAdmin) return false;
    return wishlist.some(
      (item) => (item._id || item.productId) === productId
    );
  }

  function removeFromWishlist(productId) {
    if (isAdmin) return;
    setWishlist((prev) =>
      prev.filter((item) => (item._id || item.productId) !== productId)
    );
  }

  function moveToCart(product) {
    if (isAdmin) return;
    addToCart(product, 1);
    removeFromWishlist(product._id || product.productId);
  }

  // -------------------------------------------------------------
  // Authoritative Totals Calculation
  // -------------------------------------------------------------
  const itemsSubtotal = isAdmin
    ? 0
    : cart.reduce(
        (sum, item) => sum + (item.productPrice || 0) * (item.cartQty || 1),
        0
      );
  const delivery = isAdmin || cart.length === 0 ? 0 : itemsSubtotal >= 100 ? 0.0 : 10.0;
  const discount = isAdmin || cart.length === 0 ? 0 : 3.0;
  const grandTotal = Math.max(0, itemsSubtotal + delivery - discount);
  const totalItemCount = isAdmin
    ? 0
    : cart.reduce((sum, item) => sum + (item.cartQty || 1), 0);
  const wishlistCount = isAdmin ? 0 : wishlist.length;

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
    wishlistCount,
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
