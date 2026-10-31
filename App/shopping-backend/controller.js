// Gracefully configure DNS for environments with restrictive local DNS
if (process.env.CUSTOM_DNS !== "false") {
  try {
    const dns = require("node:dns");
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (err) {
    // Non-fatal if system restricts DNS overrides
  }
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const config = require("./config/env");
const { User, Product, Order } = require("./schema");
const {
  hashPassword,
  comparePassword,
  createEmailVerificationToken,
  createPasswordResetToken,
  sendMockEmail
} = require("./services/authService");
const {
  generateAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens
} = require("./services/tokenService");

const {
  securityHeaders,
  corsOptions,
  globalLimiter,
  authLimiter,
  sanitizeNoSql
} = require("./middleware/security");

const {
  authenticate,
  requireAdmin,
  requireCustomer
} = require("./middleware/auth");

const {
  validate,
  registerValidation,
  loginValidation,
  orderValidation,
  refreshTokenValidation,
  requestPasswordResetValidation,
  resetPasswordValidation,
  verifyEmailValidation,
  objectIdParamValidation
} = require("./middleware/validation");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Security & Parsing Middlewares
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: config.BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT }));
app.use(sanitizeNoSql);

// Global Rate Limiting
if (!config.isTest) {
  app.use(globalLimiter);
}

// -------------------------------------------------------------
// AUTHENTICATION & IDENTITY ENDPOINTS
// -------------------------------------------------------------

// 1. REGISTER USER
app.post(
  "/api/users",
  authLimiter,
  validate(registerValidation),
  async (req, res, next) => {
    try {
      const { username, emailId, age, password } = req.body;

      const existingUser = await User.findOne({ emailId: emailId.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({
          message: "Email already registered"
        });
      }

      const hashedPassword = await hashPassword(password);
      const verification = createEmailVerificationToken();

      // Enforce customer role - cannot be escalated at registration
      const user = await User.create({
        username,
        emailId: emailId.toLowerCase(),
        age,
        password: hashedPassword,
        role: "customer",
        verificationToken: verification.token,
        verificationTokenExpires: verification.expires
      });

      await sendMockEmail(
        user.emailId,
        "Verify your account",
        `Verification token: ${verification.token}`
      );

      return res.status(201).json({
        message: "Registration successful",
        userId: user._id,
        username: user.username
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2. LOGIN USER
app.post(
  "/api/login",
  authLimiter,
  validate(loginValidation),
  async (req, res, next) => {
    try {
      const { emailId, password } = req.body;

      const user = await User.findOne({ emailId: emailId.toLowerCase() });

      // Timing attack mitigation: compare with dummy hash if user not found
      if (!user) {
        await comparePassword(
          password,
          "$2a$12$e80yq9gW7FkF27e1yX1oDuM.4xHQX3k2M9s.1o8rVzL5KkU5Fw2ey"
        );
        return res.status(401).json({
          message: "Invalid email or password"
        });
      }

      if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
        return res.status(403).json({
          message: "Account is temporarily locked. Please try again later or reset password."
        });
      }

      const isMatch = await comparePassword(password, user.password);

      if (!isMatch) {
        // Increment failed attempts
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.isLocked = true;
          user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
        }
        await user.save();

        return res.status(401).json({
          message: "Invalid email or password"
        });
      }

      // Reset failed attempts on success
      if (user.failedLoginAttempts > 0 || user.isLocked) {
        user.failedLoginAttempts = 0;
        user.isLocked = false;
        user.lockUntil = null;
        await user.save();
      }

      // Issue short-lived access token + rotated refresh token
      const accessToken = generateAccessToken(user);
      const refreshToken = await createRefreshToken(user);

      // Set secure HTTP-only cookies
      const isSecure = config.isProduction;
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 15 * 60 * 1000
      });

      res.cookie("refreshToken", refreshToken.rawToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: config.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        path: "/api/auth"
      });

      // Maintain backwards compatibility with frontend while providing tokens
      return res.json({
        message: "Login successful",
        userId: user._id,
        username: user.username,
        role: user.role,
        accessToken,
        refreshToken: refreshToken.rawToken
      });
    } catch (err) {
      next(err);
    }
  }
);

// 3. REFRESH TOKEN (Rotation & Reuse Detection)
app.post(
  "/api/auth/refresh",
  validate(refreshTokenValidation),
  async (req, res, next) => {
    try {
      const rawToken = req.body?.refreshToken || req.cookies?.refreshToken;
      if (!rawToken) {
        return res.status(401).json({
          message: "Missing refresh token"
        });
      }

      const result = await rotateRefreshToken(rawToken);

      // Set updated cookies
      const isSecure = config.isProduction;
      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 15 * 60 * 1000
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: config.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        path: "/api/auth"
      });

      return res.json({
        message: "Tokens refreshed successfully",
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user
      });
    } catch (err) {
      next(err);
    }
  }
);

