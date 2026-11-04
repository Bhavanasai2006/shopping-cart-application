const config = require("../config/env");

// Strict CORS Configuration
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

module.exports = {
  corsOptions
};
