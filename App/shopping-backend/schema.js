const mongoose = require("mongoose");

// USER SCHEMA
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: [2, "Username must be at least 2 characters"],
      maxlength: [50, "Username cannot exceed 50 characters"]
    },
    emailId: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true
    },
    age: {
      type: Number,
      required: [true, "Age is required"],
      min: [1, "Age must be at least 1"],
      max: [120, "Age cannot exceed 120"]
    },
    password: {
      type: String,
      required: [true, "Password is required"]
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer"
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: {
      type: String,
      default: null
    },
    verificationTokenExpires: {
      type: Date,
      default: null
    },
    passwordResetToken: {
      type: String,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.verificationToken;
        delete ret.verificationTokenExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// PRODUCT SCHEMA - Beauty & Skincare luxury catalog
const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    sparse: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productPrice: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    default: null
  },
  image: {
    type: String,
    default: ""
  },
  size: {
    type: String,
    default: "50 ml"
  },
  subtitle: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    trim: true,
    default: "Skincare"
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true,
    default: ""
  },
  howToUse: {
    type: String,
    default: ""
  },
  ingredients: {
    type: String,
    default: ""
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// ORDER ITEM SNAPSHOT SCHEMA - Immutable purchase-time record
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    productName: {
      type: String,
      required: true,
      default: "Skincare Product"
    },
    image: {
      type: String,
      default: ""
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
      default: function () {
        return (this.price || 0) * (this.quantity || 1);
      }
    }
  },
  { _id: false }
);

// ORDER SHIPPING ADDRESS SCHEMA
const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, trim: true, default: "United States" }
  },
  { _id: false }
);

// ORDER STATUS HISTORY SCHEMA - Audit log for status transitions
const orderStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["placed", "processing", "shipped", "delivered", "cancelled"],
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

// ORDER SCHEMA - Secure, transactional, lifecycle-enabled order record
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["placed", "processing", "shipped", "delivered", "cancelled"],
      default: "placed",
      index: true
    },
    statusHistory: {
      type: [orderStatusHistorySchema],
      default: function () {
        return [
          {
            status: "placed",
            changedAt: new Date(),
            note: "Order created successfully"
          }
        ];
      }
    },
    shippingAddress: {
      type: shippingAddressSchema,
      default: null
    },
    idempotencyKey: {
      type: String,
      sparse: true
    },
    idempotencyFingerprint: {
      type: String,
      sparse: true
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    cancellationReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index for scoped idempotency enforcement per customer
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
orderSchema.index({ userId: 1, createdAt: -1 });

// CART SCHEMA - Cloud-synchronized shopping cart
const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"]
    }
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    items: [cartItemSchema]
  },
  { timestamps: true }
);

// REFRESH TOKEN SCHEMA - Tracks rotation, expiry, revocation & reuse detection
const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    index: true
  },
  family: {
    type: String,
    required: true,
    index: true
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  replacedByTokenHash: {
    type: String,
    default: null
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30 // Automatic MongoDB TTL cleanup after 30 days
  }
});

// MODELS
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model("RefreshToken", refreshTokenSchema);

module.exports = { User, Product, Order, Cart, RefreshToken };
