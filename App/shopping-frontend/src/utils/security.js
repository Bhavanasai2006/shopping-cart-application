/**
 * Frontend Security Utilities
 * Enforces route safety, input hygiene, and prevents open redirects or malicious URI schemes.
 */

// Safe internal application path regex
const SAFE_PATH_REGEX = /^\/[a-zA-Z0-9_\-\/]*(\?[a-zA-Z0-9_\-=&]*)?$/;

/**
 * Validates and sanitizes a target navigation path.
 * Strictly prevents open redirects (e.g. "//evil.com", "https://evil.com", "javascript:alert(1)").
 *
 * @param {string|object} path - Target path string or location object
 * @param {string} fallback - Safe fallback route (defaults to '/products')
 * @returns {string} Sanitized local route
 */
export function sanitizeAppPath(path, fallback = "/products") {
  if (!path) return fallback;

  const rawPath = typeof path === "object" && path.pathname ? path.pathname : String(path);
  const trimmed = rawPath.trim();

  // Reject empty string or non-relative paths
  if (!trimmed || !trimmed.startsWith("/")) {
    return fallback;
  }

  // Reject protocol-relative URLs (e.g., "//attacker.com" or "/\attacker.com")
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("://")) {
    return fallback;
  }

  // Reject dangerous pseudo-protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return fallback;
  }

  // Validate characters: must match safe relative path
  if (!SAFE_PATH_REGEX.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

/**
 * Validates image URLs before rendering in an <img> tag.
 * Rejects javascript: URLs or malicious inline scripts.
 *
 * @param {string} url - Image URL candidate
 * @returns {string} Sanitized URL or empty string if unsafe
 */
export function sanitizeImageUrl(url) {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();

  // Safe relative paths (e.g. /images/products/cream.jpg)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }

  // Safe HTTP/HTTPS protocols
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return trimmed;
      }
    } catch {
      return "";
    }
  }

  // Safe base64 image data URIs only (reject text/html or scripts)
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  return "";
}

/**
 * Sanitizes API error responses to ensure raw backend stack traces or internal
 * database/server error strings are never leaked directly to the user interface.
 *
 * @param {any} err - Error object or message
 * @param {string} fallback - Friendly fallback message
 * @returns {string} Safe user-facing error string
 */
export function sanitizeErrorMessage(err, fallback = "An unexpected error occurred. Please try again.") {
  if (!err) return fallback;

  const raw = typeof err === "string" ? err : err.message || "";
  const lower = raw.toLowerCase();

  // Mask internal backend stack traces or database keywords
  if (
    lower.includes("mongo") ||
    lower.includes("e11000") ||
    lower.includes("syntaxerror") ||
    lower.includes("cast to objectid") ||
    lower.includes("at line") ||
    lower.includes("call stack")
  ) {
    return "A system error occurred. Please verify your input and try again.";
  }

  return raw.trim() || fallback;
}

