const fs = require("fs");
const path = require("path");

const outputDir = path.join(__dirname, "..", "public", "product-images");

// Helper to escape XML
function esc(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 24 SOLE Product Definitions
 */
const products = [
  // ==========================================
  // CLEANSERS (6)
  // ==========================================
  {
    id: "gentle-cloud-cleanser",
    filename: "cleansers/gentle-cloud-cleanser.svg",
    category: "cleansers",
    type: "pump-cylinder",
    title: "GENTLE CLOUD",
    subtitle: "Everyday Foaming Cleanser",
    spec: "150 ml • 5.1 fl. oz.",
    bgStart: "#FAF6F0",
    bgEnd: "#EFE8DC",
    bottleColor: "#FAF7F2",
    bottleColor2: "#EFE8DC",
    accentColor: "#C5A880",
    labelBg: "#FFFFFF",
    dispenserColor: "#D8C7B0",
    capType: "foam-pump",
    accentMood: "Champagne Ivory"
  },
  {
    id: "daily-gel-cleanser",
    filename: "cleansers/daily-gel-cleanser.svg",
    category: "cleansers",
    type: "pump-cylinder",
    title: "DAILY GEL",
    subtitle: "Lightweight Balancing Wash",
    spec: "150 ml • 5.1 fl. oz.",
    bgStart: "#F3F7F4",
    bgEnd: "#DFEAE2",
    bottleColor: "#E3ECE5",
    bottleColor2: "#CBDCD0",
    accentColor: "#6B8E75",
    labelBg: "#FAFCFA",
    dispenserColor: "#B5C8BC",
    capType: "lotion-pump",
    accentMood: "Sage Mist"
  },
  {
    id: "milky-face-wash",
    filename: "cleansers/milky-face-wash.svg",
    category: "cleansers",
    type: "tube",
    title: "MILKY FACE WASH",
    subtitle: "Soft Cleansing Ritual",
    spec: "120 ml • 4.0 fl. oz.",
    bgStart: "#FAF4F2",
    bgEnd: "#ECE0DC",
    bottleColor: "#F9ECE8",
    bottleColor2: "#E6D3CD",
    accentColor: "#B88077",
    labelBg: "#FFF9F8",
    dispenserColor: "#D2ABA4",
    capType: "disc-cap",
    accentMood: "Blush Petal"
  },
  {
    id: "deep-clean-foam",
    filename: "cleansers/deep-clean-foam.svg",
    category: "cleansers",
    type: "pump-cylinder",
    title: "DEEP CLEAN FOAM",
    subtitle: "Purifying Pore Cleanser",
    spec: "150 ml • 5.1 fl. oz.",
    bgStart: "#F4F5F6",
    bgEnd: "#DFE3E6",
    bottleColor: "#E2E7EA",
    bottleColor2: "#C8D1D7",
    accentColor: "#5A7382",
    labelBg: "#FFFFFF",
    dispenserColor: "#9FB2BE",
    capType: "foam-pump",
    accentMood: "Muted Eucalyptus"
  },
  {
    id: "hydrating-cleanser",
    filename: "cleansers/hydrating-cleanser.svg",
    category: "cleansers",
    type: "tall-dispenser",
    title: "HYDRATING CLEANSER",
    subtitle: "Comfort Daily Moisture Rinse",
    spec: "200 ml • 6.7 fl. oz.",
    bgStart: "#F9F5F0",
    bgEnd: "#E8DECة".replace("ة", "F"),
    bgEnd: "#E8DEC8",
    bottleColor: "#F5EDE0",
    bottleColor2: "#DFD2BE",
    accentColor: "#A68052",
    labelBg: "#FFFDF9",
    dispenserColor: "#C9AA82",
    capType: "tall-pump",
    accentMood: "Warm Amber"
  },
  {
    id: "purifying-cleanser",
    filename: "cleansers/purifying-cleanser.svg",
    category: "cleansers",
    type: "tube",
    title: "PURIFYING CLEANSER",
    subtitle: "Low-pH Minimal Cleanser",
    spec: "150 ml • 5.1 fl. oz.",
    bgStart: "#F5F3F7",
    bgEnd: "#E4DFE9",
    bottleColor: "#EBE5EF",
    bottleColor2: "#D5CDDC",
    accentColor: "#806E92",
    labelBg: "#FAF8FC",
    dispenserColor: "#B6A7C3",
    capType: "disc-cap",
    accentMood: "Lavender Stone"
  },

  // ==========================================
  // SERUMS (6) - Glass Dropper Bottles (30 ml)
  // ==========================================
  {
    id: "vitamin-c-serum",
    filename: "serums/vitamin-c-serum.svg",
    category: "serums",
    type: "dropper-glass",
    title: "VITAMIN C SERUM",
    subtitle: "Radiance Morning Complex",
    spec: "30 ml • 1.0 fl. oz.",
    bgStart: "#FCF7EE",
    bgEnd: "#EFE2CC",
    bottleColor: "#B86A20", // Amber glass
    bottleColor2: "#6B380A",
    liquidColor: "#E28E2B",
    accentColor: "#B86A20",
    labelBg: "#FFFDF8",
    pipetteCap: "#1E1A17",
    pipetteCollar: "#D4AF37", // Gold collar
    accentMood: "Solar Amber"
  },
  {
    id: "hyaluronic-serum",
    filename: "serums/hyaluronic-serum.svg",
    category: "serums",
    type: "dropper-glass",
    title: "HYALURONIC SERUM",
    subtitle: "Deep Moisture Hydration",
    spec: "30 ml • 1.0 fl. oz.",
    bgStart: "#F0F7FB",
    bgEnd: "#D8E9F3",
    bottleColor: "#E4F0F7", // Frosted clear
    bottleColor2: "#B9D8E9",
    liquidColor: "#6BB1D8",
    accentColor: "#3F82A6",
    labelBg: "#FFFFFF",
    pipetteCap: "#FFFFFF",
    pipetteCollar: "#C4D6E0",
    accentMood: "Frosted Crystal"
  },
  {
    id: "niacinamide-serum",
    filename: "serums/niacinamide-serum.svg",
    category: "serums",
    type: "dropper-glass",
    title: "NIACINAMIDE SERUM",
    subtitle: "Clarifying Texture Complex",
    spec: "30 ml • 1.0 fl. oz.",
    bgStart: "#F2F7F4",
    bgEnd: "#DCEAE1",
    bottleColor: "#E9F2EC", // Opalized mint
    bottleColor2: "#C5DCCF",
    liquidColor: "#7EA98F",
    accentColor: "#577E66",
    labelBg: "#FFFFFF",
    pipetteCap: "#FFFFFF",
    pipetteCollar: "#8BAF99",
    accentMood: "Opal Sage"
  },
  {
    id: "peptide-serum",
    filename: "serums/peptide-serum.svg",
    category: "serums",
    type: "dropper-glass",
    title: "PEPTIDE SERUM",
    subtitle: "Cellular Renewal Therapy",
    spec: "30 ml • 1.0 fl. oz.",
    bgStart: "#F6F3ED",
    bgEnd: "#E3DCCD",
    bottleColor: "#38312B", // Smoked obsidian
    bottleColor2: "#1F1A16",
    liquidColor: "#C9AA71",
    accentColor: "#B89658",
    labelBg: "#FFFDF9",
    pipetteCap: "#1E1A17",
    pipetteCollar: "#C7A762",
    accentMood: "Midnight Champagne"
  },
  {
    id: "hydration-drops",
    filename: "serums/hydration-drops.svg",
    category: "serums",
    type: "dropper-glass",
    title: "HYDRATION DROPS",
    subtitle: "Weightless Barrier Infusion",
    spec: "30 ml • 1.0 fl. oz.",
    bgStart: "#EFF8F9",
    bgEnd: "#D4EDF0",
    bottleColor: "#DBF0F2",
    bottleColor2: "#A5D6DC",
    liquidColor: "#4FB0BD",
    accentColor: "#378A96",
    labelBg: "#FFFFFF",
    pipetteCap: "#FFFFFF",
    pipetteCollar: "#8AC3CA",
    accentMood: "Muted Aqua"
  },
  {
    id: "night-repair-serum",
    filename: "serums/night-repair-serum.svg",
    category: "serums",
    type: "dropper-glass",
    title: "NIGHT REPAIR SERUM",
    subtitle: "Overnight Restorative Elixir",
    spec: "30 ml • 1.0 fl. oz.",
    bgStart: "#F4F1F8",
    bgEnd: "#DED7E9",
    bottleColor: "#3B2D4A", // Amethyst deep glass
    bottleColor2: "#20172B",
    liquidColor: "#9377B3",
    accentColor: "#7B5E99",
    labelBg: "#FFFDFD",
    pipetteCap: "#1E1825",
    pipetteCollar: "#C4A265",
    accentMood: "Twilight Amethyst"
  },

  // ==========================================
  // MOISTURIZERS (6) - Luxury Jars & Lotions
  // ==========================================
  {
    id: "daily-dew-cream",
    filename: "moisturizers/daily-dew-cream.svg",
    category: "moisturizers",
    type: "jar",
    title: "DAILY DEW CREAM",
    subtitle: "Fresh Dewy Glow Complex",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#FAF4F3",
    bgEnd: "#EFE0DD",
    bottleColor: "#FBF3F0",
    bottleColor2: "#ECD4CD",
    accentColor: "#BA7A70",
    lidColor: "#E2B7AF",
    labelBg: "#FFF9F8",
    accentMood: "Blush Peony"
  },
  {
    id: "barrier-comfort-cream",
    filename: "moisturizers/barrier-comfort-cream.svg",
    category: "moisturizers",
    type: "jar",
    title: "BARRIER COMFORT",
    subtitle: "Deep Moisture Lipid Balm",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#F8F4EE",
    bgEnd: "#E7DCcb".toUpperCase(),
    bgEnd: "#E7DCCB",
    bottleColor: "#F4EDE1",
    bottleColor2: "#DECDB7",
    accentColor: "#9A7144",
    lidColor: "#C9A780",
    labelBg: "#FFFDF9",
    accentMood: "Warm Ochre"
  },
  {
    id: "aqua-gel-moisturizer",
    filename: "moisturizers/aqua-gel-moisturizer.svg",
    category: "moisturizers",
    type: "jar",
    title: "AQUA GEL MOISTURIZER",
    subtitle: "Weightless Water Matrix",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#EFF7F8",
    bgEnd: "#D7EBEF",
    bottleColor: "#DEF0F3",
    bottleColor2: "#B0DCE2",
    accentColor: "#398D9E",
    lidColor: "#8BC8D1",
    labelBg: "#FFFFFF",
    accentMood: "Glacial Fresh"
  },
  {
    id: "rich-night-cream",
    filename: "moisturizers/rich-night-cream.svg",
    category: "moisturizers",
    type: "jar",
    title: "RICH NIGHT CREAM",
    subtitle: "Nourishing Night Care Ritual",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#F6F1EB",
    bgEnd: "#E0D4C5",
    bottleColor: "#422817", // Amber glass jar
    bottleColor2: "#241308",
    accentColor: "#BD8C55",
    lidColor: "#1A1613", // Black matte lid
    labelBg: "#FFFDF9",
    accentMood: "Apothecary Amber"
  },
  {
    id: "lightweight-lotion",
    filename: "moisturizers/lightweight-lotion.svg",
    category: "moisturizers",
    type: "lotion-cylinder",
    title: "LIGHTWEIGHT LOTION",
    subtitle: "Daily Moisture Emulsion",
    spec: "100 ml • 3.4 fl. oz.",
    bgStart: "#F9F6F1",
    bgEnd: "#E9DFCE",
    bottleColor: "#F5ECE0",
    bottleColor2: "#DFCFB9",
    accentColor: "#947648",
    dispenserColor: "#C2A77E",
    labelBg: "#FFFDF9",
    capType: "lotion-pump",
    accentMood: "Almond Cashmere"
  },
  {
    id: "ceramide-moisturizer",
    filename: "moisturizers/ceramide-moisturizer.svg",
    category: "moisturizers",
    type: "jar",
    title: "CERAMIDE MOISTURIZER",
    subtitle: "Essential Barrier Therapy",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#F3F7F2",
    bgEnd: "#DCE8DA",
    bottleColor: "#E2ECE0",
    bottleColor2: "#C3D6BF",
    accentColor: "#577752",
    lidColor: "#9BB896",
    labelBg: "#FAFCF9",
    accentMood: "French Sage"
  },

  // ==========================================
  // SUNSCREENS (6) - Cosmetic Tubes & Fluids
  // ==========================================
  {
    id: "daily-spf50-sunscreen",
    filename: "sunscreens/daily-spf50-sunscreen.svg",
    category: "sunscreens",
    type: "sun-tube",
    title: "DAILY SPF 50",
    subtitle: "Broad Spectrum Concept",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#FCF8ED",
    bgEnd: "#EFE2C2",
    bottleColor: "#FBF5E5",
    bottleColor2: "#EBDDB7",
    accentColor: "#B58428",
    dispenserColor: "#D6AF5C",
    labelBg: "#FFFDF7",
    accentMood: "Solar Warmth"
  },
  {
    id: "matte-finish-sunscreen",
    filename: "sunscreens/matte-finish-sunscreen.svg",
    category: "sunscreens",
    type: "sun-tube",
    title: "MATTE FINISH",
    subtitle: "Zero-Shine Sun Veil",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#F8F4EE",
    bgEnd: "#E8DEC9",
    bottleColor: "#F3EBDD",
    bottleColor2: "#DBCBB4",
    accentColor: "#966C3E",
    dispenserColor: "#BD976C",
    labelBg: "#FFFDF9",
    accentMood: "Desert Dune"
  },
  {
    id: "aqua-shield-sunscreen",
    filename: "sunscreens/aqua-shield-sunscreen.svg",
    category: "sunscreens",
    type: "sun-tube",
    title: "AQUA SHIELD",
    subtitle: "Hydrating Sun Gel-Cream",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#EFF8FA",
    bgEnd: "#D7EDF2",
    bottleColor: "#E1F2F6",
    bottleColor2: "#BCE0E7",
    accentColor: "#398B99",
    dispenserColor: "#74B9C4",
    labelBg: "#FAFEFF",
    accentMood: "Aqua Marine"
  },
  {
    id: "daily-sun-fluid",
    filename: "sunscreens/daily-sun-fluid.svg",
    category: "sunscreens",
    type: "shake-fluid",
    title: "DAILY SUN FLUID",
    subtitle: "Ultra-Light Shake Fluid",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#F9F6F0",
    bgEnd: "#E7DDCA",
    bottleColor: "#F7EFE1",
    bottleColor2: "#D9C6A7",
    accentColor: "#8D6E46",
    dispenserColor: "#BBA17F",
    labelBg: "#FFFDF9",
    accentMood: "Sandstone Beige"
  },
  {
    id: "lightweight-sun-gel",
    filename: "sunscreens/lightweight-sun-gel.svg",
    category: "sunscreens",
    type: "sun-tube",
    title: "LIGHTWEIGHT SUN GEL",
    subtitle: "Weightless Invisible Shield",
    spec: "50 ml • 1.7 fl. oz.",
    bgStart: "#F4F8F1",
    bgEnd: "#DAE8D3",
    bottleColor: "#E6F0E1",
    bottleColor2: "#C5DBC0",
    accentColor: "#577B4F",
    dispenserColor: "#8EB386",
    labelBg: "#FAFCF9",
    accentMood: "Mineral Olive"
  },
  {
    id: "sun-protection-cream",
    filename: "sunscreens/sun-protection-cream.svg",
    category: "sunscreens",
    type: "sun-tube",
    title: "SUN PROTECTION CREAM",
    subtitle: "Nourishing Comfort Defense",
    spec: "75 ml • 2.5 fl. oz.",
    bgStart: "#FAF4F3",
    bgEnd: "#ECE0DD",
    bottleColor: "#F9ECE9",
    bottleColor2: "#E6D1CC",
    accentColor: "#B5736A",
    dispenserColor: "#D69F97",
    labelBg: "#FFF9F8",
    accentMood: "Rose Cashmere"
  }
];

// Generator for SVG markup
function buildSvg(p) {
  const uid = p.id.replace(/-/g, "_");

  // Shared gradients and shadows
  const defs = `
    <defs>
      <!-- Studio Lighting Background -->
      <linearGradient id="bgGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.bgStart}" />
        <stop offset="60%" stop-color="${p.bgStart}" />
        <stop offset="100%" stop-color="${p.bgEnd}" />
      </linearGradient>

      <!-- Radial Studio Ambient Light -->
      <radialGradient id="studioLight_${uid}" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.75" />
        <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.1" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.04" />
      </radialGradient>

      <!-- Soft Ground Shadow -->
      <radialGradient id="groundShadow_${uid}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1A1816" stop-opacity="0.25" />
        <stop offset="50%" stop-color="#1A1816" stop-opacity="0.10" />
        <stop offset="100%" stop-color="#1A1816" stop-opacity="0" />
      </radialGradient>

      <!-- Packaging Body Gradient -->
      <linearGradient id="bodyGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${p.bottleColor2}" />
        <stop offset="15%" stop-color="${p.bottleColor}" />
        <stop offset="45%" stop-color="#FFFFFF" stop-opacity="0.6" />
        <stop offset="70%" stop-color="${p.bottleColor}" />
        <stop offset="100%" stop-color="${p.bottleColor2}" />
      </linearGradient>

      <!-- Highlight Streak -->
      <linearGradient id="highlightGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0" />
        <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.65" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
      </linearGradient>

      <!-- Metallic / Accent Gradient -->
      <linearGradient id="metalGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${p.accentColor}" stop-opacity="0.8" />
        <stop offset="35%" stop-color="#FFFFFF" stop-opacity="0.7" />
        <stop offset="65%" stop-color="${p.accentColor}" />
        <stop offset="100%" stop-color="${p.accentColor}" stop-opacity="0.6" />
      </linearGradient>
    </defs>
  `;

  let packagingVisual = "";

  // 1. DROPPER GLASS (Serums)
  if (p.type === "dropper-glass") {
    packagingVisual = `
      <!-- Dropper Glass Silhouette -->
      <!-- Ground Shadow -->
      <ellipse cx="250" cy="445" rx="100" ry="20" fill="url(#groundShadow_${uid})" />

      <!-- Bottle Body -->
      <rect x="180" y="210" width="140" height="210" rx="20" fill="url(#bodyGrad_${uid})" />
      
      <!-- Liquid Level Line -->
      <path d="M 183 260 Q 250 268 317 260 L 317 410 Q 317 418 310 418 L 190 418 Q 183 418 183 410 Z" fill="${p.liquidColor}" opacity="0.35" />

      <!-- Internal Glass Pipette -->
      <rect x="246" y="160" width="8" height="230" rx="3" fill="#FFFFFF" opacity="0.5" />
      <circle cx="250" cy="390" r="6" fill="#FFFFFF" opacity="0.7" />

      <!-- Specular Highlight Left & Right -->
      <rect x="188" y="220" width="8" height="190" rx="4" fill="url(#highlightGrad_${uid})" />
      <rect x="304" y="220" width="6" height="190" rx="3" fill="#FFFFFF" opacity="0.25" />

      <!-- Bottle Curved Shoulder -->
      <path d="M 180 220 Q 180 185 220 180 L 280 180 Q 320 185 320 220 Z" fill="url(#bodyGrad_${uid})" />

      <!-- Neck & Pipette Collar -->
      <rect x="225" y="155" width="50" height="28" rx="3" fill="url(#metalGrad_${uid})" />
      <line x1="225" y1="162" x2="275" y2="162" stroke="#FFFFFF" stroke-width="1" opacity="0.6" />
      <line x1="225" y1="175" x2="275" y2="175" stroke="#000000" stroke-width="0.8" opacity="0.2" />

      <!-- Rubber Dropper Bulb -->
      <path d="M 233 155 Q 230 110 250 100 Q 270 110 267 155 Z" fill="${p.pipetteCap}" />
      <!-- Dropper Bulb Highlight -->
      <path d="M 239 150 Q 238 120 250 108" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.4" />

      <!-- Minimalist Luxury Label -->
      <g transform="translate(192, 255)">
        <!-- Label Base Plaque -->
        <rect x="0" y="0" width="116" height="135" rx="3" fill="${p.labelBg}" stroke="${p.accentColor}" stroke-width="0.6" />
        
        <!-- Subtle Inner Border -->
        <rect x="4" y="4" width="108" height="127" rx="2" fill="none" stroke="${p.accentColor}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.6" />

        <!-- Brand Name -->
        <text x="58" y="28" font-family="Georgia, 'Times New Roman', serif" font-size="14" font-weight="700" letter-spacing="4" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="42" y1="36" x2="74" y2="36" stroke="${p.accentColor}" stroke-width="0.8" />

        <!-- Product Name -->
        <text x="58" y="56" font-family="'Helvetica Neue', Arial, sans-serif" font-size="8.5" font-weight="700" letter-spacing="1.5" fill="#2B2620" text-anchor="middle">${esc(p.title)}</text>
        
        <!-- Category / Subtitle -->
        <text x="58" y="73" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" font-weight="500" letter-spacing="0.8" fill="${p.accentColor}" text-anchor="middle">${esc(p.subtitle)}</text>

        <!-- Graphic Motif Icon -->
        <circle cx="58" cy="92" r="7" fill="none" stroke="${p.accentColor}" stroke-width="0.7" />
        <circle cx="58" cy="92" r="3" fill="${p.accentColor}" opacity="0.5" />

        <!-- Volume Spec -->
        <text x="58" y="116" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" letter-spacing="1" fill="#786F66" text-anchor="middle">${esc(p.spec)}</text>
      </g>
    `;
  }

  // 2. JAR (Moisturizers)
  else if (p.type === "jar") {
    packagingVisual = `
      <!-- Luxury Cream Jar Silhouette -->
      <!-- Ground Shadow -->
      <ellipse cx="250" cy="440" rx="120" ry="22" fill="url(#groundShadow_${uid})" />

      <!-- Jar Body -->
      <rect x="155" y="275" width="190" height="135" rx="16" fill="url(#bodyGrad_${uid})" />

      <!-- Specular Highlight Left & Right -->
      <rect x="168" y="285" width="10" height="115" rx="5" fill="url(#highlightGrad_${uid})" />
      <rect x="322" y="285" width="7" height="115" rx="3.5" fill="#FFFFFF" opacity="0.25" />

      <!-- Jar Neck / Thread -->
      <rect x="165" y="258" width="170" height="20" rx="4" fill="${p.lidColor}" opacity="0.9" />

      <!-- Heavy Luxury Cap -->
      <rect x="150" y="200" width="200" height="65" rx="8" fill="${p.lidColor}" />
      <!-- Cap Top Bevel -->
      <rect x="154" y="202" width="192" height="12" rx="4" fill="#FFFFFF" opacity="0.3" />
      <line x1="150" y1="240" x2="350" y2="240" stroke="#000000" stroke-width="1" opacity="0.15" />
      <line x1="150" y1="242" x2="350" y2="242" stroke="#FFFFFF" stroke-width="0.8" opacity="0.3" />

      <!-- Cap Highlight -->
      <rect x="165" y="208" width="12" height="50" rx="4" fill="#FFFFFF" opacity="0.35" />

      <!-- Minimalist Front Label Band -->
      <g transform="translate(175, 295)">
        <rect x="0" y="0" width="150" height="95" rx="4" fill="${p.labelBg}" stroke="${p.accentColor}" stroke-width="0.6" />
        <rect x="5" y="5" width="140" height="85" rx="2" fill="none" stroke="${p.accentColor}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.5" />

        <!-- Brand -->
        <text x="75" y="26" font-family="Georgia, 'Times New Roman', serif" font-size="14" font-weight="700" letter-spacing="4" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="55" y1="33" x2="95" y2="33" stroke="${p.accentColor}" stroke-width="0.8" />

        <!-- Title -->
        <text x="75" y="50" font-family="'Helvetica Neue', Arial, sans-serif" font-size="8.5" font-weight="700" letter-spacing="1.2" fill="#2B2620" text-anchor="middle">${esc(p.title)}</text>
        
        <!-- Subtitle -->
        <text x="75" y="65" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6.5" font-weight="500" letter-spacing="0.8" fill="${p.accentColor}" text-anchor="middle">${esc(p.subtitle)}</text>

        <!-- Spec -->
        <text x="75" y="82" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" letter-spacing="1" fill="#786F66" text-anchor="middle">${esc(p.spec)}</text>
      </g>
    `;
  }

  // 3. PUMP CYLINDER / FOAMER (Cleansers)
  else if (p.type === "pump-cylinder" || p.type === "tall-dispenser" || p.type === "lotion-cylinder") {
    const isTall = p.type === "tall-dispenser" || p.type === "lotion-cylinder";
    const bodyY = isTall ? 190 : 215;
    const bodyH = isTall ? 230 : 205;
    const neckY = bodyY - 25;

    packagingVisual = `
      <!-- Cylindrical Dispenser Silhouette -->
      <!-- Ground Shadow -->
      <ellipse cx="250" cy="445" rx="100" ry="20" fill="url(#groundShadow_${uid})" />

      <!-- Bottle Body -->
      <rect x="175" y="${bodyY}" width="150" height="${bodyH}" rx="14" fill="url(#bodyGrad_${uid})" />

      <!-- Highlights -->
      <rect x="187" y="${bodyY + 12}" width="9" height="${bodyH - 24}" rx="4.5" fill="url(#highlightGrad_${uid})" />
      <rect x="306" y="${bodyY + 12}" width="6" height="${bodyH - 24}" rx="3" fill="#FFFFFF" opacity="0.25" />

      <!-- Shoulder Collar -->
      <path d="M 175 ${bodyY + 5} Q 175 ${bodyY - 10} 220 ${neckY + 5} L 280 ${neckY + 5} Q 325 ${bodyY - 10} 325 ${bodyY + 5} Z" fill="url(#bodyGrad_${uid})" />

      <!-- Neck Screw Ring -->
      <rect x="220" y="${neckY}" width="60" height="18" rx="2" fill="${p.dispenserColor}" />
      <line x1="220" y1="${neckY + 6}" x2="280" y2="${neckY + 6}" stroke="#FFFFFF" stroke-width="1" opacity="0.5" />

      <!-- Pump Head -->
      <!-- Pump Stem -->
      <rect x="242" y="${neckY - 30}" width="16" height="32" rx="1" fill="${p.dispenserColor}" />
      <!-- Pump Spout Top -->
      <path d="M 215 ${neckY - 45} L 275 ${neckY - 45} Q 285 ${neckY - 45} 285 ${neckY - 30} L 285 ${neckY - 25} L 215 ${neckY - 25} Q 195 ${neckY - 30} 195 ${neckY - 38} Q 195 ${neckY - 45} 215 ${neckY - 45} Z" fill="${p.dispenserColor}" />
      <!-- Pump Spout Lip -->
      <path d="M 195 ${neckY - 38} Q 190 ${neckY - 36} 190 ${neckY - 32} Q 195 ${neckY - 30} 205 ${neckY - 30}" fill="#555" opacity="0.3" />
      <rect x="225" y="${neckY - 42}" width="40" height="4" rx="2" fill="#FFFFFF" opacity="0.4" />

      <!-- Minimalist Luxury Front Label -->
      <g transform="translate(190, ${bodyY + 30})">
        <rect x="0" y="0" width="120" height="135" rx="3" fill="${p.labelBg}" stroke="${p.accentColor}" stroke-width="0.6" />
        <rect x="4" y="4" width="112" height="127" rx="2" fill="none" stroke="${p.accentColor}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.5" />

        <!-- Brand -->
        <text x="60" y="26" font-family="Georgia, 'Times New Roman', serif" font-size="14" font-weight="700" letter-spacing="4" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="44" y1="33" x2="76" y2="33" stroke="${p.accentColor}" stroke-width="0.8" />

        <!-- Title -->
        <text x="60" y="52" font-family="'Helvetica Neue', Arial, sans-serif" font-size="8" font-weight="700" letter-spacing="1.2" fill="#2B2620" text-anchor="middle">${esc(p.title)}</text>
        
        <!-- Subtitle -->
        <text x="60" y="68" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" font-weight="500" letter-spacing="0.7" fill="${p.accentColor}" text-anchor="middle">${esc(p.subtitle)}</text>

        <!-- Crest -->
        <circle cx="60" cy="88" r="7" fill="none" stroke="${p.accentColor}" stroke-width="0.7" />
        <circle cx="60" cy="88" r="3" fill="${p.accentColor}" opacity="0.5" />

        <!-- Spec -->
        <text x="60" y="112" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" letter-spacing="1" fill="#786F66" text-anchor="middle">${esc(p.spec)}</text>
      </g>
    `;
  }

  // 4. COSMETIC SQUEEZE TUBE (Cleansers & Sunscreens)
  else if (p.type === "tube" || p.type === "sun-tube") {
    packagingVisual = `
      <!-- Cosmetic Squeeze Tube Silhouette -->
      <!-- Ground Shadow -->
      <ellipse cx="250" cy="445" rx="95" ry="18" fill="url(#groundShadow_${uid})" />

      <!-- Inverted Stand-up Tube Base Cap -->
      <rect x="200" y="380" width="100" height="48" rx="6" fill="${p.dispenserColor || p.accentColor}" />
      <rect x="202" y="382" width="96" height="6" rx="2" fill="#FFFFFF" opacity="0.3" />
      <line x1="200" y1="400" x2="300" y2="400" stroke="#000000" stroke-width="0.8" opacity="0.15" />

      <!-- Tube Body (Tapers toward cap at bottom, crimped at top) -->
      <path d="M 175 140 L 325 140 L 295 382 L 205 382 Z" fill="url(#bodyGrad_${uid})" />

      <!-- Top Crimped Seal Bar -->
      <rect x="173" y="128" width="154" height="14" rx="2" fill="${p.bottleColor2}" />
      <!-- Crimp Ridges -->
      <line x1="180" y1="131" x2="180" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="190" y1="131" x2="190" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="200" y1="131" x2="200" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="210" y1="131" x2="210" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="220" y1="131" x2="220" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="230" y1="131" x2="230" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="240" y1="131" x2="240" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="250" y1="131" x2="250" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="260" y1="131" x2="260" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="270" y1="131" x2="270" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="280" y1="131" x2="280" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="290" y1="131" x2="290" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="300" y1="131" x2="300" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="310" y1="131" x2="310" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />
      <line x1="320" y1="131" x2="320" y2="139" stroke="#999" stroke-width="1" opacity="0.5" />

      <!-- Left Light Curved Highlight -->
      <path d="M 185 150 L 213 375" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.4" />
      <!-- Right Subtle Highlight -->
      <path d="M 315 150 L 288 375" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.2" />

      <!-- Direct Minimal Label on Tube -->
      <g transform="translate(190, 180)">
        <rect x="0" y="0" width="120" height="155" rx="3" fill="${p.labelBg}" stroke="${p.accentColor}" stroke-width="0.6" />
        <rect x="4" y="4" width="112" height="147" rx="2" fill="none" stroke="${p.accentColor}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.5" />

        <!-- Brand -->
        <text x="60" y="30" font-family="Georgia, 'Times New Roman', serif" font-size="15" font-weight="700" letter-spacing="4" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="42" y1="38" x2="78" y2="38" stroke="${p.accentColor}" stroke-width="0.8" />

        <!-- Title -->
        <text x="60" y="58" font-family="'Helvetica Neue', Arial, sans-serif" font-size="8.5" font-weight="700" letter-spacing="1.2" fill="#2B2620" text-anchor="middle">${esc(p.title)}</text>
        
        <!-- Subtitle -->
        <text x="60" y="76" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" font-weight="500" letter-spacing="0.7" fill="${p.accentColor}" text-anchor="middle">${esc(p.subtitle)}</text>

        <!-- Sun Emblem / Cosmetic Crest -->
        <circle cx="60" cy="100" r="10" fill="none" stroke="${p.accentColor}" stroke-width="0.7" />
        <circle cx="60" cy="100" r="5" fill="${p.accentColor}" opacity="0.5" />
        ${
          p.category === "sunscreens"
            ? `
          <line x1="60" y1="86" x2="60" y2="89" stroke="${p.accentColor}" stroke-width="0.8" />
          <line x1="60" y1="111" x2="60" y2="114" stroke="${p.accentColor}" stroke-width="0.8" />
          <line x1="46" y1="100" x2="49" y2="100" stroke="${p.accentColor}" stroke-width="0.8" />
          <line x1="71" y1="100" x2="74" y2="100" stroke="${p.accentColor}" stroke-width="0.8" />
        `
            : ""
        }

        <!-- Spec -->
        <text x="60" y="132" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" letter-spacing="1" fill="#786F66" text-anchor="middle">${esc(p.spec)}</text>
      </g>
    `;
  }

  // 5. SHAKE FLUID (Sunscreens)
  else if (p.type === "shake-fluid") {
    packagingVisual = `
      <!-- Ergonomic Shake Sun Fluid Silhouette -->
      <!-- Ground Shadow -->
      <ellipse cx="250" cy="445" rx="90" ry="18" fill="url(#groundShadow_${uid})" />

      <!-- Bottle Body (Pebble-shaped curved silhouette) -->
      <path d="M 185 220 C 170 270 170 370 185 410 C 200 430 300 430 315 410 C 330 370 330 270 315 220 C 300 190 200 190 185 220 Z" fill="url(#bodyGrad_${uid})" />

      <!-- Specular Highlights -->
      <path d="M 195 230 C 185 270 185 360 195 395" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.4" />
      <path d="M 305 230 C 315 270 315 360 305 395" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.2" />

      <!-- Precision Nozzle Cap -->
      <path d="M 230 195 L 270 195 L 265 140 L 235 140 Z" fill="${p.dispenserColor}" />
      <rect x="233" y="140" width="34" height="4" rx="2" fill="#FFFFFF" opacity="0.4" />
      <circle cx="250" cy="138" r="3" fill="#333" opacity="0.3" />

      <!-- Front Minimalist Brand Plaque -->
      <g transform="translate(192, 235)">
        <rect x="0" y="0" width="116" height="145" rx="4" fill="${p.labelBg}" stroke="${p.accentColor}" stroke-width="0.6" />
        <rect x="4" y="4" width="108" height="137" rx="2" fill="none" stroke="${p.accentColor}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.5" />

        <!-- Brand -->
        <text x="58" y="28" font-family="Georgia, 'Times New Roman', serif" font-size="14" font-weight="700" letter-spacing="4" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="40" y1="36" x2="76" y2="36" stroke="${p.accentColor}" stroke-width="0.8" />

        <!-- Title -->
        <text x="58" y="55" font-family="'Helvetica Neue', Arial, sans-serif" font-size="8" font-weight="700" letter-spacing="1.2" fill="#2B2620" text-anchor="middle">${esc(p.title)}</text>
        
        <!-- Subtitle -->
        <text x="58" y="72" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" font-weight="500" letter-spacing="0.7" fill="${p.accentColor}" text-anchor="middle">${esc(p.subtitle)}</text>

        <!-- Shake Fluid Icon -->
        <circle cx="58" cy="94" r="8" fill="none" stroke="${p.accentColor}" stroke-width="0.7" />
        <path d="M 54 94 Q 58 90 62 94 Q 58 98 54 94" fill="${p.accentColor}" opacity="0.6" />

        <!-- Spec -->
        <text x="58" y="122" font-family="'Helvetica Neue', Arial, sans-serif" font-size="6" letter-spacing="1" fill="#786F66" text-anchor="middle">${esc(p.spec)}</text>
      </g>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  ${defs}
  <!-- Studio Background Canvas -->
  <rect width="500" height="500" fill="url(#bgGrad_${uid})" />
  <rect width="500" height="500" fill="url(#studioLight_${uid})" />

  <!-- Subtle Studio Accent Glow -->
  <circle cx="250" cy="270" r="180" fill="${p.accentColor}" opacity="0.08" />

  <!-- Product Silhouette & Details -->
  ${packagingVisual}
</svg>`;
}

// Generate all 24 image files
let generatedCount = 0;
for (const p of products) {
  const filePath = path.join(outputDir, p.filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const svgContent = buildSvg(p);
  fs.writeFileSync(filePath, svgContent, "utf8");
  generatedCount++;
}

console.log(`Successfully generated ${generatedCount} SOLE product SVG assets!`);
