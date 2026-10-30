
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const { User, Product, Order } = require("./schema");

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Atlas connection
mongoose
  .connect(
    "mongodb+srv://subhilogix_db_user:2007@web-tech.um7hzkf.mongodb.net/shoppingcart"
  )
  .then(() => {
    console.log("MongoDB Atlas Connected");
  })
  .catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
  });

// 1. REGISTER USER
app.post("/api/users", async (req, res) => {
  try {
    const { username, emailId, age, password } = req.body;

    if (!username || !emailId || age == null || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const existingUser = await User.findOne({ emailId });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      emailId,
      age,
      password: hashedPassword
    });

    res.status(201).json({
      message: "Registration successful",
      userId: user._id,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// 2. LOGIN USER
app.post("/api/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;

    const user = await User.findOne({ emailId });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    res.json({
      message: "Login successful",
      userId: user._id,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// // 3. GET ALL PRODUCTS
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});


// app.get("/api/products", async (req, res) => {
//   try {
//     console.log("Connected database:", mongoose.connection.name);
//     console.log("Product collection:", Product.collection.name);

//     const count = await Product.countDocuments();
//     const products = await Product.find();

//     console.log("Product count:", count);

//     res.json({
//       database: mongoose.connection.name,
//       collection: Product.collection.name,
//       count: count,
//       products: products
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.message });
//   }
// });


// 4. PLACE ORDER / CHECKOUT
app.post("/api/orders", async (req, res) => {
  try {
    const { userId, items } = req.body;

    if (
      !userId ||
      !mongoose.isValidObjectId(userId) ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message: "Invalid checkout details"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Validate cart items
    const productIds = new Set();

    for (const item of items) {
      if (
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return res.status(400).json({
          message: "Invalid product or quantity"
        });
      }

      if (productIds.has(String(item.productId))) {
        return res.status(400).json({
          message: "Duplicate products in cart"
        });
      }

      productIds.add(String(item.productId));
    }

    // Fetch actual product prices from database
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

    // Create order
    const order = await Order.create({
      userId,
      items: orderItems,
      totalAmount
    });

    // Reduce inventory
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
        // Demo rollback of order if stock update fails
        await Order.findByIdAndDelete(order._id);

        return res.status(409).json({
          message: "Stock changed. Please try checkout again."
        });
      }
    }

    res.status(201).json({
      message: "Order placed successfully",
      orderId: order._id,
      totalAmount
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// Start backend
app.listen(5000, () => {
  console.log("Backend running on port 5000");
});
