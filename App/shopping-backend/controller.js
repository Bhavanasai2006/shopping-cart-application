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
const crypto = require("node:crypto");

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

const { corsOptions } = require("./middleware/security");

const {
  authenticate,
  requireAdmin,
  requireCustomer
} = require("./middleware/auth");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Middleware Pipeline: CORS and Parsing
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: config.BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT }));

// -------------------------------------------------------------
// AUTHENTICATION & IDENTITY ENDPOINTS
// -------------------------------------------------------------

// 1. REGISTER USER
app.post(
  "/api/users",
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
      emailVerified: user.emailVerified,
      savedAddresses: user.savedAddresses || []
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
app.get("/api/products/:id", async (req, res, next) => {
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

    const generatedId = new mongoose.Types.ObjectId();
    const product = await Product.create({
      _id: generatedId,
      productId: req.body.productId ? String(req.body.productId).trim() : `prod_${generatedId}`,
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

    const isProductActive = p.isActive !== false;
    const availableStock = isProductActive && p.quantity != null ? p.quantity : 0;
    let qty = item.quantity;
    if (!isProductActive) {
      qty = item.quantity;
    } else if (qty > availableStock && availableStock > 0) {
      qty = availableStock;
      itemsModified = true;
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
      cartQty: qty,
      isActive: isProductActive
    });
  }

  // Clean out deleted (null reference) products if adjusted
  if (itemsModified) {
    cartDoc.items = validItems
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

// Middleware: Strictly reject real financial credentials
const sensitivePaymentGuard = (req, res, next) => {
  const PROHIBITED_CREDENTIAL_KEYS = [
    "cvv", "cvc", "cardnumber", "card_number", "pan", "pin", "upipin", "upi_pin",
    "otp", "bankaccount", "bankpassword", "netbankingpassword", "cardexpiry", "expirydate"
  ];
  const submittedKeys = Object.keys(req.body || {}).map((k) => k.toLowerCase());
  const hasProhibited = PROHIBITED_CREDENTIAL_KEYS.some((pk) => submittedKeys.includes(pk));
  if (hasProhibited) {
    return res.status(400).json({
      message: "Security error: Real financial credentials (CVV, Card Number, PIN, OTP) must never be submitted. This is a demo payment system."
    });
  }
  next();
};

// -------------------------------------------------------------
// SAVED ADDRESSES ENDPOINTS (Customer address management)
// -------------------------------------------------------------

// 1. GET ALL SAVED ADDRESSES
app.get("/api/users/addresses", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({
      addresses: user.savedAddresses || []
    });
  } catch (err) {
    next(err);
  }
});

// 2. CREATE A NEW SAVED ADDRESS
app.post(
  "/api/users/addresses",
  authenticate,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id || req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.savedAddresses) {
        user.savedAddresses = [];
      }

      const isFirst = user.savedAddresses.length === 0;
      const shouldBeDefault = isFirst || Boolean(req.body.isDefault);

      if (shouldBeDefault) {
        user.savedAddresses.forEach((addr) => {
          addr.isDefault = false;
        });
      }

      const newAddr = {
        _id: new mongoose.Types.ObjectId(),
        fullName: req.body.fullName.trim(),
        phone: req.body.phone.trim(),
        addressLine1: req.body.addressLine1.trim(),
        addressLine2: (req.body.addressLine2 || "").trim(),
        city: req.body.city.trim(),
        state: req.body.state.trim(),
        postalCode: req.body.postalCode.trim(),
        country: (req.body.country || "").trim(),
        isDefault: shouldBeDefault
      };

      user.savedAddresses.push(newAddr);
      await user.save();

      const created = user.savedAddresses[user.savedAddresses.length - 1];

      return res.status(201).json({
        message: "Address saved successfully",
        addresses: user.savedAddresses,
        address: created
      });
    } catch (err) {
      next(err);
    }
  }
);

