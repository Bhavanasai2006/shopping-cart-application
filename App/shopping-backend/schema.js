
const mongoose = require("mongoose");

// USER SCHEMA
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  emailId: {
    type: String,
    required: true,
    unique: true
  },
  age: {
    type: Number,
    required: true,
    min: 1
  },
  password: {
    type: String,
    required: true
  }
});

// PRODUCT SCHEMA
const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    unique: true
  },
  productName: {
    type: String,
    required: true
  },
  productPrice: {
    type: Number,
    required: true,
    min: 0
  },
  category: String,
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  description: String
});

// ORDER SCHEMA
const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    productName: String,
    price: Number,
    quantity: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// MODELS
const User = mongoose.model("User", userSchema);
const Product = mongoose.model("Product", productSchema);
const Order = mongoose.model("Order", orderSchema);

module.exports = { User, Product, Order };
