const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const brainDir = "C:\\Users\\subhi\\.gemini\\antigravity-ide\\brain\\470738c1-acf3-405e-a4a6-c69ffb9c1785";
const publicDir = path.join(__dirname, "..", "public", "product-images");

// Mapping of generated raw JPGs to target WebP destinations
const imageMap = [
  // Cleansers (All 6 generated!)
  {
    src: "preview_cleanser_1793517874024.jpg",
    dest: "cleansers/gentle-cloud-cleanser.webp"
  },
  {
    src: "daily_gel_cleanser_1793517993998.jpg",
    dest: "cleansers/daily-gel-cleanser.webp"
  },
  {
    src: "milky_face_wash_1793518015074.jpg",
    dest: "cleansers/milky-face-wash.webp"
  },
  {
    src: "deep_clean_foam_1793518036637.jpg",
    dest: "cleansers/deep-clean-foam.webp"
  },
  {
    src: "hydrating_cleanser_1793518061374.jpg",
    dest: "cleansers/hydrating-cleanser.webp"
  },
  {
    src: "purifying_cleanser_1793518084586.jpg",
    dest: "cleansers/purifying-cleanser.webp"
  },

  // Serums (5 generated)
  {
    src: "preview_serum_1793517893233.jpg",
    dest: "serums/vitamin-c-serum.webp"
  },
  {
    src: "hyaluronic_serum_1793518107420.jpg",
    dest: "serums/hyaluronic-serum.webp"
  },
  {
    src: "niacinamide_serum_1793518129632.jpg",
    dest: "serums/niacinamide-serum.webp"
  },
  {
    src: "peptide_serum_1793518154322.jpg",
    dest: "serums/peptide-serum.webp"
  },
  {
    src: "hydration_drops_1793518183025.jpg",
    dest: "serums/hydration-drops.webp"
  },

  // Moisturizers (1 generated preview)
  {
    src: "preview_moisturizer_1793517914564.jpg",
    dest: "moisturizers/daily-dew-cream.webp"
  },

  // Sunscreens (1 generated preview)
  {
    src: "preview_sunscreen_1793517934714.jpg",
    dest: "sunscreens/daily-spf50-sunscreen.webp"
  }
];

async function convert() {
  console.log("Converting generated photorealistic JPGs to optimized WebP...");
  for (const item of imageMap) {
    const srcPath = path.join(brainDir, item.src);
    const destPath = path.join(publicDir, item.dest);

    if (!fs.existsSync(srcPath)) {
      console.warn("Source not found:", srcPath);
      continue;
    }

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    await sharp(srcPath)
      .resize(1024, 1024, { fit: "cover" })
      .webp({ quality: 88, effort: 6 })
      .toFile(destPath);

    const stats = fs.statSync(destPath);
    console.log(`✓ Converted: ${item.dest} (${Math.round(stats.size / 1024)} KB)`);
  }
}

convert().catch(console.error);