// 3. DELETE A SAVED ADDRESS
app.delete("/api/users/addresses/:addressId", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const addrIndex = (user.savedAddresses || []).findIndex(
      (a) => a._id.toString() === req.params.addressId
    );

    if (addrIndex === -1) {
      return res.status(404).json({ message: "Address not found" });
    }

    const wasDefault = user.savedAddresses[addrIndex].isDefault;
    user.savedAddresses.splice(addrIndex, 1);

    if (wasDefault && user.savedAddresses.length > 0) {
      user.savedAddresses[0].isDefault = true;
    }

    await user.save();

    return res.json({
      message: "Address deleted successfully",
      addresses: user.savedAddresses
    });
  } catch (err) {
    next(err);
  }
});

// 4. SET ADDRESS AS DEFAULT
app.put("/api/users/addresses/:addressId/default", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let found = false;
    (user.savedAddresses || []).forEach((addr) => {
      if (addr._id.toString() === req.params.addressId) {
        addr.isDefault = true;
        found = true;
      } else {
        addr.isDefault = false;
      }
    });

    if (!found) {
      return res.status(404).json({ message: "Address not found" });
    }

    await user.save();

    return res.json({
      message: "Default address updated",
      addresses: user.savedAddresses
    });
  } catch (err) {
    next(err);
  }
});

