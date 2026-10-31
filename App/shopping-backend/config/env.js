const path = require("path");
const dotenv = require("dotenv");

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const NODE_ENV = process.env.NODE_ENV || "development";

// In production, require strong secrets
if (NODE_ENV === "production") {
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
    throw new Error("FATAL: JWT_ACCESS_SECRET must be at least 32 characters in production.");
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error("FATAL: JWT_REFRESH_SECRET must be at least 32 characters in production.");
  }
  if (!process.env.MONGO_URI) {
    throw new Error("FATAL: MONGO_URI must be configured in production.");
  }
}

const config = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV,
  isProduction: NODE_ENV === "production",
  isTest: NODE_ENV === "test",

  MONGO_URI:
    process.env.MONGO_URI ||
    "mongodb+srv://subhilogix_db_user:2007@web-tech.um7hzkf.mongodb.net/shoppingcart",

  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ||
    "dev_jwt_access_secret_super_secure_32_characters_long",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ||
    "dev_jwt_refresh_secret_super_secure_32_characters_long",

  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
  JWT_REFRESH_EXPIRY_DAYS: parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS, 10) || 7,

  CORS_ORIGINS: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
      ],

  // In test environments, salt rounds can be 4 for speed; in dev/prod, default to 12
  BCRYPT_SALT_ROUNDS:
    NODE_ENV === "test"
      ? 4
      : parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  BODY_LIMIT: process.env.BODY_LIMIT || "10kb"
};

module.exports = config;
