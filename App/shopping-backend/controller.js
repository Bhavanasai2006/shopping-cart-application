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
const { User, Product, Order, Cart } = require("./schema");
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
  objectIdParamValidation,
  createProductValidation,
  updateProductValidation
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

// UPDATE PROFILE (Username, Age)
app.put("/api/users/me", authenticate, async (req, res, next) => {
  try {
    const { username, age } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (username !== undefined) {
      const trimmed = String(username).trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        return res.status(400).json({ message: "Username must be between 2 and 50 characters" });
      }
      user.username = trimmed;
    }

    if (age !== undefined) {
      const parsedAge = Number(age);
      if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        return res.status(400).json({ message: "Age must be an integer between 1 and 120" });
      }
      user.age = parsedAge;
    }

    await user.save();

    return res.json({
      message: "Profile updated successfully",
      user: {
        userId: user._id,
        username: user.username,
        emailId: user.emailId,
        age: user.age,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    next(err);
  }
});

// CHANGE PASSWORD (Authenticated)
app.post("/api/auth/change-password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters long" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current password" });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
});

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

// GET ALL PRODUCTS (Public, with authoritative search, filter, sort & pagination)
app.get("/api/products", async (req, res, next) => {
  try {
    const { category, search, minPrice, maxPrice, sortBy, page, limit } = req.query;
    // Exclude deactivated/archived products from public catalog
    const query = { isActive: { $ne: false } };

    if (category && category !== "All") {
      query.category = { $regex: new RegExp(`^${category}$`, "i") };
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { productName: searchRegex },
        { description: searchRegex },
        { subtitle: searchRegex },
        { category: searchRegex }
      ];
    }

    if (minPrice != null || maxPrice != null) {
      query.productPrice = {};
      if (minPrice != null && minPrice !== "" && !isNaN(Number(minPrice))) {
        query.productPrice.$gte = Number(minPrice);
      }
      if (maxPrice != null && maxPrice !== "" && !isNaN(Number(maxPrice))) {
        query.productPrice.$lte = Number(maxPrice);
      }
      if (Object.keys(query.productPrice).length === 0) {
        delete query.productPrice;
      }
    }

    let sortOption = { _id: -1 };
    if (sortBy === "price-asc") sortOption = { productPrice: 1 };
    else if (sortBy === "price-desc") sortOption = { productPrice: -1 };
    else if (sortBy === "name-asc") sortOption = { productName: 1 };
    else if (sortBy === "name-desc") sortOption = { productName: -1 };

    // Authoritative Pagination if requested
    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 10);
      const skip = (pageNum - 1) * limitNum;

      const [products, total] = await Promise.all([
        Product.find(query).sort(sortOption).skip(skip).limit(limitNum).select("-__v"),
        Product.countDocuments(query)
      ]);

      return res.json({
        products,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
      });
    }

    const products = await Product.find(query).sort(sortOption).select("-__v");
    return res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET PRODUCT BY ID (Authoritative product lookup)
app.get("/api/products/:id", validate(objectIdParamValidation), async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).select("-__v");
    if (!product || product.isActive === false) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json(product);
  } catch (err) {
    next(err);
  }
});

// Shared Admin Product Creation Logic
async function createProductHandler(req, res, next) {
  try {
    const {
      productName,
      productPrice,
      originalPrice,
      image,
      size,
      subtitle,
      category,
      quantity,
      description,
      howToUse,
      ingredients,
      isActive
    } = req.body;

    const product = await Product.create({
      productName: String(productName).trim(),
      productPrice: Number(productPrice),
      originalPrice: originalPrice != null ? Number(originalPrice) : null,
      image: image ? String(image).trim() : "",
      size: size ? String(size).trim() : "50 ml",
      subtitle: subtitle ? String(subtitle).trim() : "",
      category: category ? String(category).trim() : "Skincare",
      quantity: Number(quantity),
      description: description ? String(description).trim() : "",
      howToUse: howToUse ? String(howToUse).trim() : "",
      ingredients: ingredients ? String(ingredients).trim() : "",
      isActive: isActive !== false
    });

    return res.status(201).json({
      message: "Product created successfully",
      product
    });
  } catch (err) {
    next(err);
  }
}

// CREATE PRODUCT (Legacy endpoint, admin-only & validated)
app.post(
  "/api/products",
  authenticate,
  requireAdmin,
  validate(createProductValidation),
  createProductHandler
);

// -------------------------------------------------------------
// CART ENDPOINTS (Cloud-Synchronized across devices)
// Authoritative prices and live stock are enforced!
// -------------------------------------------------------------

