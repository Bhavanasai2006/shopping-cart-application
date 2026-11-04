const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const config = require("../config/env");

// 1. Helmet Security Headers
const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: config.isProduction ? undefined : false
});

// 2. Strict CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, Postman, server-to-server) without origin header
    if (!origin) return callback(null, true);

    if (config.CORS_ORIGINS.includes(origin) || config.CORS_ORIGINS.includes("*")) {
      return callback(null, true);
    }

    // In development, gracefully allow any localhost port
    if (!config.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Idempotency-Key",
    "idempotency-key",
    "x-idempotency-key",
    "IDEMPOTENCY-KEY"
  ],
  maxAge: 86400 // Cache preflight for 24 hours
};

const isLocalhostIp = (ip) => {
  if (!ip) return true;
  const cleanIp = ip.replace(/^::ffff:/, '');
  return (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('172.') ||
    cleanIp.startsWith('fe80:')
  );
};

// 3. Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isTest ? 1000 : config.isProduction ? 500 : 100000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => {
    // In development or test, never lock out developers
    if (!config.isProduction && !req.headers['x-test-rate-limit']) {
      return true;
    }
    return false;
  },
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Stricter rate limit for authentication endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isTest ? 5 : config.isProduction ? 30 : 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => {
    // In test environment, only enforce rate limiting when explicitly testing it
    if (config.isTest) {
      return !req.headers['x-test-rate-limit'];
    }
    // In development, never lock out developer testing
    if (!config.isProduction && !req.headers['x-test-rate-limit']) {
      return true;
    }
    return false;
  },
  message: {
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// 4. NoSQL Injection Prevention Sanitizer
// Recursively strips any keys starting with "$" or containing "."
function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Strip keys with "$" or "."
    if (key.startsWith("$") || key.includes(".")) {
      continue;
    }
    clean[key] = sanitizeObject(value);
  }
  return clean;
}

function sanitizeNoSql(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }
  next();
}

module.exports = {
  securityHeaders,
  corsOptions,
  globalLimiter,
  authLimiter,
  sanitizeNoSql
};
