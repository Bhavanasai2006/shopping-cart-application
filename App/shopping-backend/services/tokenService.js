const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const { RefreshToken, User } = require("../schema");

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateAccessToken(user) {
  const payload = {
    id: user._id ? user._id.toString() : (user.id || user.userId),
    username: user.username,
    emailId: user.emailId,
    role: user.role || "customer"
  };

  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY
  });
}

async function createRefreshToken(user, family = null) {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(rawToken);
  const tokenFamily = family || crypto.randomUUID();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.JWT_REFRESH_EXPIRY_DAYS);

  await RefreshToken.create({
    userId: user._id || user.id,
    tokenHash,
    family: tokenFamily,
    isRevoked: false,
    expiresAt
  });

  return {
    rawToken,
    expiresAt,
    family: tokenFamily
  };
}

async function rotateRefreshToken(rawToken) {
  if (!rawToken || typeof rawToken !== "string") {
    const error = new Error("Refresh token is required");
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = hashToken(rawToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });

  if (!tokenDoc) {
    const error = new Error("Invalid refresh token");
    error.statusCode = 401;
    throw error;
  }

  // REUSE DETECTION: If an already revoked token is used, compromise is suspected!
  if (tokenDoc.isRevoked) {
    // Revoke all tokens in this family immediately
    await RefreshToken.updateMany(
      { family: tokenDoc.family },
      { isRevoked: true }
    );

    const error = new Error(
      "Refresh token reuse detected. All sessions in this chain have been revoked."
    );
    error.statusCode = 403;
    throw error;
  }

  // Expiration check
  if (new Date() > new Date(tokenDoc.expiresAt)) {
    tokenDoc.isRevoked = true;
    await tokenDoc.save();

    const error = new Error("Refresh token expired");
    error.statusCode = 401;
    throw error;
  }

  // Retrieve user to ensure account is active and role is up-to-date
  const user = await User.findById(tokenDoc.userId);
  if (!user || user.isLocked) {
    tokenDoc.isRevoked = true;
    await tokenDoc.save();

    const error = new Error("User account is inactive or locked");
    error.statusCode = 401;
    throw error;
  }

  // Generate replacement refresh token within same family
  const newRawToken = crypto.randomBytes(40).toString("hex");
  const newTokenHash = hashToken(newRawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.JWT_REFRESH_EXPIRY_DAYS);

  // Revoke current token and link to replacement
  tokenDoc.isRevoked = true;
  tokenDoc.replacedByTokenHash = newTokenHash;
  await tokenDoc.save();

  // Save new refresh token
  await RefreshToken.create({
    userId: user._id,
    tokenHash: newTokenHash,
    family: tokenDoc.family,
    isRevoked: false,
    expiresAt
  });

  const newAccessToken = generateAccessToken(user);

  return {
    accessToken: newAccessToken,
    refreshToken: newRawToken,
    user: {
      userId: user._id,
      username: user.username,
      emailId: user.emailId,
      role: user.role
    }
  };
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken || typeof rawToken !== "string") {
    return false;
  }
  const tokenHash = hashToken(rawToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });
  if (tokenDoc) {
    tokenDoc.isRevoked = true;
    await tokenDoc.save();
    return true;
  }
  return false;
}

async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany({ userId }, { isRevoked: true });
}

module.exports = {
  hashToken,
  generateAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens
};
