process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secure_access_secret_32_characters";
process.env.JWT_REFRESH_SECRET = "test_super_secure_refresh_secret_32_characters";
process.env.CUSTOM_DNS = "false";

const http = require("node:http");
const stream = require("node:stream");
const mongoose = require("mongoose");
const assert = require("node:assert/strict");

const { setupMockDatabase, resetDb, store } = require("./testHarness");
setupMockDatabase();

const { app } = require("../controller");
const { generateAccessToken } = require("../services/tokenService");

function invokeRoute(method, path, { headers = {}, body = null } = {}) {
  return new Promise((resolve) => {
    const socket = new stream.Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      }
    });
    socket.remoteAddress = "127.0.0.1";

    const req = new http.IncomingMessage(socket);
    req.socket = socket;
    req.method = method.toUpperCase();
    req.url = path;
    req.originalUrl = path;
    req.headers = {
      host: "localhost:5000",
      ...headers
    };

    const res = new http.ServerResponse(req);
    let responseBody = "";

    res.write = function (chunk) {
      if (chunk) responseBody += chunk.toString();
      return true;
    };

    res.end = function (chunk) {
      if (chunk) responseBody += chunk.toString();
      let parsed = responseBody;
      try {
        parsed = JSON.parse(responseBody);
      } catch {
        // Raw text
      }
      resolve({ status: res.statusCode, body: parsed });
    };

    if (body) {
      const payload = typeof body === "string" ? body : JSON.stringify(body);
      req.headers["content-type"] = "application/json";
      req.headers["content-length"] = Buffer.byteLength(payload);
      app.handle(req, res);
      req.push(payload);
      req.push(null);
    } else {
      app.handle(req, res);
      req.push(null);
    }
  });
}

async function runCartTests() {
  console.log("===============================================================");
  console.log("Starting Cloud-Synchronized Skincare Cart API Verification Tests");
  console.log("===============================================================");

  resetDb();

  // Setup customer user & products
  const user = {
    _id: new mongoose.Types.ObjectId(),
    username: "BeautyEnthusiast",
    emailId: "skincare@sole.com",
    role: "customer"
  };
  store.users.push(user);
  const token = generateAccessToken(user);
  const authHeaders = { authorization: `Bearer ${token}` };

  const product1 = {
    _id: new mongoose.Types.ObjectId(),
    productName: "Vitamin Mask",
    productPrice: 97.0,
    originalPrice: 104.0,
    quantity: 5,
    category: "Mask",
    size: "50 ml"
  };
  const product2 = {
    _id: new mongoose.Types.ObjectId(),
    productName: "Vitamin Softening Cream",
    productPrice: 72.0,
    originalPrice: null,
    quantity: 8,
    category: "Cream",
    size: "50 ml"
  };
  store.products.push(product1, product2);

  // 1. GET /api/cart: Unauthenticated -> 401
  const unauth = await invokeRoute("GET", "/api/cart");
  assert.equal(unauth.status, 401, "Unauthenticated /api/cart must return 401");
  console.log("✓ Test 1: GET /api/cart correctly requires authentication (401)");

  // 2. GET /api/cart: Authenticated empty cart
  const emptyCart = await invokeRoute("GET", "/api/cart", { headers: authHeaders });
  assert.equal(emptyCart.status, 200);
  assert.deepEqual(emptyCart.body.items, []);
  assert.equal(emptyCart.body.subtotal, 0);
  assert.equal(emptyCart.body.totalItems, 0);
  console.log("✓ Test 2: GET /api/cart returns initialized empty cart structure");

  // 3. POST /api/cart/items: Add item & clamp quantity to live inventory
  const addExceeding = await invokeRoute("POST", "/api/cart/items", {
    headers: authHeaders,
    body: { productId: product1._id.toString(), quantity: 10 }
  });
  assert.equal(addExceeding.status, 200);
  assert.equal(addExceeding.body.items.length, 1);
  assert.equal(addExceeding.body.items[0].cartQty, 5, "Quantity must clamp to live stock of 5");
  assert.equal(addExceeding.body.subtotal, 5 * 97.0);
  assert.equal(addExceeding.body.totalItems, 5);
  console.log("✓ Test 3: POST /api/cart/items clamps item quantity to authoritative stock (5)");

  // 4. POST /api/cart/items: Batch merge guest items on login
  const batchMerge = await invokeRoute("POST", "/api/cart/items", {
    headers: authHeaders,
    body: {
      items: [
        { productId: product2._id.toString(), quantity: 3 }
      ]
    }
  });
  assert.equal(batchMerge.status, 200);
  assert.equal(batchMerge.body.items.length, 2);
  assert.equal(batchMerge.body.totalItems, 8); // 5 of prod1 + 3 of prod2
  assert.equal(batchMerge.body.subtotal, 5 * 97.0 + 3 * 72.0);
  console.log("✓ Test 4: POST /api/cart/items batch merges guest items seamlessly");

  // 5. PUT /api/cart/items/:productId: Update quantity
  const updateQtyRes = await invokeRoute("PUT", `/api/cart/items/${product2._id.toString()}`, {
    headers: authHeaders,
    body: { quantity: 6 }
  });
  assert.equal(updateQtyRes.status, 200);
  const p2Item = updateQtyRes.body.items.find(
    (i) => i.productId.toString() === product2._id.toString()
  );
  assert.equal(p2Item.cartQty, 6);
  assert.equal(updateQtyRes.body.totalItems, 11);
  console.log("✓ Test 5: PUT /api/cart/items/:productId accurately updates item quantity");

  // 6. DELETE /api/cart/items/:productId: Remove specific item
  const delItem = await invokeRoute("DELETE", `/api/cart/items/${product1._id.toString()}`, {
    headers: authHeaders
  });
  assert.equal(delItem.status, 200);
  assert.equal(delItem.body.items.length, 1);
  assert.equal(delItem.body.items[0].productId.toString(), product2._id.toString());
  console.log("✓ Test 6: DELETE /api/cart/items/:productId removes specified product");

  // 7. DELETE /api/cart: Clear entire cart
  const clearRes = await invokeRoute("DELETE", "/api/cart", { headers: authHeaders });
  assert.equal(clearRes.status, 200);
  assert.deepEqual(clearRes.body.items, []);
  assert.equal(clearRes.body.subtotal, 0);
  assert.equal(clearRes.body.totalItems, 0);
  console.log("✓ Test 7: DELETE /api/cart completely clears the cloud cart");

  // 8. Order Placement Integration: Checkout empties cloud cart in DB
  await invokeRoute("POST", "/api/cart/items", {
    headers: authHeaders,
    body: { productId: product2._id.toString(), quantity: 2 }
  });
  const orderRes = await invokeRoute("POST", "/api/orders", {
    headers: authHeaders,
    body: {
      userId: user._id.toString(),
      items: [{ productId: product2._id.toString(), quantity: 2 }]
    }
  });
  assert.equal(orderRes.status, 201);
  const checkCart = await invokeRoute("GET", "/api/cart", { headers: authHeaders });
  assert.equal(checkCart.status, 200);
  assert.deepEqual(checkCart.body.items, [], "Cart must be empty after order placement");
  console.log("✓ Test 8: Order placement automatically empties cloud cart in database");

  console.log("===============================================================");
  console.log("ALL 8 CLOUD CART INTEGRATION TESTS PASSED WITH 100% ACCURACY!  ");
  console.log("===============================================================");
}

runCartTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
