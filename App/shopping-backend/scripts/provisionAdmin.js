/**
 * Secure Administrative Provisioning Script
 * 
 * Safely provisions an initial administrator account for the SOLE application.
 * - Idempotent: Refuses to duplicate existing administrators.
 * - Secure: Reads credentials from environment variables, CLI arguments, or interactive prompt.
 * - Never logs plaintext passwords or authentication tokens.
 * - Uses existing bcrypt hashing with configured salt rounds.
 */

const readline = require("readline");
const mongoose = require("mongoose");
const config = require("../config/env");
const { User } = require("../schema");
const { hashPassword } = require("../services/authService");

function parseCliArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      args[key] = rest.join("=");
    }
  }
  return args;
}

function promptInteractive(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (hidden && process.stdin.isTTY) {
      process.stdout.write(question);
      // Mute output for password input in interactive TTY
      process.stdin.on("data", (char) => {
        const c = char.toString();
        if (c === "\n" || c === "\r" || c === "\u0004") {
          process.stdin.removeAllListeners("data");
        }
      });
      rl.question("", (answer) => {
        rl.close();
        console.log();
        resolve(answer.trim());
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Core admin provisioning function (can be called from CLI or unit tests).
 */
async function provisionAdminAccount(options = {}) {
  const email = (options.emailId || options.email || "").trim().toLowerCase();
  const password = options.password || "";
  const username = (options.username || "SOLE Admin").trim();
  const age = Number(options.age) || 30;

  // Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new Error("Invalid email format provided for administrator provisioning.");
  }

  if (!password || password.length < 8) {
    throw new Error("Admin password must be at least 8 characters long.");
  }

  if (!username || username.length < 2) {
    throw new Error("Admin username must be at least 2 characters long.");
  }

  // Check existing user
  const existingUser = await User.findOne({ emailId: email });
  if (existingUser) {
    if (existingUser.role === "admin") {
      return {
        created: false,
        elevated: false,
        message: `Admin account already exists for ${email}. No changes made.`,
        user: existingUser
      };
    }

    // Elevate existing customer to admin
    existingUser.role = "admin";
    existingUser.emailVerified = true;
    existingUser.isLocked = false;
    existingUser.failedLoginAttempts = 0;
    if (options.updatePassword) {
      existingUser.password = await hashPassword(password);
    }
    await existingUser.save();

    return {
      created: false,
      elevated: true,
      message: `Existing user ${email} successfully promoted to admin.`,
      user: existingUser
    };
  }

  // Hash password securely
  const hashedPassword = await hashPassword(password);

  // Create new admin user
  const newAdmin = await User.create({
    username,
    emailId: email,
    age,
    password: hashedPassword,
    role: "admin",
    emailVerified: true
  });

  return {
    created: true,
    elevated: false,
    message: `Initial administrator account created successfully for ${email}.`,
    user: newAdmin
  };
}

// CLI Execution runner
async function run() {
  const cliArgs = parseCliArgs();

  const email =
    cliArgs.email ||
    process.env.ADMIN_EMAIL ||
    (await promptInteractive("Enter Admin Email: "));

  const username =
    cliArgs.username ||
    process.env.ADMIN_USERNAME ||
    (await promptInteractive("Enter Admin Username (default: SOLE Admin): ")) ||
    "SOLE Admin";

  const password =
    cliArgs.password ||
    process.env.ADMIN_PASSWORD ||
    (await promptInteractive("Enter Admin Password (min 8 chars): ", true));

  const age =
    cliArgs.age ||
    process.env.ADMIN_AGE ||
    30;

  try {
    if (mongoose.connection.readyState === 0) {
      console.log("[ADMIN-PROVISION] Connecting to MongoDB...");
      await mongoose.connect(config.MONGO_URI);
    }

    const result = await provisionAdminAccount({
      emailId: email,
      username,
      password,
      age
    });

    console.log(`[ADMIN-PROVISION] ${result.message}`);
    console.log(`[ADMIN-PROVISION] Admin Username: ${result.user.username}`);
    console.log(`[ADMIN-PROVISION] Admin Role: ${result.user.role}`);
    console.log("[ADMIN-PROVISION] Provisioning complete. Passwords and secrets were not logged.");
  } catch (err) {
    console.error(`[ADMIN-PROVISION ERROR] ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  run();
}

module.exports = { provisionAdminAccount };
