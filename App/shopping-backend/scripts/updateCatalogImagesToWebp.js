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
const { Product } = require("../schema");

// Map of unique, stable productId to photorealistic WebP image path
const imageUpdates = [
  { productId: "sole-cleanser-01", image: "/product-images/cleansers/gentle-cloud-cleanser.webp" },
  { productId: "sole-cleanser-02", image: "/product-images/cleansers/daily-gel-cleanser.webp" },
  { productId: "sole-cleanser-03", image: "/product-images/cleansers/milky-face-wash.webp" },
  { productId: "sole-cleanser-04", image: "/product-images/cleansers/deep-clean-foam.webp" },
  { productId: "sole-cleanser-05", image: "/product-images/cleansers/hydrating-cleanser.webp" },
  { productId: "sole-cleanser-06", image: "/product-images/cleansers/purifying-cleanser.webp" },

  { productId: "sole-serum-01", image: "/product-images/serums/vitamin-c-serum.webp" },
  { productId: "sole-serum-02", image: "/product-images/serums/hyaluronic-serum.webp" },
  { productId: "sole-serum-03", image: "/product-images/serums/niacinamide-serum.webp" },
  { productId: "sole-serum-04", image: "/product-images/serums/peptide-serum.webp" },
  { productId: "sole-serum-05", image: "/product-images/serums/hydration-drops.webp" },
  { productId: "sole-serum-06", image: "/product-images/serums/night-repair-serum.webp" },

  { productId: "sole-moist-01", image: "/product-images/moisturizers/daily-dew-cream.webp" },
  { productId: "sole-moist-02", image: "/product-images/moisturizers/barrier-comfort-cream.webp" },
  { productId: "sole-moist-03", image: "/product-images/moisturizers/aqua-gel-moisturizer.webp" },
  { productId: "sole-moist-04", image: "/product-images/moisturizers/rich-night-cream.webp" },
  { productId: "sole-moist-05", image: "/product-images/moisturizers/lightweight-lotion.webp" },
  { productId: "sole-moist-06", image: "/product-images/moisturizers/ceramide-moisturizer.webp" },

  { productId: "sole-sun-01", image: "/product-images/sunscreens/daily-spf50-sunscreen.webp" },
  { productId: "sole-sun-02", image: "/product-images/sunscreens/matte-finish-sunscreen.webp" },
  { productId: "sole-sun-03", image: "/product-images/sunscreens/aqua-shield-sunscreen.webp" },
  { productId: "sole-sun-04", image: "/product-images/sunscreens/daily-sun-fluid.webp" },
  { productId: "sole-sun-05", image: "/product-images/sunscreens/lightweight-sun-gel.webp" },
  { productId: "sole-sun-06", image: "/product-images/sunscreens/sun-protection-cream.webp" }
];

async function updateImages() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to MongoDB for targeted WebP image updates...");

    let updatedCount = 0;
    for (const update of imageUpdates) {
      const res = await Product.updateOne(
        { productId: update.productId },
        { $set: { image: update.image } }
      );
      if (res.matchedCount > 0) {
        updatedCount++;
        console.log(`✓ Updated [${update.productId}] -> ${update.image}`);
      } else {
        console.warn(`! Product not found for productId: ${update.productId}`);
      }
    }

    console.log(`\nSuccessfully updated image paths for ${updatedCount}/24 products!`);
    await mongoose.disconnect();
    console.log("Database disconnected.");
  } catch (err) {
    console.error("Update error:", err);
    process.exit(1);
  }
}

updateImages();