async function formatCartResponse(cartDoc) {
  await cartDoc.populate("items.productId");

  const validItems = [];
  let itemsModified = false;

  for (const item of cartDoc.items) {
    const p = item.productId;
    if (!p) {
      itemsModified = true;
      continue;
    }

    const availableStock = p.quantity != null ? p.quantity : 0;
    let qty = item.quantity;
    if (qty > availableStock && availableStock > 0) {
      qty = availableStock;
      itemsModified = true;
    } else if (availableStock === 0) {
      qty = 0;
    }

    validItems.push({
      _id: p._id,
      productId: p._id,
      productName: p.productName,
      subtitle: p.subtitle || "",
      productPrice: p.productPrice,
      originalPrice: p.originalPrice || null,
      size: p.size || "50 ml",
      category: p.category || "Skincare",
      image: p.image || "",
      quantity: availableStock,
      cartQty: qty
    });
  }

  // Clean out deleted or zero-stock products if adjusted
  if (itemsModified) {
    cartDoc.items = validItems
      .filter((i) => i.cartQty > 0)
      .map((i) => ({ productId: i.productId, quantity: i.cartQty }));
    await cartDoc.save();
  }

  const itemsSubtotal = validItems.reduce(
    (sum, item) => sum + item.productPrice * item.cartQty,
    0
  );
  const totalItems = validItems.reduce((sum, item) => sum + item.cartQty, 0);

  return {
    items: validItems,
    subtotal: itemsSubtotal,
    totalItems
  };
}

// 1. GET CART
app.get("/api/cart", authenticate, async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user._id, items: [] });
    }
    const response = await formatCartResponse(cart);
    return res.json(response);
  } catch (err) {
    next(err);
  }
});

// 2. ADD / MERGE ITEMS TO CART
// Accepts single: { productId, quantity } or batch: { items: [{ productId, quantity }] }
app.post("/api/cart/items", authenticate, async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user._id, items: [] });
    }

    const itemsToAdd = Array.isArray(req.body.items)
      ? req.body.items
      : [
          {
            productId: req.body.productId,
            quantity: req.body.quantity || 1
          }
        ];

    for (const item of itemsToAdd) {
      if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
        continue;
      }

      const product = await Product.findById(item.productId);
      if (!product || product.quantity <= 0) continue;

      const addQty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const existing = cart.items.find(
        (i) => (i.productId?._id || i.productId).toString() === item.productId.toString()
      );

      if (existing) {
        existing.quantity = Math.min(
          product.quantity,
          existing.quantity + addQty
        );
      } else {
        cart.items.push({
          productId: product._id,
          quantity: Math.min(product.quantity, addQty)
        });
      }
    }

    await cart.save();
    const response = await formatCartResponse(cart);
    return res.json(response);
  } catch (err) {
    next(err);
  }
});

// 3. UPDATE ITEM QUANTITY IN CART
app.put("/api/cart/items/:productId", authenticate, async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }
    const targetQty = parseInt(req.body.quantity, 10);

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user._id, items: [] });
    }

    if (isNaN(targetQty) || targetQty <= 0) {
      cart.items = cart.items.filter(
        (i) => (i.productId?._id || i.productId).toString() !== productId.toString()
      );
    } else {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const clampedQty = Math.min(product.quantity, targetQty);
      const existing = cart.items.find(
        (i) => (i.productId?._id || i.productId).toString() === productId.toString()
      );

      if (existing) {
        existing.quantity = clampedQty;
      } else {
        cart.items.push({ productId: product._id, quantity: clampedQty });
      }
    }

    await cart.save();
    const response = await formatCartResponse(cart);
    return res.json(response);
  } catch (err) {
    next(err);
  }
});

// 4. REMOVE ITEM FROM CART
app.delete("/api/cart/items/:productId", authenticate, async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }
    let cart = await Cart.findOne({ userId: req.user._id });

    if (cart) {
      cart.items = cart.items.filter(
        (i) => (i.productId?._id || i.productId).toString() !== productId.toString()
      );
      await cart.save();
    } else {
      cart = await Cart.create({ userId: req.user._id, items: [] });
    }

    const response = await formatCartResponse(cart);
    return res.json(response);
  } catch (err) {
    next(err);
  }
});

// 5. CLEAR ENTIRE CART
app.delete("/api/cart", authenticate, async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    return res.json({ items: [], subtotal: 0, totalItems: 0 });
  } catch (err) {
    next(err);
  }
});

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
      if (
        sentUserId &&
        sentUserId.toString() !== authenticatedUserId.toString() &&
        req.user.role !== "admin"
      ) {
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

      // Synchronously empty user's cloud cart upon successful order
      await Cart.findOneAndUpdate(
        { userId: authenticatedUserId },
        { $set: { items: [] } }
      );

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

// 1. ADMIN PRODUCTS LISTING (Full catalog including active/inactive status and metrics)
app.get("/api/admin/products", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { category, search, status, sortBy, page, limit } = req.query;
    const query = {};

    if (category && category !== "All") {
      query.category = { $regex: new RegExp(`^${category}$`, "i") };
    }

    if (status === "active") {
      query.isActive = { $ne: false };
    } else if (status === "inactive") {
      query.isActive = false;
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { productName: searchRegex },
        { description: searchRegex },
        { subtitle: searchRegex },
        { category: searchRegex }
      ];
    }

    let sortOption = { _id: -1 };
    if (sortBy === "price-asc") sortOption = { productPrice: 1 };
    else if (sortBy === "price-desc") sortOption = { productPrice: -1 };
    else if (sortBy === "name-asc") sortOption = { productName: 1 };
    else if (sortBy === "name-desc") sortOption = { productName: -1 };
    else if (sortBy === "stock-asc") sortOption = { quantity: 1 };
    else if (sortBy === "stock-desc") sortOption = { quantity: -1 };

    const [totalAll, totalActive, totalInactive, totalLowStock, totalOutOfStock] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ isActive: { $ne: false } }),
      Product.countDocuments({ isActive: false }),
      Product.countDocuments({ quantity: { $gt: 0, $lte: 5 } }),
      Product.countDocuments({ quantity: 0 })
    ]);

    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 10);
      const skip = (pageNum - 1) * limitNum;

      const [products, filteredTotal] = await Promise.all([
        Product.find(query).sort(sortOption).skip(skip).limit(limitNum).select("-__v"),
        Product.countDocuments(query)
      ]);

      return res.json({
        products,
        total: filteredTotal,
        totalAll,
        totalActive,
        totalInactive,
        totalLowStock,
        totalOutOfStock,
        page: pageNum,
        totalPages: Math.ceil(filteredTotal / limitNum)
      });
    }

    const products = await Product.find(query).sort(sortOption).select("-__v");
    return res.json({
      products,
      total: products.length,
      totalAll,
      totalActive,
      totalInactive,
      totalLowStock,
      totalOutOfStock
    });
  } catch (err) {
    next(err);
  }
});

