const config = require("../config/env");

// Safe logger that redacts sensitive values
function redactSensitiveData(data) {
  if (!data || typeof data !== "object") return data;
  const sensitiveKeys = [
    "password",
    "newpassword",
    "token",
    "refreshtoken",
    "accesstoken",
    "authorization",
    "cookie",
    "secret"
  ];

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  const redacted = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// 404 Route Not Found Middleware
function notFoundHandler(req, res) {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
}

// Centralized Error Handling Middleware
function errorHandler(err, req, res, _next) {
  // Safe logging (avoid logging in test mode to keep test output clean unless needed)
  if (config.NODE_ENV !== "test") {
    console.error("[ERROR-HANDLER]", {
      method: req.method,
      path: req.originalUrl,
      errorName: err.name,
      message: err.message,
      body: redactSensitiveData(req.body)
    });
  }

  // 1. JSON Parse Error (Malformed payload)
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      message: "Malformed JSON payload"
    });
  }

  // 2. CORS Error
  if (err.message && err.message.startsWith("CORS blocked")) {
    return res.status(403).json({
      message: err.message
    });
  }

  // 3. MongoDB Duplicate Key (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    if (field === "emailId") {
      return res.status(409).json({
        message: "Email already registered"
      });
    }
    return res.status(409).json({
      message: `Duplicate value for ${field}`
    });
  }

  // 4. Mongoose CastError (e.g. malformed ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid format for field: ${err.path}`
    });
  }

  // 5. Mongoose ValidationError
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      message: "Validation failed",
      errors
    });
  }

  // 6. JWT Errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      message: "Invalid token"
    });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      message: "Token expired",
      code: "TOKEN_EXPIRED"
    });
  }

  // 7. Explicit status code on error
  const statusCode = err.statusCode || (err.status >= 400 && err.status < 600 ? err.status : 500);

  if (statusCode === 500) {
    return res.status(500).json({
      message: config.isProduction
        ? "Internal server error"
        : err.message || "Internal server error"
    });
  }

  return res.status(statusCode).json({
    message: err.message || "An error occurred"
  });
}

module.exports = {
  redactSensitiveData,
  notFoundHandler,
  errorHandler
};
