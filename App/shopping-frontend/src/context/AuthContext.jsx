import { createContext, useContext, useState, useEffect } from "react";
import API_URL from "../api";
import { sanitizeErrorMessage } from "../utils/security";

// -----------------------------------------------------------------
// In-Memory Token & Concurrency-Safe Refresh Mutex
// Access tokens are NEVER stored in localStorage or sessionStorage!
// -----------------------------------------------------------------
let inMemoryAccessToken = null;
let refreshPromise = null;

export const getAccessToken = () => inMemoryAccessToken;
export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
};

// Set of listeners notified when a session becomes unauthorized/expired
const unauthorizedListeners = new Set();
export function onSessionExpired(callback) {
  unauthorizedListeners.add(callback);
  return () => unauthorizedListeners.delete(callback);
}

function notifySessionExpired() {
  inMemoryAccessToken = null;
  unauthorizedListeners.forEach((callback) => {
    try {
      callback();
    } catch {
      // Safe fallback
    }
  });
}

// Safe singleton refresh mechanism to prevent concurrent race conditions
export async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });

      if (!res.ok) {
        notifySessionExpired();
        throw new Error("Session expired or revoked. Please log in again.");
      }

      const data = await res.json();
      inMemoryAccessToken = data.accessToken;
      return {
        accessToken: data.accessToken,
        user: data.user
      };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Authenticated fetch wrapper with automatic token injection and safe 401/403 handling
export async function authFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (inMemoryAccessToken) {
    headers["Authorization"] = `Bearer ${inMemoryAccessToken}`;
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: "include"
  };

  let res = await fetch(url, fetchOptions);

  // If token expired (401), perform a single synchronized silent refresh and retry
  if (res.status === 401) {
    try {
      const refreshResult = await refreshAccessToken();
      if (refreshResult?.accessToken) {
        headers["Authorization"] = `Bearer ${refreshResult.accessToken}`;
        res = await fetch(url, { ...options, headers, credentials: "include" });
      }
    } catch {
      // Token refresh failed -> session has ended
      notifySessionExpired();
    }

    if (res.status === 401) {
      notifySessionExpired();
    }
  }

  return res;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen for unauthorized session expiration events across the app
  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      setUser(null);
      try {
        sessionStorage.clear();
      } catch {
        // Fallback
      }
    });
    return unsubscribe;
  }, []);

  // -----------------------------------------------------------------
  // Session Restoration on Page Load / Refresh
  // -----------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const refreshResult = await refreshAccessToken();
        if (isMounted && refreshResult) {
          inMemoryAccessToken = refreshResult.accessToken;

          // Fetch full profile info
          const profileRes = await authFetch(`${API_URL}/users/me`);
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (isMounted) {
              setUser(profileData);
            }
          } else if (refreshResult.user) {
            if (isMounted) {
              setUser(refreshResult.user);
            }
          }
        }
      } catch {
        // No active or valid cookie session
        if (isMounted) {
          inMemoryAccessToken = null;
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // -----------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------
  async function login(emailId, password) {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ emailId, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Invalid email or password");
    }

    // Keep token in memory ONLY
    inMemoryAccessToken = data.accessToken;

    // Fetch full profile details
    let fullUser = {
      userId: data.userId,
      username: data.username,
      role: data.role || "customer"
    };

    try {
      const profileRes = await authFetch(`${API_URL}/users/me`);
      if (profileRes.ok) {
        fullUser = await profileRes.json();
      }
    } catch {
      // Non-fatal if profile fetch fails
    }

    setUser(fullUser);
    return fullUser;
  }

  // -----------------------------------------------------------------
  // Register
  // -----------------------------------------------------------------
  async function register(formData) {
    const res = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        age: Number(formData.age)
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        throw new Error(data.errors.map((e) => e.message).join(", "));
      }
      throw new Error(data.message || "Registration failed");
    }

    return data;
  }

  // -----------------------------------------------------------------
  // Logout (Strict State & Storage Purge)
  // -----------------------------------------------------------------
  async function logout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch {
      // Safe fallback on network failure
    } finally {
      // Purge in-memory token
      inMemoryAccessToken = null;
      // Reset user state
      setUser(null);

      // Clear any session storage and cached cart data
      try {
        localStorage.removeItem("sole_cart_v2");
        sessionStorage.clear();
      } catch {
        // Fallback
      }

      // Broadcast logout event so other contexts (e.g. CartContext) immediately flush state
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("sole:logout"));
      }
    }
  }

  // -----------------------------------------------------------------
  // Update Profile
  // -----------------------------------------------------------------
  async function updateProfile({ username, age }) {
    const res = await authFetch(`${API_URL}/users/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, age })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("Access forbidden: you do not have permission to modify this account.");
      }
      throw new Error(data.message || "Failed to update profile");
    }

    if (data.user) {
      setUser(data.user);
    }

    return data;
  }

  // -----------------------------------------------------------------
  // Change Password
  // -----------------------------------------------------------------
  async function changePassword({ currentPassword, newPassword }) {
    const res = await authFetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("Access forbidden: you do not have permission to change this password.");
      }
      throw new Error(data.message || "Failed to change password");
    }

    return data;
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    authFetch,
    getAccessToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
