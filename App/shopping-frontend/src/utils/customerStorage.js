/**
 * Customer Storage Scoping & State Isolation Utilities
 *
 * Ensures customer data (such as wishlists and guest carts) is strictly
 * isolated by authenticated customer identity and NEVER leaked to administrators
 * or cross-contaminated between accounts.
 */

export const LEGACY_WISHLIST_KEY = "sole_wishlist_v1";
export const GUEST_WISHLIST_KEY = "sole_wishlist_guest";
export const GUEST_CART_KEY = "sole_cart_v2";

/**
 * Returns a user-scoped storage key for wishlists.
 * Returns null for administrators (admins do not have customer wishlists).
 *
 * @param {Object|null} user - The authenticated user or null for guest
 * @returns {string|null} - Scoped localStorage key or null if admin
 */
export function getWishlistStorageKey(user) {
  if (!user) return GUEST_WISHLIST_KEY;
  if (user.role === "admin") return null;

  const uid = user.userId || user._id || user.emailId;
  return uid ? `sole_wishlist_${uid}` : GUEST_WISHLIST_KEY;
}

/**
 * Safely loads the scoped wishlist for a given user.
 * Preserves legacy data by migrating existing wishlist into the customer's
 * scoped key upon first authenticated load.
 *
 * @param {Object|null} user - Current user object
 * @returns {Array} - Array of wishlist items
 */
export function loadScopedWishlist(user) {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  // Admins must NEVER inherit or access any customer wishlist
  if (user?.role === "admin") {
    return [];
  }

  const key = getWishlistStorageKey(user);
  if (!key) return [];

  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }

    // Migration fallback: If this customer has no scoped key yet, check legacy storage
    if (user && user.role !== "admin") {
      const legacy = localStorage.getItem(LEGACY_WISHLIST_KEY);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          localStorage.setItem(key, JSON.stringify(parsedLegacy));
          localStorage.removeItem(LEGACY_WISHLIST_KEY);
          return parsedLegacy;
        }
      }
    }
  } catch {
    // Non-fatal parse fallback
  }

  return [];
}

/**
 * Persists a customer's wishlist to their scoped storage key.
 * No-op for administrators.
 *
 * @param {Object|null} user - Current user object
 * @param {Array} wishlist - Wishlist items array
 */
export function saveScopedWishlist(user, wishlist) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  if (user?.role === "admin") {
    return;
  }

  const key = getWishlistStorageKey(user);
  if (!key) return;

  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(wishlist) ? wishlist : []));
  } catch {
    // Non-fatal storage quota fallback
  }
}