// 2. ADMIN CREATE PRODUCT
app.post(
  "/api/admin/products",
  authenticate,
  requireAdmin,
  validate(createProductValidation),
  createProductHandler
);

// 3. ADMIN GET PRODUCT BY ID (Includes inactive products)
app.get(
  "/api/admin/products/:id",
  authenticate,
  requireAdmin,
  validate(objectIdParamValidation),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id).select("-__v");
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      return res.json(product);
    } catch (err) {
      next(err);
    }
  }
);

// 4. ADMIN UPDATE PRODUCT (Allowlisted fields with mass-assignment protection)
app.patch(
  "/api/admin/products/:id",
  authenticate,
  requireAdmin,
  validate(updateProductValidation),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const allowedFields = [
        "productName",
        "subtitle",
        "productPrice",
        "originalPrice",
        "category",
        "size",
        "quantity",
        "description",
        "howToUse",
        "ingredients",
        "image",
        "isActive"
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === "productPrice" || field === "quantity") {
            product[field] = Number(req.body[field]);
          } else if (field === "originalPrice") {
            product[field] = req.body[field] != null ? Number(req.body[field]) : null;
          } else if (typeof req.body[field] === "string") {
            product[field] = req.body[field].trim();
          } else {
            product[field] = req.body[field];
          }
        }
      }

      await product.save();

      return res.json({
        message: "Product updated successfully",
        product
      });
    } catch (err) {
      next(err);
    }
  }
);

// 5. ADMIN DEACTIVATE / SOFT-DELETE PRODUCT (Preserves order and cart history)
app.delete(
  "/api/admin/products/:id",
  authenticate,
  requireAdmin,
  validate(objectIdParamValidation),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // If permanent delete is explicitly requested, prevent breaking existing orders
      if (req.query.permanent === "true") {
        const orderUsingProduct = await Order.findOne({ "items.productId": product._id });
        if (orderUsingProduct) {
          product.isActive = false;
          await product.save();
          return res.status(409).json({
            message:
              "Cannot permanently delete product referenced in customer order history. Product safely deactivated instead.",
            product
          });
        }
        await Product.findByIdAndDelete(product._id);
        return res.json({
          message: "Product permanently removed from database",
          productId: product._id
        });
      }

      // Safe deactivation
      product.isActive = false;
      await product.save();

      return res.json({
        message: "Product deactivated successfully",
        product
      });
    } catch (err) {
      next(err);
    }
  }
);

// 6. ADMIN REACTIVATE PRODUCT
app.post(
  "/api/admin/products/:id/reactivate",
  authenticate,
  requireAdmin,
  validate(objectIdParamValidation),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      product.isActive = true;
      await product.save();

      return res.json({
        message: "Product reactivated successfully",
        product
      });
    } catch (err) {
      next(err);
    }
  }
);

// 7. ADMIN ORDERS OVERVIEW
app.get("/api/admin/orders", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("userId", "username emailId role")
      .sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    next(err);
  }
});

// 8. ADMIN DASHBOARD STATS
app.get("/api/admin/stats", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      lowStockProducts,
      outOfStockProducts,
      totalOrders,
      totalUsers,
      allOrders
    ] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ isActive: { $ne: false } }),
      Product.countDocuments({ isActive: false }),
      Product.countDocuments({ quantity: { $gt: 0, $lte: 5 } }),
      Product.countDocuments({ quantity: 0 }),
      Order.countDocuments({}),
      User.countDocuments({ role: "customer" }),
      Order.find({}).select("totalAmount")
    ]);

    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return res.json({
      stats: {
        totalProducts,
        activeProducts,
        inactiveProducts,
        lowStockProducts,
        outOfStockProducts,
        totalOrders,
        totalUsers,
        totalRevenue: Math.round(totalRevenue * 100) / 100
      }
    });
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
