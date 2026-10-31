import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeAppPath,
  sanitizeImageUrl,
  sanitizeErrorMessage
} from "./security.js";

describe("Frontend Security Utilities", () => {
  // -----------------------------------------------------------------
  // 1. OPEN REDIRECT & PATH VALIDATION
  // -----------------------------------------------------------------
  test("sanitizeAppPath: permits valid relative routes", () => {
    assert.equal(sanitizeAppPath("/products"), "/products");
    assert.equal(sanitizeAppPath("/cart"), "/cart");
    assert.equal(sanitizeAppPath("/profile"), "/profile");
    assert.equal(sanitizeAppPath("/orders"), "/orders");
    assert.equal(sanitizeAppPath("/products?search=vitamin"), "/products?search=vitamin");
  });

  test("sanitizeAppPath: rejects external URLs and open redirects", () => {
    assert.equal(sanitizeAppPath("https://evil.com"), "/products");
    assert.equal(sanitizeAppPath("http://evil.com/phish"), "/products");
    assert.equal(sanitizeAppPath("//evil.com"), "/products");
    assert.equal(sanitizeAppPath("/\\evil.com"), "/products");
    assert.equal(sanitizeAppPath("javascript:alert(1)"), "/products");
    assert.equal(sanitizeAppPath("data:text/html,<script>"), "/products");
    assert.equal(sanitizeAppPath(null), "/products");
    assert.equal(sanitizeAppPath(undefined), "/products");
  });

  test("sanitizeAppPath: respects custom fallback route", () => {
    assert.equal(sanitizeAppPath("https://malicious.org", "/cart"), "/cart");
  });

  // -----------------------------------------------------------------
  // 2. IMAGE URL SANITIZATION
  // -----------------------------------------------------------------
  test("sanitizeImageUrl: allows safe HTTPS, HTTP, relative and base64 image URIs", () => {
    assert.equal(
      sanitizeImageUrl("https://cdn.example.com/serum.png"),
      "https://cdn.example.com/serum.png"
    );
    assert.equal(
      sanitizeImageUrl("/images/vitamin-mask.jpg"),
      "/images/vitamin-mask.jpg"
    );
    assert.equal(
      sanitizeImageUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="),
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
    );
  });

  test("sanitizeImageUrl: rejects javascript and dangerous schemes", () => {
    assert.equal(sanitizeImageUrl("javascript:alert(document.cookie)"), "");
    assert.equal(sanitizeImageUrl("data:text/html,<script>alert(1)</script>"), "");
    assert.equal(sanitizeImageUrl("vbscript:msgbox(1)"), "");
    assert.equal(sanitizeImageUrl(""), "");
    assert.equal(sanitizeImageUrl(null), "");
  });

  // -----------------------------------------------------------------
  // 3. ERROR MESSAGE SANITIZATION (PREVENT SENSITIVE DATA LEAKAGE)
  // -----------------------------------------------------------------
  test("sanitizeErrorMessage: masks database internals, stack traces and MongoDB errors", () => {
    const mongoError = new Error("E11000 duplicate key error collection: shopping.users index: emailId_1");
    const safeMsg = sanitizeErrorMessage(mongoError);
    assert.ok(!safeMsg.includes("E11000"));
    assert.ok(!safeMsg.includes("mongo"));
    assert.ok(!safeMsg.includes("collection:"));

    const stackTraceError = new Error("CastError: Cast to ObjectId failed at line 42 in controller.js");
    const safeStack = sanitizeErrorMessage(stackTraceError);
    assert.ok(!safeStack.includes("Cast to ObjectId"));
    assert.ok(!safeStack.includes("controller.js"));
  });

  test("sanitizeErrorMessage: preserves clean user-facing error messages", () => {
    assert.equal(
      sanitizeErrorMessage(new Error("Invalid email or password")),
      "Invalid email or password"
    );
    assert.equal(
      sanitizeErrorMessage("Password must be at least 8 characters long"),
      "Password must be at least 8 characters long"
    );
  });
});