// 4. LOGOUT (Revocation)
app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const rawToken = req.body?.refreshToken || req.cookies?.refreshToken;
    if (rawToken) {
      await revokeRefreshToken(rawToken);
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken", { path: "/api/auth" });

    return res.json({
      message: "Logged out successfully"
    });
  } catch (err) {
    next(err);
  }
});

// 5. CURRENT USER IDENTITY (GET /api/users/me and GET /api/auth/me)
async function getMeHandler(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      userId: user._id,
      username: user.username,
      emailId: user.emailId,
      age: user.age,
      role: user.role,
      emailVerified: user.emailVerified
    });
  } catch (err) {
    next(err);
  }
}

app.get("/api/users/me", authenticate, getMeHandler);
app.get("/api/auth/me", authenticate, getMeHandler);

// 6. REQUEST PASSWORD RESET
app.post(
  "/api/auth/request-password-reset",
  authLimiter,
  validate(requestPasswordResetValidation),
  async (req, res, next) => {
    try {
      const { emailId } = req.body;
      const user = await User.findOne({ emailId: emailId.toLowerCase() });

      // Always respond with success to prevent account enumeration
      if (user) {
        const reset = createPasswordResetToken();
        user.passwordResetToken = reset.token;
        user.passwordResetExpires = reset.expires;
        await user.save();

        await sendMockEmail(
          user.emailId,
          "Password Reset Request",
          `Use this token to reset your password: ${reset.token}`
        );
      }

      return res.json({
        message:
          "If the provided email is registered, password reset instructions have been sent."
      });
    } catch (err) {
      next(err);
    }
  }
);

// 7. SUBMIT PASSWORD RESET
app.post(
  "/api/auth/reset-password",
  authLimiter,
  validate(resetPasswordValidation),
  async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          message: "Invalid or expired password reset token"
        });
      }

      user.password = await hashPassword(newPassword);
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      user.isLocked = false;
      user.failedLoginAttempts = 0;
      await user.save();

      // Revoke all existing sessions for security
      await revokeAllUserTokens(user._id);

      return res.json({
        message: "Password reset successful. Please login with your new password."
      });
    } catch (err) {
      next(err);
    }
  }
);

// 8. VERIFY EMAIL
app.post(
  "/api/auth/verify-email",
  validate(verifyEmailValidation),
  async (req, res, next) => {
    try {
      const { token } = req.body;

      const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          message: "Invalid or expired verification token"
        });
      }

      user.emailVerified = true;
      user.verificationToken = null;
      user.verificationTokenExpires = null;
      await user.save();

      return res.json({
        message: "Email verified successfully"
      });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------------
// PRODUCT ENDPOINTS
// -------------------------------------------------------------

// GET ALL PRODUCTS (Public, preserves database collection and IDs)
app.get("/api/products", async (_req, res, next) => {
  try {
    const products = await Product.find().select("-__v");
    return res.json(products);
  } catch (err) {
    next(err);
  }
});

