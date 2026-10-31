const { z } = require("zod");
const mongoose = require("mongoose");

// Helper for validating MongoDB ObjectId strings
const objectIdSchema = z.string().refine((val) => mongoose.isValidObjectId(val), {
  message: "Invalid ObjectId format"
});

// Middleware factory for Zod validation
function validate(schemas) {
  return async (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const formattedErrors = err.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message
        }));

        return res.status(400).json({
          message: "Validation failed",
          errors: formattedErrors
        });
      }
      next(err);
    }
  };
}

// 1. User Registration Schema
// Strict allowlist: only username, emailId, age, password allowed. Role cannot be injected!
const registerValidation = {
  body: z
    .object({
      username: z
        .string({ required_error: "Username is required" })
        .trim()
        .min(2, "Username must be at least 2 characters")
        .max(50, "Username must not exceed 50 characters"),
      emailId: z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Invalid email format"),
      age: z.coerce
        .number({ required_error: "Age is required" })
        .int("Age must be an integer")
        .min(1, "Age must be at least 1")
        .max(120, "Age cannot exceed 120"),
      password: z
        .string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password must not exceed 128 characters")
    })
    .strict("Unknown fields are not permitted in registration")
};

// 2. User Login Schema
const loginValidation = {
  body: z
    .object({
      emailId: z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Invalid email format"),
      password: z
        .string({ required_error: "Password is required" })
        .min(1, "Password cannot be empty")
    })
    .strict()
};

// 3. Order Checkout Schema
const orderValidation = {
  body: z
    .object({
      // userId is accepted for legacy compatibility but is ignored for identity verification
      userId: z.string().optional(),
      items: z
        .array(
          z.object({
            productId: objectIdSchema,
            quantity: z.number().int().min(1, "Quantity must be at least 1")
          })
        )
        .min(1, "Order must contain at least one item")
        .max(100, "Cannot order more than 100 distinct items")
    })
    .strict()
};

// 4. Token Refresh Schema
const refreshTokenValidation = {
  body: z
    .object({
      refreshToken: z.string().optional()
    })
    .optional()
};

// 5. Password Reset Request Schema
const requestPasswordResetValidation = {
  body: z
    .object({
      emailId: z.string().trim().toLowerCase().email("Invalid email format")
    })
    .strict()
};

// 6. Password Reset Submission Schema
const resetPasswordValidation = {
  body: z
    .object({
      token: z.string().min(10, "Invalid or missing reset token"),
      newPassword: z
        .string()
        .min(8, "New password must be at least 8 characters")
        .max(128, "New password cannot exceed 128 characters")
    })
    .strict()
};

// 7. Email Verification Schema
const verifyEmailValidation = {
  body: z
    .object({
      token: z.string().min(10, "Invalid or missing verification token")
    })
    .strict()
};

// 8. Single ObjectId Param Schema (e.g. /api/orders/:id)
const objectIdParamValidation = {
  params: z.object({
    id: objectIdSchema
  })
};

module.exports = {
  validate,
  objectIdSchema,
  registerValidation,
  loginValidation,
  orderValidation,
  refreshTokenValidation,
  requestPasswordResetValidation,
  resetPasswordValidation,
  verifyEmailValidation,
  objectIdParamValidation
};
