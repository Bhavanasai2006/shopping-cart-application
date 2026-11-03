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

test.describe("DEMO Payment System Integration Tests", () => {
  let customerUser;
  let customerToken;
  let productSerum;
  let productCream;

  const validAddress = {
    fullName: "Elena Rostova",
    phone: "+1 555-019-2834",
    addressLine1: "100 Blossom Way",
    addressLine2: "Apt 2A",
    city: "San Francisco",
    state: "CA",
    postalCode: "94107",
    country: "United States"
  };

  test.beforeEach(async () => {
    resetDb();

    // 1. Seed Customer User
    customerUser = {
      _id: new mongoose.Types.ObjectId(),
      username: "elenaskincare",
      emailId: "elena@sole.com",
      role: "customer"
    };
    store.users.push(customerUser);
    customerToken = generateAccessToken({
      userId: customerUser._id.toString(),
      role: "customer"
    });

    // 2. Seed Products
    productSerum = {
      _id: new mongoose.Types.ObjectId(),
      productId: "prod_serum",
      productName: "SOLE Vitamin C Radiant Serum",
      productPrice: 65.0,
      quantity: 15,
      isActive: true,
      image: "/serum.png"
    };
    productCream = {
      _id: new mongoose.Types.ObjectId(),
      productId: "prod_cream",
      productName: "SOLE Barrier Moisture Cream",
      productPrice: 50.0,
      quantity: 10,
      isActive: true,
      image: "/cream.png"
    };
    store.products.push(productSerum, productCream);

    // 3. Seed User Cart
    store.carts.push({
      _id: new mongoose.Types.ObjectId(),
      userId: customerUser._id,
      items: [
        { productId: productSerum._id, quantity: 2 },
        { productId: productCream._id, quantity: 1 }
      ]
    });
  });

  test("1. DEMO_CARD: Successfully places order with simulated card, authoritative totals, and stock deduction", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [
          { productId: productSerum._id.toString(), quantity: 2 },
          { productId: productCream._id.toString(), quantity: 1 }
        ],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_CARD",
        demoAccount: "Demo Visa ending in 4242"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.isDemoPayment, true);
    assert.equal(res.body.paymentMethod, "DEMO_CARD");
    assert.equal(res.body.paymentStatus, "demo_completed");
    assert.equal(res.body.totalAmount, 180.0); // (65 * 2) + (50 * 1) = 180
    assert.ok(res.body.paymentSimulation.transactionId.startsWith("DEMO_TXN_"));
    assert.equal(
      res.body.paymentSimulation.disclaimer,
      "DEMO PAYMENT — No real money is transferred."
    );

    // Verify stock decreased atomically
    const serumInDb = store.products.find((p) => p._id.toString() === productSerum._id.toString());
    const creamInDb = store.products.find((p) => p._id.toString() === productCream._id.toString());
    assert.equal(serumInDb.quantity, 13); // 15 - 2
    assert.equal(creamInDb.quantity, 9);  // 10 - 1
  });

  test("2. DEMO_UPI: Successfully places order with simulated UPI handle", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 1 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_UPI",
        demoAccount: "elena@demoupi"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.isDemoPayment, true);
    assert.equal(res.body.paymentMethod, "DEMO_UPI");
    assert.equal(res.body.paymentStatus, "demo_completed");
    assert.equal(res.body.paymentSimulation.simulatedAccount, "elena@demoupi");
  });

  test("3. DEMO_COD: Cash on delivery marks paymentStatus as demo_pending", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productCream._id.toString(), quantity: 1 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_COD"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.paymentMethod, "DEMO_COD");
    assert.equal(res.body.paymentStatus, "demo_pending");
    assert.equal(res.body.isDemoPayment, true);
  });

  test("4. Payment Simulation Failure: Returns 402, creates NO order, and leaves inventory untouched", async () => {
    const initialSerumQty = productSerum.quantity;

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 3 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_CARD",
        simulateFailure: true
      });

    assert.equal(res.status, 402);
    assert.equal(res.body.paymentStatus, "demo_failed");
    assert.equal(res.body.isDemoPayment, true);
    assert.equal(res.body.canRetry, true);

    // Verify NO order was created
    assert.equal(store.orders.length, 0);

    // Verify inventory was NOT deducted
    const serumInDb = store.products.find((p) => p._id.toString() === productSerum._id.toString());
    assert.equal(serumInDb.quantity, initialSerumQty);
  });

  test("5. Safe Retry: Immediate retry with simulated success places order cleanly", async () => {
    // First attempt: simulate failure
    const failRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 2 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_CARD",
        simulateFailure: true
      });
    assert.equal(failRes.status, 402);

    // Second attempt: retry with success
    const retryRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 2 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_CARD",
        simulateFailure: false
      });
    assert.equal(retryRes.status, 201);
    assert.equal(store.orders.length, 1);
    assert.equal(store.products.find((p) => p._id.toString() === productSerum._id.toString()).quantity, 13);
  });

  test("6. Security: Rejects submission of real credit card / PIN / CVV credentials with 400", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 1 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_CARD",
        cvv: "123", // Prohibited real financial credential
        cardNumber: "4111111111111111"
      });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Real financial credentials/i);
    assert.equal(store.orders.length, 0);
  });

  test("7. Security: Rejects invalid or fake non-demo payment methods", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 1 }],
        shippingAddress: validAddress,
        paymentMethod: "REAL_CREDIT_CARD" // Invalid payment method
      });

    assert.equal(res.status, 400);
    assert.equal(store.orders.length, 0);
  });

  test("8. Idempotency: Duplicate checkout with identical key returns existing order without double inventory deduction", async () => {
    const idempotencyKey = "demo_order_idemp_key_12345678";

    const res1 = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 2 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_CARD",
        idempotencyKey
      });
    assert.equal(res1.status, 201);

    const res2 = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 2 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_CARD",
        idempotencyKey
      });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.isIdempotentReplay, true);

    // Only 1 order exists and stock deducted only once (15 - 2 = 13)
    assert.equal(store.orders.length, 1);
    assert.equal(store.products.find((p) => p._id.toString() === productSerum._id.toString()).quantity, 13);
  });

  test("9. Order Cancellation: Updates demo order paymentStatus to demo_refunded and restores stock", async () => {
    // 1. Create order
    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productSerum._id.toString(), quantity: 3 }],
        shippingAddress: validAddress,
        paymentMethod: "DEMO_CARD"
      });
    assert.equal(createRes.status, 201);
    const orderId = createRes.body.orderId;

    // 2. Cancel order
    const cancelRes = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Customer changed mind on demo order" });

    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.status, "cancelled");
    assert.equal(cancelRes.body.order.paymentStatus, "demo_refunded");

    // Verify stock restored back to 15
    const serumInDb = store.products.find((p) => p._id.toString() === productSerum._id.toString());
    assert.equal(serumInDb.quantity, 15);
  });
});

