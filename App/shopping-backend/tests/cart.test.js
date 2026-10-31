process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secure_access_secret_32_characters";
process.env.JWT_REFRESH_SECRET = "test_super_secure_refresh_secret_32_characters";
process.env.CUSTOM_DNS = "false";

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");

const { setupMockDatabase, resetDb, store } = require("./testHarness");
setupMockDatabase();

const { app } = require("../controller");
const { hashPassword } = require("../services/authService");

describe("Cloud-Synchronized Cart API Integration Tests", () => {
  let userToken;
  let userId;
  let productA;
  let productB;

  beforeEach(async () => {
    resetDb();

    // 1. Create a customer user
    userId = new mongoose.Types.ObjectId();
    const passwordHash = await hashPassword("SkincarePass123!");
    const user = {
      _id: userId,
      username: "SkincareLover",
      emailId: "skincare@sole.com",
      age: 26,
      password: passwordHash,
      role: "customer"
    };
    store.users.push(user);

    // 2. Login to get valid JWT accessToken
    const loginRes = await request(app)
      .post("/api/login")
      .send({ emailId: "skincare@sole.com", password: "SkincarePass123!" });

    assert.equal(loginRes.status, 200);
    userToken = loginRes.body.accessToken;
    assert.ok(userToken);

    // 3. Create products in store
    productA = {
      _id: new mongoose.Types.ObjectId(),
      productName: "Vitamin Mask",
      productPrice: 97.0,
      originalPrice: 104.0,
      quantity: 5,
      category: "Mask",
      size: "50 ml"
    };
    productB = {
      _id: new mongoose.Types.ObjectId(),
      productName: "Vitamin Softening Cream",
      productPrice: 72.0,
      originalPrice: null,
      quantity: 10,
      category: "Cream",
      size: "50 ml"
    };
    store.products.push(productA, productB);
  });

  // -------------------------------------------------------------
  // 1. AUTHENTICATION REQUIRED
  // -------------------------------------------------------------
  test("GET /api/cart: requires authentication and rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/cart");
    assert.equal(res.status, 401);
  });

  // -------------------------------------------------------------
  // 2. GET CART (EMPTY INITIALLY)
  // -------------------------------------------------------------
  test("GET /api/cart: returns empty cart structure for new user", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
    assert.equal(res.body.subtotal, 0);
    assert.equal(res.body.totalItems, 0);
  });

  // -------------------------------------------------------------
  // 3. POST /api/cart/items (ADD SINGLE ITEM & CLAMP TO STOCK)
  // -------------------------------------------------------------
  test("POST /api/cart/items: adds product to cart and clamps to available live stock", async () => {
    // Attempt to add 8 units when stock is only 5
    const res = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId: productA._id.toString(), quantity: 8 });

    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    const item = res.body.items[0];
    assert.equal(item.productId.toString(), productA._id.toString());
    assert.equal(item.productName, "Vitamin Mask");
    assert.equal(item.cartQty, 5, "Quantity must be clamped to live stock (5)");
    assert.equal(item.productPrice, 97.0);
    assert.equal(res.body.subtotal, 97.0 * 5);
    assert.equal(res.body.totalItems, 5);
  });

  // -------------------------------------------------------------
  // 4. POST /api/cart/items (BATCH MERGE GUEST ITEMS ON LOGIN)
  // -------------------------------------------------------------
  test("POST /api/cart/items: supports batch merging items from guest sessions", async () => {
    const res = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        items: [
          { productId: productA._id.toString(), quantity: 2 },
          { productId: productB._id.toString(), quantity: 3 }
        ]
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 2);
    assert.equal(res.body.totalItems, 5);
    assert.equal(res.body.subtotal, 2 * 97.0 + 3 * 72.0);
  });

  // -------------------------------------------------------------
  // 5. PUT /api/cart/items/:productId (UPDATE QUANTITY)
  // -------------------------------------------------------------
  test("PUT /api/cart/items/:productId: updates quantity and respects live stock bounds", async () => {
    // Seed cart with 2 of productB
    await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId: productB._id.toString(), quantity: 2 });

    // Update to 7
    const updateRes = await request(app)
      .put(`/api/cart/items/${productB._id.toString()}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ quantity: 7 });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.items[0].cartQty, 7);
    assert.equal(updateRes.body.subtotal, 7 * 72.0);

    // Update to 0 removes the item
    const removeRes = await request(app)
      .put(`/api/cart/items/${productB._id.toString()}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ quantity: 0 });

    assert.equal(removeRes.status, 200);
    assert.equal(removeRes.body.items.length, 0);
  });

  // -------------------------------------------------------------
  // 6. DELETE /api/cart/items/:productId (REMOVE SPECIFIC ITEM)
  // -------------------------------------------------------------
  test("DELETE /api/cart/items/:productId: removes specified item from cart", async () => {
    // Add both products
    await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        items: [
          { productId: productA._id.toString(), quantity: 1 },
          { productId: productB._id.toString(), quantity: 1 }
        ]
      });

    // Delete productA
    const delRes = await request(app)
      .delete(`/api/cart/items/${productA._id.toString()}`)
      .set("Authorization", `Bearer ${userToken}`);

    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.items.length, 1);
    assert.equal(delRes.body.items[0].productId.toString(), productB._id.toString());
  });

  // -------------------------------------------------------------
  // 7. DELETE /api/cart (CLEAR ENTIRE CART)
  // -------------------------------------------------------------
  test("DELETE /api/cart: empties all items in the user cart", async () => {
    await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId: productA._id.toString(), quantity: 2 });

    const clearRes = await request(app)
      .delete("/api/cart")
      .set("Authorization", `Bearer ${userToken}`);

    assert.equal(clearRes.status, 200);
    assert.deepEqual(clearRes.body.items, []);
    assert.equal(clearRes.body.subtotal, 0);
    assert.equal(clearRes.body.totalItems, 0);
  });

  // -------------------------------------------------------------
  // 8. ORDER PLACEMENT EMPTIES CART IN DB
  // -------------------------------------------------------------
  test("POST /api/orders: placing an order automatically clears cloud cart in DB", async () => {
    // Add item to cart
    await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId: productA._id.toString(), quantity: 1 });

    // Place order
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        userId: userId.toString(),
        items: [{ productId: productA._id.toString(), quantity: 1 }]
      });

    assert.equal(orderRes.status, 201);

    // Verify cart is now empty
    const cartRes = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${userToken}`);

    assert.equal(cartRes.status, 200);
    assert.deepEqual(cartRes.body.items, []);
  });
});

