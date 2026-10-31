// Set environment to test before importing configs or app
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secure_access_secret_32_characters";
process.env.JWT_REFRESH_SECRET = "test_super_secure_refresh_secret_32_characters";
process.env.CUSTOM_DNS = "false";

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const { setupMockDatabase, resetDb, store } = require("./testHarness");
setupMockDatabase();

const { app } = require("../controller");
const config = require("../config/env");
const { hashPassword } = require("../services/authService");

describe("Backend Security & Authentication Test Suite", () => {
  beforeEach(() => {
    resetDb();
  });

  // -------------------------------------------------------------
  // 1. REGISTRATION SUCCESS
  // -------------------------------------------------------------
  test("1. Registration Success: creates user with hashed password and customer role", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({
        username: "Alice",
        emailId: "alice@example.com",
        age: 26,
        password: "StrongPassword123!"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Registration successful");
    assert.equal(res.body.username, "Alice");
    assert.ok(res.body.userId, "userId must be present in response");

    // Verify stored user in database
    const savedUser = store.users.find((u) => u.emailId === "alice@example.com");
    assert.ok(savedUser);
    assert.equal(savedUser.role, "customer");
    assert.notEqual(savedUser.password, "StrongPassword123!");
    assert.ok(savedUser.password.startsWith("$2a$") || savedUser.password.startsWith("$2b$"));
  });

  // -------------------------------------------------------------
  // 2. DUPLICATE REGISTRATION
  // -------------------------------------------------------------
  test("2. Duplicate Registration: rejects duplicate emails with 409 Conflict", async () => {
    // First registration
    await request(app)
      .post("/api/users")
      .send({
        username: "Alice",
        emailId: "alice@example.com",
        age: 26,
        password: "StrongPassword123!"
      });

    // Duplicate registration (case-insensitive test)
    const duplicateRes = await request(app)
      .post("/api/users")
      .send({
        username: "Alice Duplicate",
        emailId: "ALICE@EXAMPLE.COM",
        age: 30,
        password: "AnotherPassword123!"
      });

    assert.equal(duplicateRes.status, 409);
    assert.equal(duplicateRes.body.message, "Email already registered");
  });

  // -------------------------------------------------------------
  // 3. INVALID REGISTRATION
  // -------------------------------------------------------------
  test("3. Invalid Registration: rejects weak passwords, bad emails, and unallowlisted fields", async () => {
    // Short password (< 8 chars)
    const weakPassRes = await request(app)
      .post("/api/users")
      .send({
        username: "Bob",
        emailId: "bob@example.com",
        age: 22,
        password: "short"
      });
    assert.equal(weakPassRes.status, 400);
    assert.equal(weakPassRes.body.message, "Validation failed");

    // Invalid email format
    const badEmailRes = await request(app)
      .post("/api/users")
      .send({
        username: "Bob",
        emailId: "not-an-email",
        age: 22,
        password: "ValidPassword123!"
      });
    assert.equal(badEmailRes.status, 400);

    // Invalid age (< 1)
    const badAgeRes = await request(app)
      .post("/api/users")
      .send({
        username: "Bob",
        emailId: "bob@example.com",
        age: -5,
        password: "ValidPassword123!"
      });
    assert.equal(badAgeRes.status, 400);

    // Role escalation attempt (trying to inject role: admin via registration)
    const roleEscalationRes = await request(app)
      .post("/api/users")
      .send({
        username: "HackerBob",
        emailId: "hacker@example.com",
        age: 30,
        password: "ValidPassword123!",
        role: "admin"
      });
    assert.equal(roleEscalationRes.status, 400);
  });

  // -------------------------------------------------------------
  // 4. LOGIN SUCCESS
  // -------------------------------------------------------------
  test("4. Login Success: returns short-lived JWT, refresh token, and sets httpOnly cookies", async () => {
    // Seed user
    const passwordHash = await hashPassword("MySecretPass123!");
    store.users.push({
      _id: new mongoose.Types.ObjectId(),
      username: "Carol",
      emailId: "carol@example.com",
      age: 28,
      password: passwordHash,
      role: "customer"
    });

    const res = await request(app)
      .post("/api/login")
      .send({
        emailId: "carol@example.com",
        password: "MySecretPass123!"
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Login successful");
    assert.ok(res.body.accessToken, "accessToken must be present");
    assert.ok(res.body.refreshToken, "refreshToken must be present");
    assert.equal(res.body.username, "Carol");
    assert.equal(res.body.role, "customer");

    // Check Set-Cookie headers
    const cookies = res.headers["set-cookie"];
    assert.ok(cookies && cookies.length > 0, "Cookies must be set");
    const hasHttpOnly = cookies.some((c) => c.includes("HttpOnly"));
    assert.ok(hasHttpOnly, "Cookie must have HttpOnly flag");

    // Verify token can be verified
    const decoded = jwt.verify(res.body.accessToken, config.JWT_ACCESS_SECRET);
    assert.equal(decoded.username, "Carol");
    assert.equal(decoded.emailId, "carol@example.com");
  });

  // -------------------------------------------------------------
  // 5. WRONG CREDENTIALS
  // -------------------------------------------------------------
  test("5. Wrong Credentials: responds with 401 and generic message for bad password and unknown email", async () => {
    const passwordHash = await hashPassword("CorrectPassword123!");
    store.users.push({
      _id: new mongoose.Types.ObjectId(),
      username: "David",
      emailId: "david@example.com",
      age: 35,
      password: passwordHash,
      role: "customer"
    });

    // Wrong password
    const wrongPassRes = await request(app)
      .post("/api/login")
      .send({
        emailId: "david@example.com",
        password: "WrongPassword999!"
      });
    assert.equal(wrongPassRes.status, 401);
    assert.equal(wrongPassRes.body.message, "Invalid email or password");

    // Non-existent email
    const unknownEmailRes = await request(app)
      .post("/api/login")
      .send({
        emailId: "unknown@example.com",
        password: "CorrectPassword123!"
      });
    assert.equal(unknownEmailRes.status, 401);
    assert.equal(unknownEmailRes.body.message, "Invalid email or password");
  });

  // -------------------------------------------------------------
  // 6. MISSING, INVALID, AND EXPIRED CREDENTIALS
  // -------------------------------------------------------------
  test("6. Missing, Invalid, and Expired Credentials: protected endpoints reject unauthenticated calls", async () => {
    // Missing credentials
    const missingRes = await request(app).get("/api/users/me");
    assert.equal(missingRes.status, 401);
    assert.match(missingRes.body.message, /Authentication required/i);

    // Invalid format
    const invalidRes = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer invalid-jwt-garbage");
    assert.equal(invalidRes.status, 401);
    assert.match(invalidRes.body.message, /Invalid or malformed/i);

    // Expired token
    const expiredToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), username: "OldUser", role: "customer" },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "-10s" }
    );
    const expiredRes = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${expiredToken}`);
    assert.equal(expiredRes.status, 401);
    assert.equal(expiredRes.body.code, "TOKEN_EXPIRED");
  });

  // -------------------------------------------------------------
  // 7. CUSTOMER ACCESSING ADMIN ENDPOINTS
  // -------------------------------------------------------------
  test("7. RBAC: Customer cannot access admin endpoints; Admin can access", async () => {
    const customerId = new mongoose.Types.ObjectId();
    const customerToken = jwt.sign(
      { id: customerId.toString(), username: "RegularCustomer", role: "customer" },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    const adminId = new mongoose.Types.ObjectId();
    const adminToken = jwt.sign(
      { id: adminId.toString(), username: "SuperAdmin", role: "admin" },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    // Customer attempts GET /api/admin/users
    const customerAdminRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(customerAdminRes.status, 403);
    assert.match(customerAdminRes.body.message, /insufficient permissions/i);

    // Customer attempts POST /api/products (admin product creation)
    const customerCreateProductRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        productName: "Unauthorized Product",
        productPrice: 100,
        quantity: 10
      });
    assert.equal(customerCreateProductRes.status, 403);

    // Admin attempts GET /api/admin/users
    const adminRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminRes.status, 200);

    // Admin creates product
    const adminCreateProductRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productName: "Authorized Admin Product",
        productPrice: 199,
        quantity: 50
      });
    assert.equal(adminCreateProductRes.status, 201);
  });

  // -------------------------------------------------------------
  // 8. NOSQL INJECTION ATTEMPTS
  // -------------------------------------------------------------
  test("8. NoSQL Injection Prevention: strips dangerous operators and rejects payload attacks", async () => {
    // Attempt login with NoSQL operator object: { "emailId": { "$ne": null } }
    const injectionLoginRes = await request(app)
      .post("/api/login")
      .send({
        emailId: { $ne: null },
        password: "any"
      });

    // Sanitizer strips keys starting with $, or Zod rejects non-string
    assert.notEqual(injectionLoginRes.status, 200, "NoSQL injection must never result in login");
    assert.ok([400, 401].includes(injectionLoginRes.status));

    // Registration with operator injection
    const injectionRegRes = await request(app)
      .post("/api/users")
      .send({
        username: "Attacker",
        emailId: { $gt: "" },
        age: 25,
        password: "ValidPassword123!"
      });
    assert.equal(injectionRegRes.status, 400);
  });

  // -------------------------------------------------------------
  // 9. REQUEST VALIDATION & MALFORMED OBJECTIDS
  // -------------------------------------------------------------
  test("9. Request Validation: handles malformed ObjectIds and invalid checkout data safely", async () => {
    const userToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), username: "Tester", role: "customer" },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    // Malformed ObjectId in URL parameter /api/orders/:id
    const badIdRes = await request(app)
      .get("/api/orders/not-a-valid-mongo-id")
      .set("Authorization", `Bearer ${userToken}`);
    assert.equal(badIdRes.status, 400);
    assert.match(badIdRes.body.message, /Validation failed/i);

    // Order checkout with empty items
    const emptyOrderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        items: []
      });
    assert.equal(emptyOrderRes.status, 400);

    // Order checkout with invalid quantity (< 1)
    const badQtyRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        items: [
          {
            productId: new mongoose.Types.ObjectId().toString(),
            quantity: 0
          }
        ]
      });
    assert.equal(badQtyRes.status, 400);
  });

  // -------------------------------------------------------------
  // 10. RATE LIMITING
  // -------------------------------------------------------------
  test("10. Rate Limiting: authLimiter triggers 429 Too Many Requests after threshold", async () => {
    const email = "ratelimit_test@example.com";

    // Test environment threshold is set to 5 attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/login")
        .set("x-test-rate-limit", "true")
        .send({ emailId: email, password: "wrong" });
    }

    // 6th attempt should be blocked with 429
    const blockedRes = await request(app)
      .post("/api/login")
      .set("x-test-rate-limit", "true")
      .send({ emailId: email, password: "wrong" });

    assert.equal(blockedRes.status, 429);
    assert.match(blockedRes.body.message, /Too many authentication attempts/i);
  });

  // -------------------------------------------------------------
  // 11. SENSITIVE FIELD EXPOSURE & IDOR PROTECTION
  // -------------------------------------------------------------
  test("11. Sensitive Field Exposure & IDOR: password hashes are never exposed; identity spoofing rejected", async () => {
    const userAId = new mongoose.Types.ObjectId();
    const userBId = new mongoose.Types.ObjectId();

    const passwordHash = await hashPassword("SecretA123!");
    store.users.push({
      _id: userAId,
      username: "UserA",
      emailId: "usera@example.com",
      age: 24,
      password: passwordHash,
      role: "customer"
    });

    const tokenA = jwt.sign(
      { id: userAId.toString(), username: "UserA", role: "customer" },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    // Check GET /api/users/me never exposes password or token hashes
    const meRes = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenA}`);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.password, undefined);
    assert.equal(meRes.body.passwordResetToken, undefined);
    assert.equal(meRes.body.verificationToken, undefined);

    // IDOR check: UserA attempts to checkout pretending to be UserB by sending userId: userBId
    const seedProduct = {
      _id: new mongoose.Types.ObjectId(),
      productName: "Test Gadget",
      productPrice: 50,
      quantity: 10
    };
    store.products.push(seedProduct);

    const spoofOrderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        userId: userBId.toString(), // Spoofed userId in body!
        items: [
          {
            productId: seedProduct._id.toString(),
            quantity: 1
          }
        ]
      });

    // Server must reject mismatch with 403 Forbidden
    assert.equal(spoofOrderRes.status, 403);
    assert.match(spoofOrderRes.body.message, /cannot create orders for another user/i);

    // When UserA places order legitimately without spoofing:
    const legitOrderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        items: [
          {
            productId: seedProduct._id.toString(),
            quantity: 1
          }
        ]
      });

    assert.equal(legitOrderRes.status, 201);
    const createdOrder = store.orders[0];
    assert.equal(createdOrder.userId.toString(), userAId.toString());
  });
});
