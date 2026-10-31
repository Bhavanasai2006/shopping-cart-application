const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const config = require("../config/env");

async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== "string") {
    throw new Error("Invalid password provided for hashing");
  }
  return bcrypt.hash(plainPassword, config.BCRYPT_SALT_ROUNDS);
}

async function comparePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) {
    return false;
  }
  return bcrypt.compare(plainPassword, hashedPassword);
}

function generateSecureToken(byteLength = 32, lifespanHours = 24) {
  const token = crypto.randomBytes(byteLength).toString("hex");
  const expires = new Date(Date.now() + lifespanHours * 60 * 60 * 1000);
  return { token, expires };
}

// Verification and Reset helpers
function createEmailVerificationToken() {
  return generateSecureToken(32, 24); // 24-hour expiration
}

function createPasswordResetToken() {
  return generateSecureToken(32, 1); // 1-hour expiration
}

// Email delivery abstraction (mock / logger in current environment)
async function sendMockEmail(to, subject, content) {
  // In production, integrate with nodemailer / AWS SES / SendGrid
  if (config.NODE_ENV !== "test") {
    console.log(`[AUTH-EMAIL-DISPATCH] To: ${to} | Subject: ${subject}`);
    console.log(`[AUTH-EMAIL-CONTENT] ${content}`);
  }
  return true;
}

module.exports = {
  hashPassword,
  comparePassword,
  createEmailVerificationToken,
  createPasswordResetToken,
  sendMockEmail
};
