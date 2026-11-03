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

// Shipping Address Schema
const shippingAddressSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(80, "Full name cannot exceed 80 characters"),
    phone: z
      .string()
      .trim()
      .min(7, "Phone number must be at least 7 characters")
      .max(20, "Phone number cannot exceed 20 characters"),
    addressLine1: z
      .string()
      .trim()
      .min(3, "Address line 1 must be at least 3 characters")
      .max(120, "Address line 1 cannot exceed 120 characters"),
    addressLine2: z
      .string()
      .trim()
      .max(120, "Address line 2 cannot exceed 120 characters")
      .optional()
      .default(""),
    city: z
      .string()
      .trim()
      .min(2, "City must be at least 2 characters")
      .max(60, "City cannot exceed 60 characters"),
    state: z
      .string()
      .trim()
      .min(2, "State must be at least 2 characters")
      .max(60, "State cannot exceed 60 characters"),
    postalCode: z
      .string()
      .trim()
      .min(3, "Postal code must be at least 3 characters")
      .max(20, "Postal code cannot exceed 20 characters"),
    country: z
      .string()
      .trim()
      .max(60, "Country cannot exceed 60 characters")
      .optional()
      .default("United States")
  })
  .strict();

// 3. Order Checkout Schema - Idempotent, validated items & shipping address
const orderValidation = {
  body: z
    .object({
      userId: z.string().optional(),
      idempotencyKey: z
        .string()
        .trim()
        .min(8, "Idempotency key must be at least 8 characters")
        .max(128, "Idempotency key cannot exceed 128 characters")
        .optional(),
      items: z
        .array(
          z.object({
            productId: objectIdSchema,
            quantity: z
              .number()
              .int("Quantity must be an integer")
              .min(1, "Quantity must be at least 1")
              .max(99, "Quantity per product cannot exceed 99 units")
          })
        )
        .min(1, "Order must contain at least one item")
        .max(100, "Cannot order more than 100 distinct items"),
      shippingAddress: shippingAddressSchema.optional(),
      paymentMethod: z
        .enum(["DEMO_SIMULATION", "DEMO_CARD", "DEMO_UPI", "DEMO_COD"], {
          errorMap: () => ({ message: "Payment method must be DEMO_SIMULATION, DEMO_CARD, DEMO_UPI, or DEMO_COD" })
        })
        .default("DEMO_SIMULATION")
        .optional(),
      simulateFailure: z.boolean().optional(),
      demoAccount: z
        .string()
        .trim()
        .max(100, "Demo account description cannot exceed 100 characters")
        .optional()
    })
    .strict()
};

// Order Cancellation Schema
const cancelOrderValidation = {
  body: z
    .object({
      reason: z
        .string()
        .trim()
        .max(200, "Cancellation reason cannot exceed 200 characters")
        .optional()
    })
    .strict()
    .optional()
};

// Order Status Update Schema (Admin)
const updateOrderStatusValidation = {
  body: z
    .object({
      status: z.enum(
        ["placed", "processing", "shipped", "delivered", "cancelled"],
        {
          errorMap: () => ({ message: "Invalid order status value" })
        }
      ),
      note: z
        .string()
        .trim()
        .max(250, "Status update note cannot exceed 250 characters")
        .optional()
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

// 8. Single ObjectId Param Schema (e.g. /api/orders/:id or /api/admin/products/:id)
const objectIdParamValidation = {
  params: z.object({
    id: objectIdSchema
  })
};

// 9. Admin Create Product Schema (Strict allowlist to prevent mass assignment)
const createProductValidation = {
  body: z
    .object({
      productId: z.string().trim().max(100, "Product ID cannot exceed 100 characters").optional(),
      productName: z
        .string({ required_error: "Product name is required" })
        .trim()
        .min(1, "Product name cannot be empty")
        .max(100, "Product name cannot exceed 100 characters"),
      productPrice: z.coerce
        .number({ required_error: "Product price is required" })
        .min(0, "Product price cannot be negative"),
      originalPrice: z.coerce
        .number()
        .min(0, "Original price cannot be negative")
        .nullable()
        .optional(),
      subtitle: z.string().trim().max(150, "Subtitle cannot exceed 150 characters").optional(),
      category: z.string().trim().max(50, "Category cannot exceed 50 characters").optional(),
      size: z.string().trim().max(50, "Size cannot exceed 50 characters").optional(),
      quantity: z.coerce
        .number({ required_error: "Quantity is required" })
        .int("Quantity must be an integer")
        .min(0, "Quantity cannot be negative"),
      description: z.string().trim().max(2000, "Description cannot exceed 2000 characters").optional(),
      howToUse: z.string().trim().max(1000, "How to use cannot exceed 1000 characters").optional(),
      ingredients: z.string().trim().max(2000, "Ingredients cannot exceed 2000 characters").optional(),
      image: z.string().trim().max(500, "Image URL cannot exceed 500 characters").optional(),
      isActive: z.boolean().optional()
    })
    .strict("Unknown fields are not permitted in product creation")
};

// 10. Admin Update Product Schema (Strict allowlist & ObjectId params)
const updateProductValidation = {
  params: z.object({
    id: objectIdSchema
  }),
  body: z
    .object({
      productId: z.string().trim().max(100, "Product ID cannot exceed 100 characters").optional(),
      productName: z
        .string()
        .trim()
        .min(1, "Product name cannot be empty")
        .max(100, "Product name cannot exceed 100 characters")
        .optional(),
      productPrice: z.coerce
        .number()
        .min(0, "Product price cannot be negative")
        .optional(),
      originalPrice: z.coerce
        .number()
        .min(0, "Original price cannot be negative")
        .nullable()
        .optional(),
      subtitle: z.string().trim().max(150, "Subtitle cannot exceed 150 characters").optional(),
      category: z.string().trim().max(50, "Category cannot exceed 50 characters").optional(),
      size: z.string().trim().max(50, "Size cannot exceed 50 characters").optional(),
      quantity: z.coerce
        .number()
        .int("Quantity must be an integer")
        .min(0, "Quantity cannot be negative")
        .optional(),
      description: z.string().trim().max(2000, "Description cannot exceed 2000 characters").optional(),
      howToUse: z.string().trim().max(1000, "How to use cannot exceed 1000 characters").optional(),
      ingredients: z.string().trim().max(2000, "Ingredients cannot exceed 2000 characters").optional(),
      image: z.string().trim().max(500, "Image URL cannot exceed 500 characters").optional(),
      isActive: z.boolean().optional()
    })
    .strict("Unknown fields are not permitted in product update")
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
  objectIdParamValidation,
  createProductValidation,
  updateProductValidation,
  shippingAddressSchema,
  cancelOrderValidation,
  updateOrderStatusValidation
};
