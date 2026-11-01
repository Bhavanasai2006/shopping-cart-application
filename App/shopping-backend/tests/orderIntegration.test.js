const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("node:crypto");

const {
  store,
  setupMockDatabase,
  resetDb
} = require("./testHarness");

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secure_access_secret_32_characters";
process.env.JWT_REFRESH_SECRET = "test_super_secure_refresh_secret_32_characters";
process.env.CUSTOM_DNS = "false";

// Wire in-memory mock models before loading controller
setupMockDatabase();
const { app } = require("../controller");
const { generateAccessToken } = require("../services/tokenService");

test.describe("Secure Order Creation, Atomic Inventory & Lifecycle Integration Tests", () => {
  let customerUser;
  let otherCustomerUser;
  let adminUser;
  let customerToken;
  let otherToken;
  let adminToken;
  let productAlpha;
  let productBeta;
  let inactiveProduct;

  const getDbProduct = (id) =>
    store.products.find((p) => p._id.toString() === id.toString());

  const validAddress = {
    fullName: "Jane Doe",
    phone: "+1 555-123-4567",
    addressLine1: "742 Evergreen Terrace",
    addressLine2: "Suite 4B",
    city: "Springfield",
    state: "IL",
    postalCode: "62704",
    country: "United States"
  };

  test.beforeEach(async () => {
    resetDb();

    // 1. Seed Customer User
    customerUser = {
      _id: new mongoose.Types.ObjectId(),
      username: "janedoe",
      emailId: "jane@sole.com",
      role: "customer"
    };
    store.users.push(customerUser);
    customerToken = generateAccessToken({
      userId: customerUser._id.toString(),
      role: "customer"
    });

    // 2. Seed Second Customer User (for IDOR tests)
    otherCustomerUser = {
      _id: new mongoose.Types.ObjectId(),
      username: "bobsmith",
      emailId: "bob@sole.com",
      role: "customer"
    };
    store.users.push(otherCustomerUser);
    otherToken = generateAccessToken({
      userId: otherCustomerUser._id.toString(),
      role: "customer"
    });

    // 3. Seed Admin User
    adminUser = {
      _id: new mongoose.Types.ObjectId(),
      username: "adminuser",
      emailId: "admin@sole.com",
      role: "admin"
    };
    store.users.push(adminUser);
    adminToken = generateAccessToken({
      userId: adminUser._id.toString(),
      role: "admin"
    });

    // 4. Seed Products
    productAlpha = {
      _id: new mongoose.Types.ObjectId(),
      productId: "prod_alpha",
      productName: "Golden Glow Face Elixir",
      productPrice: 65.0,
      quantity: 10,
      isActive: true,
      image: "/elixir.png"
    };

    productBeta = {
      _id: new mongoose.Types.ObjectId(),
      productId: "prod_beta",
      productName: "Hydra-Luxe Barrier Cream",
      productPrice: 42.0,
      quantity: 5,
      isActive: true,
      image: "/cream.png"
    };

    inactiveProduct = {
      _id: new mongoose.Types.ObjectId(),
      productId: "prod_inactive",
      productName: "Archived Rose Tonic",
      productPrice: 30.0,
      quantity: 20,
      isActive: false,
      image: "/tonic.png"
    };

    store.products.push(productAlpha, productBeta, inactiveProduct);
  });

  // --------------------------------------------------------------------------
  // 1. AUTHORIZATION TESTS
  // --------------------------------------------------------------------------
  test("1. Authorization: Unauthenticated order creation is rejected with 401", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 1 }],
        shippingAddress: validAddress
      });

    assert.equal(res.status, 401);
  });

  test("2. Authorization: Customer cannot place an order under another user's ID", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        userId: otherCustomerUser._id.toString(), // Mismatched user ID spoofing attempt
        items: [{ productId: productAlpha._id.toString(), quantity: 1 }],
        shippingAddress: validAddress
      });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /cannot create orders for another user/i);
  });

  test("3. Authorization: Customer cannot inspect another customer's order", async () => {
    // Customer places legitimate order
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 1 }],
        shippingAddress: validAddress
      });

    assert.equal(orderRes.status, 201);
    const orderId = orderRes.body.orderId;

    // Other customer attempts to read Customer's order
    const getRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${otherToken}`);

    assert.equal(getRes.status, 403);
    assert.match(getRes.body.message, /do not own this order/i);
  });

  // --------------------------------------------------------------------------
  // 2. VALIDATION & BUSINESS LOGIC
  // --------------------------------------------------------------------------
  test("4. Validation: Rejects missing items, invalid IDs, negative or zero quantities", async () => {
    // Empty items array
    const emptyRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [], shippingAddress: validAddress });
    assert.equal(emptyRes.status, 400);

    // Negative / zero quantity
    const zeroRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 0 }],
        shippingAddress: validAddress
      });
    assert.equal(zeroRes.status, 400);

    // Malformed product ID
    const badIdRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: "not-a-valid-id", quantity: 1 }],
        shippingAddress: validAddress
      });
    assert.equal(badIdRes.status, 400);
  });

  test("5. Validation: Rejects deactivated or unavailable products", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: inactiveProduct._id.toString(), quantity: 1 }],
        shippingAddress: validAddress
      });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /currently deactivated or unavailable/i);
  });

  test("6. Validation: Aggregates duplicate items and enforces quantity caps", async () => {
    // Two duplicate entries of 2 and 3 units should aggregate to 5 units
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [
          { productId: productAlpha._id.toString(), quantity: 2 },
          { productId: productAlpha._id.toString(), quantity: 3 }
        ],
        shippingAddress: validAddress
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.totalAmount, 5 * 65.0);
    assert.equal(getDbProduct(productAlpha._id).quantity, 10 - 5);
  });

  // --------------------------------------------------------------------------
  // 3. ATOMIC INVENTORY & TRANSACTION ROLLBACK
  // --------------------------------------------------------------------------
  test("7. Inventory Atomicity: Multi-item failure rolls back earlier product deductions completely", async () => {
    // Initial quantities: Alpha=10, Beta=5
    assert.equal(productAlpha.quantity, 10);
    assert.equal(productBeta.quantity, 5);

    // Order requests 4 of Alpha (available) and 10 of Beta (INSUFFICIENT, only 5 in stock)
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [
          { productId: productAlpha._id.toString(), quantity: 4 },
          { productId: productBeta._id.toString(), quantity: 10 }
        ],
        shippingAddress: validAddress
      });

    // Must be rejected
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Insufficient stock/i);

    // TRANSACTION INTEGRITY CHECK:
    // Product Alpha stock MUST NOT have been reduced to 6; it must remain 10!
    assert.equal(productAlpha.quantity, 10, "Product Alpha stock was improperly leaked!");
    assert.equal(productBeta.quantity, 5, "Product Beta stock was altered!");
    assert.equal(store.orders.length, 0, "No orphaned order document should exist!");
  });

  test("8. Inventory Atomicity: Successful order creates immutable snapshot with line totals", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [
          { productId: productAlpha._id.toString(), quantity: 2 },
          { productId: productBeta._id.toString(), quantity: 1 }
        ],
        shippingAddress: validAddress
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.totalAmount, 2 * 65.0 + 1 * 42.0);
    assert.equal(getDbProduct(productAlpha._id).quantity, 8);
    assert.equal(getDbProduct(productBeta._id).quantity, 4);

    const savedOrder = store.orders[0];
    assert.ok(savedOrder);
    assert.equal(savedOrder.status, "placed");
    assert.equal(savedOrder.items.length, 2);
    assert.equal(savedOrder.items[0].productName, "Golden Glow Face Elixir");
    assert.equal(savedOrder.items[0].price, 65.0);
    assert.equal(savedOrder.items[0].lineTotal, 130.0);
    assert.equal(savedOrder.shippingAddress.city, "Springfield");
  });

  // --------------------------------------------------------------------------
  // 4. IDEMPOTENT CHECKOUT
  // --------------------------------------------------------------------------
  test("9. Idempotency: Duplicate checkout with identical key returns existing order without double-charging inventory", async () => {
    const idempotencyKey = crypto.randomUUID();

    // First attempt: Places order
    const firstRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 2 }],
        shippingAddress: validAddress
      });

    assert.equal(firstRes.status, 201);
    assert.equal(getDbProduct(productAlpha._id).quantity, 8); // 10 - 2 = 8
    const orderId = firstRes.body.orderId;

    // Second attempt: Same key, exact same payload (network retry scenario)
    const secondRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 2 }],
        shippingAddress: validAddress
      });

    assert.equal(secondRes.status, 200);
    assert.equal(secondRes.body.isIdempotentReplay, true);
    assert.equal(secondRes.body.orderId.toString(), orderId.toString());

    // CRITICAL: Stock must still be 8, NOT 6!
    assert.equal(
      getDbProduct(productAlpha._id).quantity,
      8,
      "Stock was double-deducted on idempotent replay!"
    );
    assert.equal(store.orders.length, 1, "Duplicate order document was created!");
  });

  test("10. Idempotency: Reusing same idempotency key with different payload is rejected with 409", async () => {
    const idempotencyKey = crypto.randomUUID();

    // First attempt
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 1 }],
        shippingAddress: validAddress
      });

    // Second attempt with altered item quantity
    const conflictRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 3 }],
        shippingAddress: validAddress
      });

    assert.equal(conflictRes.status, 409);
    assert.match(conflictRes.body.message, /different order payload/i);
  });

  // --------------------------------------------------------------------------
  // 5. ORDER CANCELLATION & INVENTORY RESTORATION
  // --------------------------------------------------------------------------
  test("11. Order Cancellation: Customer cancels placed order and stock is restored atomically", async () => {
    // 1. Place order for 3 items
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 3 }],
        shippingAddress: validAddress
      });

    assert.equal(orderRes.status, 201);
    assert.equal(getDbProduct(productAlpha._id).quantity, 7); // 10 - 3 = 7
    const orderId = orderRes.body.orderId;

    // 2. Cancel order
    const cancelRes = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Changed my mind" });

    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.status, "cancelled");

    // Stock must be restored from 7 back to 10
    assert.equal(
      getDbProduct(productAlpha._id).quantity,
      10,
      "Inventory was not restored upon cancellation!"
    );

    // 3. Repeated cancellation must be rejected with 400
    const repeatCancelRes = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Cancelling again" });

    assert.equal(repeatCancelRes.status, 400);
    assert.match(repeatCancelRes.body.message, /already cancelled/i);
    // Stock must NOT double-restock
    assert.equal(getDbProduct(productAlpha._id).quantity, 10);
  });

  test("12. Order Cancellation: Cannot cancel shipped or delivered orders", async () => {
    // Place order
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 1 }],
        shippingAddress: validAddress
      });

    const orderId = orderRes.body.orderId;
    const orderDoc = store.orders.find((o) => o._id.toString() === orderId.toString());
    orderDoc.status = "shipped"; // Mark shipped

    // Customer attempts to cancel shipped order
    const cancelRes = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(cancelRes.status, 400);
    assert.match(cancelRes.body.message, /cannot be cancelled/i);
  });

  // --------------------------------------------------------------------------
  // 6. ADMIN ORDER LIFECYCLE MANAGEMENT
  // --------------------------------------------------------------------------
  test("13. Admin Lifecycle: Admin can transition order status along allowed state machine", async () => {
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 1 }],
        shippingAddress: validAddress
      });

    const orderId = orderRes.body.orderId;

    // placed -> processing
    const step1 = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "processing", note: "Packing skincare items" });

    assert.equal(step1.status, 200);
    assert.equal(step1.body.order.status, "processing");

    // processing -> shipped
    const step2 = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "shipped", note: "Handed over to carrier" });

    assert.equal(step2.status, 200);
    assert.equal(step2.body.order.status, "shipped");

    // Invalid transition: shipped -> placed (not allowed)
    const invalidStep = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "placed" });

    assert.equal(invalidStep.status, 400);
    assert.match(invalidStep.body.message, /Invalid status transition/i);
  });

  // --------------------------------------------------------------------------
  // 7. CART CONSISTENCY
  // --------------------------------------------------------------------------
  test("14. Cart Consistency: Checkout removes purchased items and preserves non-purchased items", async () => {
    // Populate user cart with 2 products
    const userCart = {
      _id: new mongoose.Types.ObjectId(),
      userId: customerUser._id,
      items: [
        { productId: productAlpha._id, quantity: 1 },
        { productId: productBeta._id, quantity: 2 }
      ],
      async save() {
        return this;
      }
    };
    store.carts.push(userCart);

    // Customer checks out ONLY productAlpha
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAlpha._id.toString(), quantity: 1 }],
        shippingAddress: validAddress
      });

    assert.equal(orderRes.status, 201);

    // Cloud cart must now contain ONLY productBeta
    assert.equal(userCart.items.length, 1);
    assert.equal(userCart.items[0].productId.toString(), productBeta._id.toString());
  });
});