// PLACE ORDER / CHECKOUT (Secure, Transactional, Idempotent)
// Protected API - Never trusts client-supplied prices, totals, or userId!
app.post(
  "/api/orders",
  authenticate,
  sensitivePaymentGuard,
  async (req, res, next) => {
    try {
      // SECURITY CHECK: Real financial credentials must NEVER be submitted
      const PROHIBITED_CREDENTIAL_KEYS = [
        "cvv", "cvc", "cardnumber", "card_number", "pan", "pin", "upipin", "upi_pin",
        "otp", "bankaccount", "bankpassword", "netbankingpassword", "cardexpiry", "expirydate"
      ];
      const submittedKeys = Object.keys(req.body || {}).map((k) => k.toLowerCase());
      const hasProhibited = PROHIBITED_CREDENTIAL_KEYS.some((pk) => submittedKeys.includes(pk));
      if (hasProhibited) {
        return res.status(400).json({
          message: "Security error: Real financial credentials (CVV, Card Number, PIN, OTP) must never be submitted. This is a demo payment system."
        });
      }

      const {
        items,
        userId: sentUserId,
        shippingAddress,
        paymentMethod: rawPaymentMethod,
        simulateFailure,
        demoAccount
      } = req.body;

      const paymentMethod = ["DEMO_SIMULATION", "DEMO_CARD", "DEMO_UPI", "DEMO_COD"].includes(rawPaymentMethod)
        ? rawPaymentMethod
        : "DEMO_SIMULATION";

      // SIMULATE PAYMENT FAILURE: Safely abort without creating an order or touching inventory
      if (simulateFailure === true) {
        return res.status(402).json({
          message: "Simulated Demo Payment Failed (Bank authorization declined). No charges were made, and your cart is preserved. Please retry with a valid demo method.",
          paymentStatus: "demo_failed",
          isDemoPayment: true,
          canRetry: true
        });
      }

      // If requested, save new shipping address to user's profile
      let updatedUserSavedAddresses = null;
      if (req.body.saveAddress && shippingAddress) {
        try {
          const authUser = await User.findById(req.user._id || req.user.id);
          if (authUser) {
            if (!authUser.savedAddresses) {
              authUser.savedAddresses = [];
            }
            const isDuplicate = authUser.savedAddresses.some(
              (a) =>
                a.addressLine1.toLowerCase().trim() === shippingAddress.addressLine1.toLowerCase().trim() &&
                a.postalCode.toLowerCase().trim() === shippingAddress.postalCode.toLowerCase().trim()
            );
            if (!isDuplicate) {
              authUser.savedAddresses.push({
                _id: new mongoose.Types.ObjectId(),
                fullName: shippingAddress.fullName.trim(),
                phone: shippingAddress.phone.trim(),
                addressLine1: shippingAddress.addressLine1.trim(),
                addressLine2: (shippingAddress.addressLine2 || "").trim(),
                city: shippingAddress.city.trim(),
                state: shippingAddress.state.trim(),
                postalCode: shippingAddress.postalCode.trim(),
                country: (shippingAddress.country || "").trim(),
                isDefault: authUser.savedAddresses.length === 0
              });
              await authUser.save();
            }
            updatedUserSavedAddresses = authUser.savedAddresses;
          }
        } catch {
          // Non-fatal if address autosave fails during order creation
        }
      }

      // Extract client-generated idempotency key from headers or request body
      const rawKey =
        req.headers["idempotency-key"] ||
        req.headers["x-idempotency-key"] ||
        req.body.idempotencyKey;
      const idempotencyKey = rawKey ? String(rawKey).trim() : null;

      // ENFORCE OBJECT LEVEL AUTHORIZATION:
      // Always bind the order to the authenticated user ID (req.user._id).
      const authenticatedUserId = req.user._id;

      // Reject attempt if client explicitly supplied a mismatched userId (unless admin)
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

      // Safe normalization and aggregation of items by productId
      // Consolidates duplicate product line items and prevents quantity overflow
      const aggregatedMap = new Map();
      for (const item of items) {
        const pId = String(item.productId);
        const existing = aggregatedMap.get(pId) || 0;
        const newQty = existing + Number(item.quantity);
        if (newQty > 99) {
          return res.status(400).json({
            message: "Quantity for product exceeds maximum allowed limit of 99 units"
          });
        }
        aggregatedMap.set(pId, newQty);
      }

      const normalizedItems = Array.from(aggregatedMap.entries()).map(
        ([productId, quantity]) => ({
          productId,
          quantity
        })
      );

      // Compute request fingerprint for payload verification
      const fingerprintPayload = {
        items: normalizedItems,
        shippingAddress: shippingAddress || null,
        paymentMethod
      };
      const idempotencyFingerprint = crypto
        .createHash("sha256")
        .update(JSON.stringify(fingerprintPayload))
        .digest("hex");

      // Check Idempotency: Return existing order if identical request retried
      if (idempotencyKey) {
        const existingOrder = await Order.findOne({
          userId: authenticatedUserId,
          idempotencyKey
        });

        if (existingOrder) {
          if (existingOrder.idempotencyFingerprint === idempotencyFingerprint) {
            return res.status(200).json({
              message: "Order placed successfully",
              orderId: existingOrder._id,
              totalAmount: existingOrder.totalAmount,
              status: existingOrder.status,
              isIdempotentReplay: true,
              order: existingOrder
            });
          } else {
            return res.status(409).json({
              message:
                "Idempotency key was previously used with a different order payload."
            });
          }
        }
      }

      // Fetch actual product prices from database & verify availability and stock
      const orderItems = [];
      let totalAmount = 0;

      for (const item of normalizedItems) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(404).json({
            message: "Product not found"
          });
        }

        if (product.isActive === false) {
          return res.status(400).json({
            message: `Product "${product.productName}" is currently deactivated or unavailable.`
          });
        }

        if (product.quantity < item.quantity) {
          return res.status(400).json({
            message: `Insufficient stock for ${product.productName}`
          });
        }

        const price = Number(product.productPrice);
        const lineTotal = price * item.quantity;

        // Snapshot purchase-time immutable product data
        orderItems.push({
          productId: product._id,
          productName: product.productName,
          image: product.image || "",
          price,
          quantity: item.quantity,
          lineTotal
        });

        totalAmount += lineTotal;
      }

      // Validate calculated numeric bounds
      if (totalAmount <= 0 || !Number.isFinite(totalAmount)) {
        return res.status(400).json({
          message: "Invalid total calculation"
        });
      }

      // ATOMIC INVENTORY & ORDER MANAGEMENT:
      // Uses Mongoose session and multi-document transaction to guarantee all-or-nothing execution.
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        // 1. Conditionally deduct inventory for every item
        for (const item of orderItems) {
          const updateResult = await Product.updateOne(
            {
              _id: item.productId,
              quantity: { $gte: item.quantity },
              isActive: { $ne: false }
            },
            {
              $inc: { quantity: -item.quantity }
            },
            { session }
          );

          if (updateResult.modifiedCount !== 1) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({
              message: "Stock changed. Please try checkout again."
            });
          }
        }

        // 2. Persist order with immutable snapshots, shipping address & idempotency key
        const [order] = await Order.create(
          [
            {
              userId: authenticatedUserId,
              items: orderItems,
              totalAmount,
              status: "placed",
              statusHistory: [
                {
                  status: "placed",
                  changedAt: new Date(),
                  note: `Order placed successfully via ${paymentMethod} (Simulated Demo Payment)`
                }
              ],
              shippingAddress: shippingAddress || null,
              idempotencyKey: idempotencyKey || null,
              idempotencyFingerprint: idempotencyKey
                ? idempotencyFingerprint
                : null,
              isDemoPayment: true,
              paymentMethod,
              paymentStatus: paymentMethod === "DEMO_COD" ? "demo_pending" : "demo_completed",
              paymentSimulation: {
                isDemo: true,
                disclaimer: "DEMO PAYMENT — No real money is transferred.",
                transactionId: `DEMO_TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
                simulatedAccount: demoAccount || (paymentMethod === "DEMO_UPI" ? "customer@demoupi" : paymentMethod === "DEMO_COD" ? "Cash on Delivery (Simulated)" : "Instant Sandbox Simulation"),
                completedAt: new Date()
              }
            }
          ],
          { session }
        );

        // 3. Commit the multi-document transaction atomically
        await session.commitTransaction();
        session.endSession();

        // 4. Cart Consistency: Remove purchased items from cloud cart post-commit
        try {
          const purchasedProductIds = new Set(
            orderItems.map((i) => i.productId.toString())
          );
          const userCart = await Cart.findOne({ userId: authenticatedUserId });
          if (userCart && Array.isArray(userCart.items)) {
            userCart.items = userCart.items.filter(
              (ci) =>
                !purchasedProductIds.has(
                  (ci.productId?._id || ci.productId).toString()
                )
            );
            await userCart.save();
          }
        } catch (cartErr) {
          console.error("Cart synchronization notice after order commit:", cartErr);
        }

        return res.status(201).json({
          message: "Order placed successfully",
          orderId: order._id,
          totalAmount,
          status: order.status,
          isDemoPayment: true,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          paymentSimulation: order.paymentSimulation,
          savedAddresses: updatedUserSavedAddresses,
          order
        });
      } catch (txnError) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        session.endSession();

        // Handle concurrent duplicate request race on compound unique index
        if (txnError.code === 11000 && idempotencyKey) {
          const winningOrder = await Order.findOne({
            userId: authenticatedUserId,
            idempotencyKey
          });
          if (
            winningOrder &&
            winningOrder.idempotencyFingerprint === idempotencyFingerprint
          ) {
            return res.status(200).json({
              message: "Order placed successfully",
              orderId: winningOrder._id,
              totalAmount: winningOrder.totalAmount,
              status: winningOrder.status,
              isIdempotentReplay: true,
              order: winningOrder
            });
          }
          return res.status(409).json({
            message:
              "Idempotency key was previously used with a different order payload."
          });
        }

        throw txnError;
      }
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

// CANCEL ORDER & RESTORE INVENTORY ATOMICALLY
// Customer order cancellation endpoint: checks ownership and eligibility, restores inventory atomically
app.put(
  "/api/orders/:id/cancel",
  authenticate,
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check Ownership: customer can only cancel their own order; admin can cancel any
      if (
        req.user.role !== "admin" &&
        order.userId.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Access forbidden: you do not have permission to cancel this order"
        });
      }

      // Check cancellation eligibility
      if (order.status === "cancelled") {
        return res.status(400).json({
          message: "Order is already cancelled"
        });
      }

      if (order.status === "shipped" || order.status === "delivered") {
        return res.status(400).json({
          message: `Orders with status '${order.status}' cannot be cancelled.`
        });
      }

      if (order.status !== "placed" && order.status !== "processing") {
        return res.status(400).json({
          message: `Order cannot be cancelled in its current state (${order.status}).`
        });
      }

      const cancellationReason =
        req.body?.reason?.trim() ||
        (req.user.role === "admin"
          ? "Cancelled by administrator"
          : "Cancelled by customer");

      // Atomically restore inventory and update order status in a transaction
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        // Restock inventory for each order item
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { quantity: item.quantity } },
            { session }
          );
        }

        order.status = "cancelled";
        order.cancelledAt = new Date();
        order.cancellationReason = cancellationReason;
        if (order.isDemoPayment) {
          order.paymentStatus = "demo_refunded";
        }
        order.statusHistory.push({
          status: "cancelled",
          changedAt: new Date(),
          note: cancellationReason
        });

        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.json({
          message: "Order cancelled successfully and inventory restored",
          orderId: order._id,
          status: order.status,
          order
        });
      } catch (txnErr) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        session.endSession();
        throw txnErr;
      }
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
  createProductHandler
);

// 3. ADMIN GET PRODUCT BY ID (Includes inactive products)
app.get(
  "/api/admin/products/:id",
  authenticate,
  requireAdmin,
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

// ADMIN ORDER STATUS LIFECYCLE MANAGEMENT
app.patch(
  "/api/admin/orders/:id/status",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const { status: newStatus, note } = req.body;
      const currentStatus = order.status || "placed";

      if (currentStatus === newStatus) {
        return res.json({
          message: `Order is already in status '${newStatus}'`,
          order
        });
      }

      // Valid status transition state machine
      const allowedTransitions = {
        placed: ["processing", "cancelled"],
        processing: ["shipped", "cancelled"],
        shipped: ["delivered"],
        delivered: [],
        cancelled: []
      };

      if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
        return res.status(400).json({
          message: `Invalid status transition from '${currentStatus}' to '${newStatus}'.`
        });
      }

      // If transitioning to cancelled, restore inventory atomically
      if (newStatus === "cancelled") {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();

          for (const item of order.items) {
            await Product.updateOne(
              { _id: item.productId },
              { $inc: { quantity: item.quantity } },
              { session }
            );
          }

          order.status = "cancelled";
          order.cancelledAt = new Date();
          order.cancellationReason = note || "Cancelled by administrator";
          if (order.isDemoPayment) {
            order.paymentStatus = "demo_refunded";
          }
          order.statusHistory.push({
            status: "cancelled",
            changedAt: new Date(),
            note: note || "Status updated by administrator"
          });

          await order.save({ session });
          await session.commitTransaction();
          session.endSession();

          return res.json({
            message: "Order cancelled and inventory restored",
            order
          });
        } catch (txnErr) {
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
          session.endSession();
          throw txnErr;
        }
      }

      // Forward lifecycle transition (processing, shipped, delivered)
      order.status = newStatus;
      order.statusHistory.push({
        status: newStatus,
        changedAt: new Date(),
        note: note || `Status updated to ${newStatus} by administrator`
      });

      await order.save();

      return res.json({
        message: `Order status updated to '${newStatus}'`,
        order
      });
    } catch (err) {
      next(err);
    }
  }
);

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
  const server = app.listen(config.PORT, () => {
    console.log(`Backend running on port ${config.PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${config.PORT} is already in use.`);
    } else {
      console.error("Server error:", err.message);
    }
  });

  connectDB().catch((err) => {
    console.error("MongoDB Connection Warning:", err.message);
    console.error("Note: Ensure your current IP is whitelisted on MongoDB Atlas (Network Access -> Add IP Address).");
  });
}

module.exports = { app, connectDB, closeDB };
