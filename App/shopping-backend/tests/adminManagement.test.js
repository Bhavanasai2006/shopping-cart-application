const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const mongoose = require("mongoose");

// Force test environment
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secure_access_secret_32_characters";
process.env.JWT_REFRESH_SECRET = "test_super_secure_refresh_secret_32_characters";

const { setupMockDatabase, resetDb, store } = require("./testHarness");
setupMockDatabase();

const { app } = require("../controller");
const { User, Product, Order } = require("../schema");
const { hashPassword } = require("../services/authService");
const { generateAccessToken } = require("../services/tokenService");
const { provisionAdminAccount } = require("../scripts/provisionAdmin");

test.describe("Admin Management, RBAC & Product Lifecycle Integration Tests", () => {
  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let sampleProduct;

  test.beforeEach(async () => {
    resetDb();

    // 1. Create Customer
    customerUser = await User.create({
      username: "JaneCustomer",
      emailId: "jane.customer@sole-skincare.com",
      password: await hashPassword("CustomerSecret123!"),
      age: 26,
      role: "customer",
      emailVerified: true
    });
    customerToken = generateAccessToken(customerUser);

    // 2. Create Admin
    adminUser = await User.create({
      username: "SoleMasterAdmin",
      emailId: "admin.lead@sole-skincare.com",
      password: await hashPassword("AdminMasterKey2026!"),
      age: 34,
      role: "admin",
      emailVerified: true
    });
    adminToken = generateAccessToken(adminUser);

    // 3. Create Sample Skincare Product
    sampleProduct = await Product.create({
      productName: "Rose Water Hydrating Toner",
      subtitle: "Pure Organic Damask Rose Hydrosol",
      productPrice: 38,
      originalPrice: 45,
      category: "Toner",
      size: "150 ml",
      quantity: 15,
      description: "Soothes, balances pH and restores deep hydration.",
      howToUse: "Mist directly onto clean skin morning and evening.",
      ingredients: "Rosa Damascena Flower Water, Hyaluronic Acid, Aloe Vera.",
      isActive: true
    });
  });

  // -------------------------------------------------------------
  // SECTION 1: ADMIN PROVISIONING
  // -------------------------------------------------------------
  test("1. Admin Provisioning: Creates initial admin and prevents duplicate provisioning", async () => {
    // A. Provision a new administrator
    const newAdminEmail = "founder@sole-skincare.com";
    const provisionResult = await provisionAdminAccount({
      emailId: newAdminEmail,
      username: "Founder Admin",
      password: "FounderSecurePass2026!",
      age: 35
    });

    assert.strictEqual(provisionResult.created, true);
    assert.strictEqual(provisionResult.user.role, "admin");
    assert.strictEqual(provisionResult.user.emailId, newAdminEmail);
    assert.strictEqual(provisionResult.user.emailVerified, true);
    assert.notStrictEqual(provisionResult.user.password, "FounderSecurePass2026!");

    // Verify user is in DB
    const foundInDb = await User.findOne({ emailId: newAdminEmail });
    assert.ok(foundInDb);
    assert.strictEqual(foundInDb.role, "admin");

    // B. Attempt duplicate provisioning with same email - must refuse idempotently
    const duplicateResult = await provisionAdminAccount({
      emailId: newAdminEmail,
      username: "Duplicate Admin Attempt",
      password: "AnotherPassword123!",
      age: 40
    });

    assert.strictEqual(duplicateResult.created, false);
    assert.strictEqual(duplicateResult.elevated, false);
    assert.match(duplicateResult.message, /already exists/i);

    // C. Validation: Invalid email or short password rejected
    await assert.rejects(
      async () => {
        await provisionAdminAccount({
          emailId: "not-an-email",
          password: "ValidPassword123!"
        });
      },
      { message: /invalid email format/i }
    );

    await assert.rejects(
      async () => {
        await provisionAdminAccount({
          emailId: "valid@sole.com",
          password: "short"
        });
      },
      { message: /at least 8 characters/i }
    );
  });

  // -------------------------------------------------------------
  // SECTION 2: AUTHENTICATION & ROLE ESCALATION DEFENSE
  // -------------------------------------------------------------
  test("2. Role Escalation Prevention: Customers cannot escalate role through registration or profile updates", async () => {
    // A. Registration payload with role: 'admin' must be ignored or rejected
    const regRes = await request(app)
      .post("/api/users")
      .send({
        username: "HackerOne",
        emailId: "hacker@evil.com",
        age: 25,
        password: "ValidSecretPassword123!",
        role: "admin"
      });

    // Zod strict validation rejects unknown/unallowlisted fields
    assert.strictEqual(regRes.status, 400);

    // B. Profile update with role: 'admin' must not change role
    const updateRes = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        username: "JaneUpdated",
        role: "admin"
      });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.user.role, "customer");

    const refreshedUser = await User.findById(customerUser._id);
    assert.strictEqual(refreshedUser.role, "customer");
  });

  test("3. RBAC Enforcement: Customer is strictly denied access to admin endpoints", async () => {
    // Unauthenticated -> 401
    const unauthRes = await request(app).get("/api/admin/products");
    assert.strictEqual(unauthRes.status, 401);

    // Customer -> 403 Forbidden
    const customerRes = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${customerToken}`);
    assert.strictEqual(customerRes.status, 403);

    // Admin -> 200 OK
    const adminRes = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(adminRes.status, 200);
  });

  // -------------------------------------------------------------
  // SECTION 3: PRODUCT MANAGEMENT (CRUD & VALIDATION)
  // -------------------------------------------------------------
  test("4. Admin Create Product: Enforces strict field validation and rejects invalid/negative inputs", async () => {
    // A. Valid Product Creation
    const createRes = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productName: "Ceramide Barrier Repair Creme",
        subtitle: "Deep Moisture Lipid Complex",
        productPrice: 64.5,
        originalPrice: 72.0,
        category: "Moisturizer",
        size: "50 ml",
        quantity: 20,
        description: "Rebuilds damaged skin barrier with phytoceramides.",
        howToUse: "Apply dime-sized amount morning and evening.",
        ingredients: "Ceramide NP, Squalane, Niacinamide, Glycerin.",
        isActive: true
      });

    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.product.productName, "Ceramide Barrier Repair Creme");
    assert.strictEqual(createRes.body.product.productPrice, 64.5);
    assert.strictEqual(createRes.body.product.quantity, 20);
    assert.strictEqual(createRes.body.product.isActive, true);

    // B. Negative Price Rejected
    const badPriceRes = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productName: "Faulty Cream",
        productPrice: -15,
        quantity: 10
      });
    assert.strictEqual(badPriceRes.status, 400);

    // C. Negative Quantity Rejected
    const badQtyRes = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productName: "Faulty Cream",
        productPrice: 30,
        quantity: -5
      });
    assert.strictEqual(badQtyRes.status, 400);

    // D. Missing Name Rejected
    const noNameRes = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productPrice: 30,
        quantity: 10
      });
    assert.strictEqual(noNameRes.status, 400);

    // E. Unallowlisted Fields Rejected (Mass-assignment protection)
    const massAssignRes = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productName: "Test Cream",
        productPrice: 30,
        quantity: 10,
        arbitraryInjectedField: "malicious"
      });
    assert.strictEqual(massAssignRes.status, 400);
  });

  test("5. Admin Edit Product: Updates allowlisted fields and verifies changes", async () => {
    const updateRes = await request(app)
      .patch(`/api/admin/products/${sampleProduct._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productPrice: 42,
        quantity: 35,
        subtitle: "Enhanced Hydrosol Formula"
      });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.product.productPrice, 42);
    assert.strictEqual(updateRes.body.product.quantity, 35);
    assert.strictEqual(updateRes.body.product.subtitle, "Enhanced Hydrosol Formula");
    // Unchanged field remains intact
    assert.strictEqual(updateRes.body.product.productName, "Rose Water Hydrating Toner");

    // Invalid ObjectId format handling
    const invalidIdRes = await request(app)
      .patch("/api/admin/products/invalid-object-id-123")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productPrice: 50 });
    assert.strictEqual(invalidIdRes.status, 400);
  });

  test("6. Product Soft-Deactivation: Deactivates product safely, hiding it from public catalog while preserving history", async () => {
    // 1. Deactivate product via DELETE
    const deleteRes = await request(app)
      .delete(`/api/admin/products/${sampleProduct._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.product.isActive, false);

    // 2. Public product catalog should NOT return the deactivated product
    const publicCatalogRes = await request(app).get("/api/products");
    assert.strictEqual(publicCatalogRes.status, 200);
    const publicList = Array.isArray(publicCatalogRes.body)
      ? publicCatalogRes.body
      : publicCatalogRes.body.products;
    const foundInPublic = publicList.some(
      (p) => p._id.toString() === sampleProduct._id.toString()
    );
    assert.strictEqual(foundInPublic, false, "Deactivated product must not appear in public catalog");

    // 3. Admin product catalog STILL lists it with isActive: false
    const adminCatalogRes = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.strictEqual(adminCatalogRes.status, 200);
    const adminList = adminCatalogRes.body.products;
    const foundInAdmin = adminList.find(
      (p) => p._id.toString() === sampleProduct._id.toString()
    );
    assert.ok(foundInAdmin);
    assert.strictEqual(foundInAdmin.isActive, false);

    // 4. Reactivate product
    const reactivateRes = await request(app)
      .post(`/api/admin/products/${sampleProduct._id}/reactivate`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.strictEqual(reactivateRes.status, 200);
    assert.strictEqual(reactivateRes.body.product.isActive, true);

    // 5. Verify product reappears in public catalog
    const refreshedPublicRes = await request(app).get("/api/products");
    const refreshedList = Array.isArray(refreshedPublicRes.body)
      ? refreshedPublicRes.body
      : refreshedPublicRes.body.products;
    assert.ok(
      refreshedList.some((p) => p._id.toString() === sampleProduct._id.toString()),
      "Reactivated product must reappear in public catalog"
    );
  });

  test("7. Admin Statistics & Orders Endpoints: Returns accurate store metrics and order logs", async () => {
    // Seed an order
    await Order.create({
      userId: customerUser._id,
      items: [
        {
          productId: sampleProduct._id,
          productName: sampleProduct.productName,
          price: 38,
          quantity: 2
        }
      ],
      totalAmount: 76
    });

    // A. Fetch Admin Stats
    const statsRes = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.strictEqual(statsRes.status, 200);
    assert.ok(statsRes.body.stats);
    assert.strictEqual(statsRes.body.stats.totalProducts >= 1, true);
    assert.strictEqual(statsRes.body.stats.totalOrders >= 1, true);
    assert.strictEqual(statsRes.body.stats.totalRevenue, 76);

    // B. Fetch Admin Orders
    const ordersRes = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.strictEqual(ordersRes.status, 200);
    assert.ok(Array.isArray(ordersRes.body));
    assert.strictEqual(ordersRes.body.length, 1);
    assert.strictEqual(ordersRes.body[0].totalAmount, 76);
  });
});