// CREATE PRODUCT (Admin only - RBAC protected)
app.post(
  "/api/products",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { productName, productPrice, category, quantity, description } =
        req.body;

      if (!productName || productPrice == null || quantity == null) {
        return res.status(400).json({
          message: "Product name, price and quantity are required"
        });
      }

      const product = await Product.create({
        productName: String(productName).trim(),
        productPrice: Number(productPrice),
        category: category ? String(category).trim() : "General",
        quantity: Number(quantity),
        description: description ? String(description).trim() : ""
      });

      return res.status(201).json({
        message: "Product created successfully",
        product
      });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------------
// ORDER ENDPOINTS
// -------------------------------------------------------------

// PLACE ORDER / CHECKOUT
// Protected API - Never trusts userId from request body!
app.post(
  "/api/orders",
  authenticate,
  validate(orderValidation),
  async (req, res, next) => {
    try {
      const { items, userId: sentUserId } = req.body;

      // ENFORCE OBJECT LEVEL AUTHORIZATION:
      // Always bind the order to the authenticated user ID (req.user._id).
      const authenticatedUserId = req.user._id;

      // If client supplied a userId that does not match authenticated user, reject attempt
      if (sentUserId && sentUserId.toString() !== authenticatedUserId.toString() && req.user.role !== "admin") {
        return res.status(403).json({
          message: "Access forbidden: cannot create orders for another user"
        });
      }

      const user = await User.findById(authenticatedUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check for duplicate products in cart
      const productIds = new Set();
      for (const item of items) {
        const pId = String(item.productId);
        if (productIds.has(pId)) {
          return res.status(400).json({
            message: "Duplicate products in cart"
          });
        }
        productIds.add(pId);
      }

      // Fetch actual product prices from database & verify stock
      const orderItems = [];
      let totalAmount = 0;

      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(404).json({
            message: "Product not found"
          });
        }

        if (product.quantity < item.quantity) {
          return res.status(400).json({
            message: `Insufficient stock for ${product.productName}`
          });
        }

        orderItems.push({
          productId: product._id,
          productName: product.productName,
          quantity: item.quantity,
          price: product.productPrice
        });

        totalAmount += product.productPrice * item.quantity;
      }

      // Create order tied to verified identity
      const order = await Order.create({
        userId: authenticatedUserId,
        items: orderItems,
        totalAmount
      });

      // Reduce inventory atomically
      for (const item of items) {
        const updated = await Product.updateOne(
          {
            _id: item.productId,
            quantity: { $gte: item.quantity }
          },
          {
            $inc: { quantity: -item.quantity }
          }
        );

        if (updated.modifiedCount !== 1) {
          await Order.findByIdAndDelete(order._id);
          return res.status(409).json({
            message: "Stock changed. Please try checkout again."
          });
        }
      }

      return res.status(201).json({
        message: "Order placed successfully",
        orderId: order._id,
        totalAmount
      });
    } catch (err) {
      next(err);
    }
  }
);

// LIST ORDERS (Customers see only their own; Admins see all)
app.get("/api/orders", authenticate, async (req, res, next) => {
  try {
    const query =
      req.user.role === "admin"
        ? req.query.userId
          ? { userId: req.query.userId }
          : {}
        : { userId: req.user._id };

    const orders = await Order.find(query).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET ORDER BY ID (Checks Ownership)
app.get(
  "/api/orders/:id",
  authenticate,
  validate(objectIdParamValidation),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check Ownership: customer can only view their own order
      if (
        req.user.role !== "admin" &&
        order.userId.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Access forbidden: you do not own this order"
        });
      }

      return res.json(order);
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------------
// ADMIN ENDPOINTS (RBAC)
// -------------------------------------------------------------
app.get("/api/admin/users", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const users = await User.find().select("-password -__v");
    return res.json(users);
  } catch (err) {
    next(err);
  }
});

// 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

// Helper for starting server
async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.MONGO_URI);
    console.log("MongoDB Atlas Connected");
  }
}

async function closeDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

// Start backend if executed directly
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(config.PORT, () => {
        console.log(`Backend running on port ${config.PORT}`);
      });
    })
    .catch((err) => {
      console.error("MongoDB Connection Error:", err.message);
    });
}

module.exports = { app, connectDB, closeDB };
