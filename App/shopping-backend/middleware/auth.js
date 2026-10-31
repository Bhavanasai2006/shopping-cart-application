const jwt = require("jsonwebtoken");
const config = require("../config/env");
const { User } = require("../schema");

// Middleware to verify JWT access token
async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2. Fall back to httpOnly cookie if present
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        message: "Authentication required: Missing access token"
      });
    }

    // Verify token signature and expiration
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET);

    // Attach verified user payload
    req.user = {
      _id: payload.id,
      id: payload.id,
      username: payload.username,
      emailId: payload.emailId,
      role: payload.role || "customer"
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Access token expired",
        code: "TOKEN_EXPIRED"
      });
    }

    return res.status(401).json({
      message: "Invalid or malformed access token"
    });
  }
}

// Optional auth: attaches req.user if a valid token is present, continues otherwise
function optionalAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET);
    req.user = {
      _id: payload.id,
      id: payload.id,
      username: payload.username,
      emailId: payload.emailId,
      role: payload.role || "customer"
    };
  } catch (err) {
    // In optional auth, ignore invalid/expired tokens and proceed as unauthenticated
  }
  next();
}

// Role-based authorization middleware
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access forbidden: insufficient permissions"
      });
    }

    next();
  };
}

// Shortcut helpers
const requireCustomer = requireRole("customer", "admin");
const requireAdmin = requireRole("admin");

// Reusable Object Ownership verifier
function checkOwnership(getOwnerIdFromResource) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Admins bypass ownership checks
    if (req.user.role === "admin") {
      return next();
    }

    const ownerId = getOwnerIdFromResource(req);
    if (!ownerId) {
      return res.status(404).json({ message: "Resource not found" });
    }

    if (ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Access forbidden: you do not own this resource"
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireCustomer,
  requireAdmin,
  checkOwnership
};
