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

describe("Authentication Lifecycle & Advanced Token Security Tests", () => {
  beforeEach(() => {
    resetDb();
  });

  // -------------------------------------------------------------
  // REFRESH TOKEN ROTATION & REUSE DETECTION
  // -------------------------------------------------------------
  test("Refresh Token Rotation: successfully rotates refresh token and issues new access token", async () => {
    // 1. Register & login
    const passwordHash = await hashPassword("UserPass123!");
    const user = {
      _id: new mongoose.Types.ObjectId(),
      username: "RefreshUser",
      emailId: "refresh@example.com",
      age: 27,
      password: passwordHash,
      role: "customer"
    };
    store.users.push(user);

    const loginRes = await request(app)
      .post("/api/login")
      .send({ emailId: "refresh@example.com", password: "UserPass123!" });

    assert.equal(loginRes.status, 200);
    const initialRefreshToken = loginRes.body.refreshToken;
    const initialAccessToken = loginRes.body.accessToken;
    assert.ok(initialRefreshToken);

    // 2. Perform refresh
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: initialRefreshToken });

    assert.equal(refreshRes.status, 200);
    assert.ok(refreshRes.body.accessToken, "New access token must be returned");
    assert.ok(refreshRes.body.refreshToken, "New refresh token must be returned");
    assert.notEqual(
      refreshRes.body.refreshToken,
      initialRefreshToken,
      "Refresh token must rotate to a new cryptographically unique token"
    );

    // 3. REUSE DETECTION: Attempting to use the rotated initialRefreshToken again!
    const reuseAttemptRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: initialRefreshToken });

    // Must be blocked with 403 Forbidden due to token reuse!
    assert.equal(reuseAttemptRes.status, 403);
    assert.match(reuseAttemptRes.body.message, /reuse detected/i);

    // Verify all tokens in that family were revoked
    const familyTokens = store.refreshTokens.filter(
      (t) => t.userId.toString() === user._id.toString()
    );
    assert.ok(familyTokens.length >= 2);
    assert.ok(familyTokens.every((t) => t.isRevoked === true), "All tokens in family must be revoked");
  });

  // -------------------------------------------------------------
  // SECURE LOGOUT
  // -------------------------------------------------------------
  test("Secure Logout: revokes refresh token and clears auth cookies", async () => {
    const passwordHash = await hashPassword("UserPass123!");
    const user = {
      _id: new mongoose.Types.ObjectId(),
      username: "LogoutUser",
      emailId: "logout@example.com",
      age: 29,
      password: passwordHash,
      role: "customer"
    };
    store.users.push(user);

    const loginRes = await request(app)
      .post("/api/login")
      .send({ emailId: "logout@example.com", password: "UserPass123!" });

    const rawRefreshToken = loginRes.body.refreshToken;

    // Logout
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: rawRefreshToken });

    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.message, "Logged out successfully");

    // Verify cookie clearing
    const cookies = logoutRes.headers["set-cookie"];
    assert.ok(cookies, "Cookies must be cleared");

    // Attempting refresh with logged-out token should fail
    const refreshAfterLogoutRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: rawRefreshToken });

    assert.ok([401, 403].includes(refreshAfterLogoutRes.status));
  });

  // -------------------------------------------------------------
  // PASSWORD RESET FLOW
  // -------------------------------------------------------------
  test("Password Reset: requests reset token, submits new password, and updates credentials", async () => {
    const oldPasswordHash = await hashPassword("OldPassword123!");
    const user = {
      _id: new mongoose.Types.ObjectId(),
      username: "ResetUser",
      emailId: "reset@example.com",
      age: 30,
      password: oldPasswordHash,
      role: "customer"
    };
    store.users.push(user);

    // 1. Request password reset
    const requestRes = await request(app)
      .post("/api/auth/request-password-reset")
      .send({ emailId: "reset@example.com" });

    assert.equal(requestRes.status, 200);
    assert.match(requestRes.body.message, /password reset instructions/i);

    // Retrieve generated token from mock database
    const updatedUser = store.users.find((u) => u.emailId === "reset@example.com");
    assert.ok(updatedUser.passwordResetToken);
    const resetToken = updatedUser.passwordResetToken;

    // 2. Submit password reset with new password
    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: resetToken,
        newPassword: "BrandNewPassword123!"
      });

    assert.equal(resetRes.status, 200);
    assert.match(resetRes.body.message, /Password reset successful/i);

    // 3. Login with old password fails
    const oldLoginRes = await request(app)
      .post("/api/login")
      .send({ emailId: "reset@example.com", password: "OldPassword123!" });
    assert.equal(oldLoginRes.status, 401);

    // 4. Login with new password succeeds
    const newLoginRes = await request(app)
      .post("/api/login")
      .send({ emailId: "reset@example.com", password: "BrandNewPassword123!" });
    assert.equal(newLoginRes.status, 200);
  });

  // -------------------------------------------------------------
  // EMAIL VERIFICATION FLOW
  // -------------------------------------------------------------
  test("Email Verification: verifies user account using verification token", async () => {
    const passwordHash = await hashPassword("VerifyPass123!");
    const user = {
      _id: new mongoose.Types.ObjectId(),
      username: "UnverifiedUser",
      emailId: "unverified@example.com",
      age: 22,
      password: passwordHash,
      role: "customer",
      emailVerified: false,
      verificationToken: "valid_email_verification_token_12345678",
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
    store.users.push(user);

    const verifyRes = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "valid_email_verification_token_12345678" });

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.message, "Email verified successfully");

    const updatedUser = store.users.find((u) => u.emailId === "unverified@example.com");
    assert.equal(updatedUser.emailVerified, true);
    assert.equal(updatedUser.verificationToken, null);
  });
});
