// Gracefully configure DNS for environments with restrictive local DNS
if (process.env.CUSTOM_DNS !== "false") {
  try {
    const dns = require("node:dns");
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (err) {
    // Non-fatal if system restricts DNS overrides
  }
}

const mongoose = require("mongoose");
const config = require("../config/env");
const { Product, Order, Cart, User } = require("../schema");
const { newCatalogProducts } = require("./newCatalogSeedData");

// Known old demo catalog product IDs identified during repository inspection
const OLD_DEMO_PRODUCT_IDS = [
  "6ae6242f7e289303313cb989", // Skin Treat Poreless Tinted Moisturizer
  "6ae626a95c147287fd49c8c3", // Moisture Brightening Serum
  "6ae626a95c147287fd49c8c4", // Moisture Calm Serum
  "6ae626a95c147287fd49c8c5", // Rosewater Balancing Mist
  "6ae626a95c147287fd49c8c6", // Velvet Lip Tint & Hydration Balm
  "6ae626aa5c147287fd49c8c7", // Luminous Silk Skin Tint Foundation
  "6ae626aa5c147287fd49c8c8", // Dewy Cheek & Lip Stain Blush
  "6ae628ceede4f89331036987"  // Green apple moisturizer
];

async function previewOrMigrate(isDryRun = true) {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("=================================================");
    console.log(`MODE: ${isDryRun ? "DRY-RUN / PREVIEW ONLY (NO DB WRITES)" : "LIVE EXECUTION (DB WRITES ENABLED)"}`);
    console.log("Target Database URI:", config.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@"));
    console.log("=================================================\n");

    // 1. Inspect existing products
    const existingProducts = await Product.find({}).lean();
    console.log(`[1] Total products currently in DB: ${existingProducts.length}`);

    const oldProductsToRetire = existingProducts.filter((p) =>
      OLD_DEMO_PRODUCT_IDS.includes(String(p._id))
    );

    console.log(`[2] Old demo products identified for retirement (isActive: false): ${oldProductsToRetire.length}`);
    oldProductsToRetire.forEach((p, idx) => {
      console.log(`    ${idx + 1}. ID: ${p._id} | Name: "${p.productName}" | Current isActive: ${p.isActive}`);
    });

    // 2. Inspect order and cart references to guarantee safety
    const orders = await Order.find({}).lean();
    let orderRefCount = 0;
    orders.forEach((o) => {
      (o.items || []).forEach((item) => {
        if (OLD_DEMO_PRODUCT_IDS.includes(String(item.productId))) {
          orderRefCount++;
        }
      });
    });
    console.log(`\n[3] Historical order line-items referencing old products: ${orderRefCount}`);
    console.log("    -> By deactivating rather than deleting, all order line items remain 100% valid.");

    const carts = await Cart.find({}).lean();
    let cartRefCount = 0;
    carts.forEach((c) => {
      (c.items || []).forEach((item) => {
        if (OLD_DEMO_PRODUCT_IDS.includes(String(item.productId))) {
          cartRefCount++;
        }
      });
    });
    console.log(`[4] Active customer cart line-items referencing old products: ${cartRefCount}`);

    // 3. Inspect new catalog
    console.log(`\n[5] New SOLE catalog prepared for insertion/upsert: ${newCatalogProducts.length} products`);
    const categoryCounts = {};
    newCatalogProducts.forEach((p) => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });
    console.log("    Breakdown by category:", categoryCounts);

    if (isDryRun) {
      console.log("\n>>> DRY RUN COMPLETE: NO DATABASE RECORDS WERE MODIFIED. <<<");
      console.log("Run with argument '--execute' to perform the approved database changes.");
      await mongoose.disconnect();
      return;
    }

    // 4. LIVE EXECUTION (Only when explicit --execute flag is passed)
    console.log("\n-------------------------------------------------");
    console.log("EXECUTING APPROVED SAFE MIGRATION...");
    console.log("-------------------------------------------------");

    // A. Soft-deactivate identified old demo products
    const deactivationResult = await Product.updateMany(
      { _id: { $in: OLD_DEMO_PRODUCT_IDS } },
      { $set: { isActive: false } }
    );
    console.log(`✓ Soft-deactivated old products: ${deactivationResult.modifiedCount} modified`);

    // B. Idempotent upsert of all 24 new catalog products by unique productId
    let insertedCount = 0;
    let updatedCount = 0;

    for (const prodData of newCatalogProducts) {
      const existing = await Product.findOne({
        $or: [
          { productId: prodData.productId },
          { productName: prodData.productName }
        ]
      });

      if (!existing) {
        await Product.create(prodData);
        insertedCount++;
        console.log(`  + Inserted: ${prodData.productName} [₹${prodData.productPrice}]`);
      } else {
        Object.assign(existing, prodData);
        existing.isActive = true;
        await existing.save();
        updatedCount++;
        console.log(`  ↻ Updated: ${prodData.productName} [₹${prodData.productPrice}]`);
      }
    }

    console.log(`\n✓ New products inserted: ${insertedCount}`);
    console.log(`✓ New products updated: ${updatedCount}`);

    // C. Verify final database state
    const finalAll = await Product.find({}).lean();
    const finalActive = await Product.find({ isActive: { $ne: false } }).lean();
    const finalInactive = await Product.find({ isActive: false }).lean();

    console.log("\n=================================================");
    console.log("FINAL DATABASE VERIFICATION REPORT:");
    console.log(`Total products in collection: ${finalAll.length}`);
    console.log(`Active purchasable products in catalog: ${finalActive.length} (Expected: 24)`);
    console.log(`Inactive historical products preserved: ${finalInactive.length}`);
    console.log("Customer accounts intact:", await User.countDocuments({ role: "customer" }));
    console.log("Admin accounts intact:", await User.countDocuments({ role: "admin" }));
    console.log("Total orders preserved:", await Order.countDocuments({}));
    console.log("Total carts preserved:", await Cart.countDocuments({}));
    console.log("=================================================");

    await mongoose.disconnect();
    console.log("Database connection closed cleanly.");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

const isExecute = process.argv.includes("--execute");
previewOrMigrate(!isExecute);
