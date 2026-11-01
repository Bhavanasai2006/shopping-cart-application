const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const brainDir = "C:\\Users\\subhi\\.gemini\\antigravity-ide\\brain\\470738c1-acf3-405e-a4a6-c69ffb9c1785";
const publicDir = path.join(__dirname, "..", "public", "product-images");

// Base authentic studio photograph plate for background extraction
const basePlatePath = path.join(brainDir, "preview_cleanser_1793517874024.jpg");

// Remaining 11 products to composite onto authentic studio background
const remainingProducts = [
  // Serums (1 remaining)
  {
    dest: "serums/night-repair-serum.webp",
    type: "dropper-glass",
    title: "NIGHT REPAIR",
    subtitle: "Overnight Elixir",
    spec: "30 mL",
    glassColor1: "#2B1D38", // Deep amethyst royal violet
    glassColor2: "#180F21",
    liquidHighlight: "#8C6A9E",
    collarColor: "#D4AF37", // Polished gold
    bulbColor: "#18141C",
    accentColor: "#6B497D"
  },

  // Moisturizers (5 remaining)
  {
    dest: "moisturizers/barrier-comfort-cream.webp",
    type: "jar",
    title: "BARRIER COMFORT",
    subtitle: "Deep Moisture Balm",
    spec: "50 mL",
    jarColor1: "#F3EDE3",
    jarColor2: "#DED3C3",
    lidColor: "#C2A88A", // Warm natural beige cap
    accentColor: "#8C6947"
  },
  {
    dest: "moisturizers/aqua-gel-moisturizer.webp",
    type: "jar",
    title: "AQUA GEL",
    subtitle: "Weightless Hydrator",
    spec: "50 mL",
    jarColor1: "#DDF1F5",
    jarColor2: "#B0DCE2",
    lidColor: "#7ABCC7", // Translucent aqua cap
    accentColor: "#398B99"
  },
  {
    dest: "moisturizers/rich-night-cream.webp",
    type: "jar",
    title: "RICH NIGHT CREAM",
    subtitle: "Overnight Ritual",
    spec: "50 mL",
    jarColor1: "#402615", // Dark apothecary amber glass jar
    jarColor2: "#201208",
    lidColor: "#1E1A17", // Matte black lid
    accentColor: "#B5844E"
  },
  {
    dest: "moisturizers/lightweight-lotion.webp",
    type: "lotion-bottle",
    title: "LIGHTWEIGHT LOTION",
    subtitle: "Daily Moisture Emulsion",
    spec: "100 mL",
    bottleColor1: "#F7F1E7",
    bottleColor2: "#E5DACB",
    pumpColor: "#C7A97E", // Champagne gold pump
    accentColor: "#8F7449"
  },
  {
    dest: "moisturizers/ceramide-moisturizer.webp",
    type: "jar",
    title: "CERAMIDE REPAIR",
    subtitle: "Lipid Moisture Shield",
    spec: "50 mL",
    jarColor1: "#E2ECE0",
    jarColor2: "#C3D6BF",
    lidColor: "#8CAE88", // French sage soft lid
    accentColor: "#577B51"
  },

  // Sunscreens (5 remaining)
  {
    dest: "sunscreens/matte-finish-sunscreen.webp",
    type: "sun-tube",
    title: "MATTE FINISH",
    subtitle: "Zero-Shine Sun Veil",
    spec: "50 mL",
    tubeColor1: "#F3EBDD",
    tubeColor2: "#DDD0BD",
    capColor: "#A67C52", // Warm ochre cap
    accentColor: "#8C6339"
  },
  {
    dest: "sunscreens/aqua-shield-sunscreen.webp",
    type: "sun-tube",
    title: "AQUA SHIELD",
    subtitle: "Hydrating Sun Gel-Cream",
    spec: "50 mL",
    tubeColor1: "#E4F2F6",
    tubeColor2: "#BFE2E8",
    capColor: "#5EA9B6", // Soft aqua cap
    accentColor: "#328491"
  },
  {
    dest: "sunscreens/daily-sun-fluid.webp",
    type: "fluid-bottle",
    title: "DAILY SUN FLUID",
    subtitle: "Ultra-Light Shake Fluid",
    spec: "50 mL",
    bottleColor1: "#F5EDE0",
    bottleColor2: "#E0D1BF",
    capColor: "#9E815F", // Warm sand cap
    accentColor: "#7D6242"
  },
  {
    dest: "sunscreens/lightweight-sun-gel.webp",
    type: "sun-tube",
    title: "LIGHTWEIGHT SUN GEL",
    subtitle: "Invisible Sun Shield",
    spec: "50 mL",
    tubeColor1: "#E8F2E4",
    tubeColor2: "#C7DDC2",
    capColor: "#729669", // Fresh olive-sage cap
    accentColor: "#4E7045"
  },
  {
    dest: "sunscreens/sun-protection-cream.webp",
    type: "sun-tube",
    title: "SUN PROTECTION",
    subtitle: "Comfort Defense Cream",
    spec: "75 mL",
    tubeColor1: "#F7ECE8",
    tubeColor2: "#E5D2CD",
    capColor: "#B87F77", // Rose gold muted cap
    accentColor: "#9E645C"
  }
];

function buildPhotorealisticOverlaySvg(p) {
  const uid = path.basename(p.dest, ".webp").replace(/-/g, "_");

  let productMarkup = "";

  // 1. DROPPER GLASS (Serums)
  if (p.type === "dropper-glass") {
    productMarkup = `
      <!-- Deep Realistic Contact Shadow on stone surface -->
      <ellipse cx="512" cy="880" rx="200" ry="32" fill="#1A1510" opacity="0.45" filter="url(#shadowBlur_${uid})" />
      <ellipse cx="512" cy="875" rx="140" ry="18" fill="#0D0A08" opacity="0.65" filter="url(#contactBlur_${uid})" />

      <!-- Amber/Amethyst Glass Bottle Body -->
      <rect x="360" y="420" width="304" height="440" rx="36" fill="url(#glassGrad_${uid})" />
      
      <!-- Internal Liquid Refraction -->
      <rect x="372" y="440" width="280" height="404" rx="28" fill="${p.liquidHighlight}" opacity="0.25" />
      
      <!-- Internal Pipette Glass Tube -->
      <rect x="504" y="320" width="16" height="490" rx="6" fill="#FFFFFF" opacity="0.55" />
      <circle cx="512" cy="815" r="10" fill="#FFFFFF" opacity="0.75" />

      <!-- Left Specular Studio Light Reflection -->
      <path d="M 374 445 L 374 840" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" opacity="0.5" filter="url(#highlightBlur_${uid})" />
      <path d="M 390 445 L 390 840" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.3" />

      <!-- Right Diffuse Edge Highlight -->
      <path d="M 650 445 L 650 840" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.25" />

      <!-- Bottle Curved Shoulder -->
      <path d="M 360 445 C 360 375 440 365 440 365 L 584 365 C 584 365 664 375 664 445 Z" fill="url(#glassGrad_${uid})" />

      <!-- Polished Gold / Metallic Collar -->
      <rect x="452" y="310" width="120" height="60" rx="6" fill="url(#collarGrad_${uid})" />
      <line x1="452" y1="324" x2="572" y2="324" stroke="#FFFFFF" stroke-width="2" opacity="0.7" />
      <line x1="452" y1="352" x2="572" y2="352" stroke="#000000" stroke-width="1.5" opacity="0.25" />

      <!-- Rubber Dropper Bulb -->
      <path d="M 468 310 C 462 210 500 190 512 190 C 524 190 562 210 556 310 Z" fill="${p.bulbColor}" />
      <!-- Bulb Studio Light Highlight -->
      <path d="M 480 300 C 478 235 500 205 512 205" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="0.4" />

      <!-- Premium Front Minimalist Label -->
      <g transform="translate(388, 510)">
        <rect x="0" y="0" width="248" height="295" rx="6" fill="#FBF8F2" stroke="${p.accentColor}" stroke-width="1.2" filter="url(#labelShadow_${uid})" />
        <rect x="10" y="10" width="228" height="275" rx="4" fill="none" stroke="${p.accentColor}" stroke-width="0.8" opacity="0.6" />

        <!-- Leaf Motif -->
        <g transform="translate(124, 40) scale(0.95)" fill="${p.accentColor}">
          <path d="M 0 -10 C 8 -16 14 -8 0 8 C -14 -8 -8 -16 0 -10 Z" />
          <path d="M -4 -4 C -14 -12 -18 0 -4 4 Z" opacity="0.8" />
          <path d="M 4 -4 C 14 -12 18 0 4 4 Z" opacity="0.8" />
        </g>

        <!-- Brand Name -->
        <text x="124" y="88" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" letter-spacing="8" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="90" y1="102" x2="158" y2="102" stroke="${p.accentColor}" stroke-width="1.5" />

        <!-- Title -->
        <text x="124" y="148" font-family="'Helvetica Neue', Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#29221C" text-anchor="middle">${p.title}</text>
        
        <!-- Subtitle -->
        <text x="124" y="185" font-family="'Helvetica Neue', Arial, sans-serif" font-size="11.5" font-weight="500" letter-spacing="1.2" fill="${p.accentColor}" text-anchor="middle">${p.subtitle}</text>

        <!-- Wave / Crest Motif -->
        <path d="M 104 220 C 114 212 134 228 144 220" stroke="${p.accentColor}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.75" />

        <!-- Volume Spec -->
        <text x="124" y="260" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10.5" letter-spacing="1.5" fill="#756A5E" text-anchor="middle">${p.spec}</text>
      </g>
    `;
  }

  // 2. JAR (Moisturizers)
  else if (p.type === "jar") {
    productMarkup = `
      <!-- Contact Shadow on stone surface -->
      <ellipse cx="512" cy="880" rx="260" ry="36" fill="#1A1510" opacity="0.45" filter="url(#shadowBlur_${uid})" />
      <ellipse cx="512" cy="874" rx="200" ry="20" fill="#0D0A08" opacity="0.65" filter="url(#contactBlur_${uid})" />

      <!-- Jar Body -->
      <rect x="312" y="550" width="400" height="315" rx="28" fill="url(#jarGrad_${uid})" />

      <!-- Left Specular Highlight -->
      <path d="M 335 570 L 335 840" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" opacity="0.45" filter="url(#highlightBlur_${uid})" />
      <!-- Right Specular Edge -->
      <path d="M 688 570 L 688 840" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.25" />

      <!-- Heavy Luxury Screw Lid -->
      <rect x="296" y="395" width="432" height="165" rx="18" fill="url(#lidGrad_${uid})" />
      <!-- Lid Top Bevel / Lip -->
      <rect x="304" y="400" width="416" height="24" rx="8" fill="#FFFFFF" opacity="0.35" />
      <line x1="296" y1="480" x2="728" y2="480" stroke="#000000" stroke-width="2" opacity="0.18" />
      <line x1="296" y1="483" x2="728" y2="483" stroke="#FFFFFF" stroke-width="1.5" opacity="0.35" />

      <!-- Lid Specular Highlight -->
      <rect x="330" y="415" width="20" height="125" rx="8" fill="#FFFFFF" opacity="0.4" />

      <!-- Front Minimalist Paper Label -->
      <g transform="translate(356, 590)">
        <rect x="0" y="0" width="312" height="235" rx="6" fill="#FBF8F2" stroke="${p.accentColor}" stroke-width="1.2" filter="url(#labelShadow_${uid})" />
        <rect x="10" y="10" width="292" height="215" rx="4" fill="none" stroke="${p.accentColor}" stroke-width="0.8" opacity="0.6" />

        <!-- Leaf Motif -->
        <g transform="translate(156, 36) scale(0.95)" fill="${p.accentColor}">
          <path d="M 0 -10 C 8 -16 14 -8 0 8 C -14 -8 -8 -16 0 -10 Z" />
          <path d="M -4 -4 C -14 -12 -18 0 -4 4 Z" opacity="0.8" />
          <path d="M 4 -4 C 14 -12 18 0 4 4 Z" opacity="0.8" />
        </g>

        <!-- Brand -->
        <text x="156" y="80" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" letter-spacing="8" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="120" y1="94" x2="192" y2="94" stroke="${p.accentColor}" stroke-width="1.5" />

        <!-- Title -->
        <text x="156" y="132" font-family="'Helvetica Neue', Arial, sans-serif" font-size="16.5" font-weight="700" letter-spacing="2" fill="#29221C" text-anchor="middle">${p.title}</text>
        
        <!-- Subtitle -->
        <text x="156" y="165" font-family="'Helvetica Neue', Arial, sans-serif" font-size="12" font-weight="500" letter-spacing="1.2" fill="${p.accentColor}" text-anchor="middle">${p.subtitle}</text>

        <!-- Volume Spec -->
        <text x="156" y="206" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10.5" letter-spacing="1.5" fill="#756A5E" text-anchor="middle">${p.spec}</text>
      </g>
    `;
  }

  // 3. COSMETIC TUBE (Sunscreens)
  else if (p.type === "sun-tube") {
    productMarkup = `
      <!-- Contact Shadow on stone surface -->
      <ellipse cx="512" cy="880" rx="200" ry="32" fill="#1A1510" opacity="0.45" filter="url(#shadowBlur_${uid})" />
      <ellipse cx="512" cy="874" rx="140" ry="18" fill="#0D0A08" opacity="0.65" filter="url(#contactBlur_${uid})" />

      <!-- Matte Cream Tube Body (Tapered) -->
      <path d="M 345 190 L 679 190 L 615 765 L 409 765 Z" fill="url(#tubeGrad_${uid})" />

      <!-- Top Crimped Seal Bar with ridges -->
      <rect x="340" y="168" width="344" height="26" rx="4" fill="${p.tubeColor2}" />
      ${Array.from({ length: 24 })
        .map(
          (_, i) =>
            `<line x1="${355 + i * 13}" y1="172" x2="${355 + i * 13}" y2="190" stroke="#777" stroke-width="1.5" opacity="0.35" />`
        )
        .join("")}

      <!-- Soft Left Daylight Highlight on Tube -->
      <path d="M 370 205 L 425 750" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" opacity="0.4" filter="url(#highlightBlur_${uid})" />
      <!-- Soft Right Highlight -->
      <path d="M 655 205 L 600 750" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.2" />

      <!-- Subtle Embossed Wave Lines near lower body -->
      <path d="M 420 680 C 470 655 550 710 600 680" stroke="#FFFFFF" stroke-width="2" fill="none" opacity="0.35" />
      <path d="M 425 710 C 475 685 555 740 605 710" stroke="#FFFFFF" stroke-width="1.5" fill="none" opacity="0.25" />

      <!-- Stand-up Flip Cap at Base -->
      <rect x="400" y="760" width="224" height="110" rx="14" fill="${p.capColor}" />
      <rect x="404" y="764" width="216" height="12" rx="4" fill="#FFFFFF" opacity="0.3" />
      <line x1="400" y1="810" x2="624" y2="810" stroke="#000000" stroke-width="2" opacity="0.2" />
      <!-- Cap Finger Notch -->
      <path d="M 480 810 C 480 840 544 840 544 810 Z" fill="#000000" opacity="0.18" />

      <!-- Front Minimalist Paper Label -->
      <g transform="translate(382, 275)">
        <rect x="0" y="0" width="260" height="340" rx="6" fill="#FBF8F2" stroke="${p.accentColor}" stroke-width="1.2" filter="url(#labelShadow_${uid})" />
        <rect x="10" y="10" width="240" height="320" rx="4" fill="none" stroke="${p.accentColor}" stroke-width="0.8" opacity="0.6" />

        <!-- Leaf Motif -->
        <g transform="translate(130, 42) scale(0.95)" fill="${p.accentColor}">
          <path d="M 0 -10 C 8 -16 14 -8 0 8 C -14 -8 -8 -16 0 -10 Z" />
          <path d="M -4 -4 C -14 -12 -18 0 -4 4 Z" opacity="0.8" />
          <path d="M 4 -4 C 14 -12 18 0 4 4 Z" opacity="0.8" />
        </g>

        <!-- Brand -->
        <text x="130" y="92" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" letter-spacing="8" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="94" y1="106" x2="166" y2="106" stroke="${p.accentColor}" stroke-width="1.5" />

        <!-- Title -->
        <text x="130" y="156" font-family="'Helvetica Neue', Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#29221C" text-anchor="middle">${p.title}</text>
        
        <!-- Subtitle -->
        <text x="130" y="194" font-family="'Helvetica Neue', Arial, sans-serif" font-size="11.5" font-weight="500" letter-spacing="1.2" fill="${p.accentColor}" text-anchor="middle">${p.subtitle}</text>

        <!-- Sun Symbol -->
        <circle cx="130" cy="235" r="14" fill="none" stroke="${p.accentColor}" stroke-width="1.6" opacity="0.8" />
        <circle cx="130" cy="235" r="7" fill="${p.accentColor}" opacity="0.4" />

        <!-- Volume Spec -->
        <text x="130" y="295" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10.5" letter-spacing="1.5" fill="#756A5E" text-anchor="middle">${p.spec}</text>
      </g>
    `;
  }

  // 4. LOTION / FLUID BOTTLE
  else {
    productMarkup = `
      <!-- Contact Shadow -->
      <ellipse cx="512" cy="880" rx="180" ry="28" fill="#1A1510" opacity="0.45" filter="url(#shadowBlur_${uid})" />
      <ellipse cx="512" cy="874" rx="120" ry="16" fill="#0D0A08" opacity="0.65" filter="url(#contactBlur_${uid})" />

      <!-- Bottle Body -->
      <rect x="370" y="380" width="284" height="480" rx="28" fill="url(#tubeGrad_${uid})" />
      <path d="M 370 410 C 370 330 450 310 450 310 L 574 310 C 574 310 654 330 654 410 Z" fill="url(#tubeGrad_${uid})" />

      <!-- Specular Highlights -->
      <path d="M 390 395 L 390 835" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" opacity="0.45" filter="url(#highlightBlur_${uid})" />
      <path d="M 638 395 L 638 835" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.25" />

      <!-- Pump / Nozzle Top -->
      <rect x="460" y="250" width="104" height="65" rx="6" fill="${p.capColor || p.pumpColor}" />
      <rect x="440" y="195" width="144" height="58" rx="8" fill="${p.capColor || p.pumpColor}" />
      <rect x="446" y="200" width="132" height="8" rx="3" fill="#FFFFFF" opacity="0.35" />

      <!-- Front Minimalist Paper Label -->
      <g transform="translate(388, 460)">
        <rect x="0" y="0" width="248" height="320" rx="6" fill="#FBF8F2" stroke="${p.accentColor}" stroke-width="1.2" filter="url(#labelShadow_${uid})" />
        <rect x="10" y="10" width="228" height="300" rx="4" fill="none" stroke="${p.accentColor}" stroke-width="0.8" opacity="0.6" />

        <!-- Leaf Motif -->
        <g transform="translate(124, 42) scale(0.95)" fill="${p.accentColor}">
          <path d="M 0 -10 C 8 -16 14 -8 0 8 C -14 -8 -8 -16 0 -10 Z" />
          <path d="M -4 -4 C -14 -12 -18 0 -4 4 Z" opacity="0.8" />
          <path d="M 4 -4 C 14 -12 18 0 4 4 Z" opacity="0.8" />
        </g>

        <!-- Brand -->
        <text x="124" y="92" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" letter-spacing="8" fill="#241E19" text-anchor="middle">S O L E</text>
        <line x1="88" y1="106" x2="160" y2="106" stroke="${p.accentColor}" stroke-width="1.5" />

        <!-- Title -->
        <text x="124" y="156" font-family="'Helvetica Neue', Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="1.8" fill="#29221C" text-anchor="middle">${p.title}</text>
        
        <!-- Subtitle -->
        <text x="124" y="194" font-family="'Helvetica Neue', Arial, sans-serif" font-size="11.5" font-weight="500" letter-spacing="1.2" fill="${p.accentColor}" text-anchor="middle">${p.subtitle}</text>

        <!-- Spec -->
        <text x="124" y="275" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10.5" letter-spacing="1.5" fill="#756A5E" text-anchor="middle">${p.spec}</text>
      </g>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <defs>
      <filter id="shadowBlur_${uid}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
      <filter id="contactBlur_${uid}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="highlightBlur_${uid}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id="labelShadow_${uid}" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#1A1510" flood-opacity="0.15" />
      </filter>

      <!-- Glass Gradient -->
      <linearGradient id="glassGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${p.glassColor2 || '#2B1D38'}" />
        <stop offset="18%" stop-color="${p.glassColor1 || '#3E2A50'}" />
        <stop offset="48%" stop-color="#FFFFFF" stop-opacity="0.4" />
        <stop offset="78%" stop-color="${p.glassColor1 || '#3E2A50'}" />
        <stop offset="100%" stop-color="${p.glassColor2 || '#180F21'}" />
      </linearGradient>

      <!-- Collar Gradient -->
      <linearGradient id="collarGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#9E8224" />
        <stop offset="35%" stop-color="#FFF2A3" />
        <stop offset="65%" stop-color="#D4AF37" />
        <stop offset="100%" stop-color="#7A6419" />
      </linearGradient>

      <!-- Jar Gradient -->
      <linearGradient id="jarGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${p.jarColor2 || '#DED3C3'}" />
        <stop offset="15%" stop-color="${p.jarColor1 || '#F3EDE3'}" />
        <stop offset="48%" stop-color="#FFFFFF" stop-opacity="0.5" />
        <stop offset="78%" stop-color="${p.jarColor1 || '#F3EDE3'}" />
        <stop offset="100%" stop-color="${p.jarColor2 || '#DED3C3'}" />
      </linearGradient>

      <!-- Lid Gradient -->
      <linearGradient id="lidGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${p.lidColor || '#C2A88A'}" stop-opacity="0.85" />
        <stop offset="30%" stop-color="#FFFFFF" stop-opacity="0.35" />
        <stop offset="65%" stop-color="${p.lidColor || '#C2A88A'}" />
        <stop offset="100%" stop-color="${p.lidColor || '#C2A88A'}" stop-opacity="0.75" />
      </linearGradient>

      <!-- Tube Gradient -->
      <linearGradient id="tubeGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${p.tubeColor2 || p.bottleColor2 || '#DDD0BD'}" />
        <stop offset="18%" stop-color="${p.tubeColor1 || p.bottleColor1 || '#F3EBDD'}" />
        <stop offset="46%" stop-color="#FFFFFF" stop-opacity="0.45" />
        <stop offset="78%" stop-color="${p.tubeColor1 || p.bottleColor1 || '#F3EBDD'}" />
        <stop offset="100%" stop-color="${p.tubeColor2 || p.bottleColor2 || '#DDD0BD'}" />
      </linearGradient>
    </defs>

    ${productMarkup}
  </svg>`;
}

async function renderRemaining() {
  console.log("Compositing remaining 11 products onto authentic travertine studio background...");

  // 1. Create a clean studio background plate by cropping the background edges
  // and soft-cloning to create an immaculate travertine + botanical shadow studio background
  const bgBuffer = await sharp(basePlatePath)
    .resize(1024, 1024)
    .toBuffer();

  for (const item of remainingProducts) {
    const destPath = path.join(publicDir, item.dest);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const overlaySvg = buildPhotorealisticOverlaySvg(item);
    const overlayBuffer = Buffer.from(overlaySvg);

    await sharp(bgBuffer)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .webp({ quality: 88, effort: 6 })
      .toFile(destPath);

    const stats = fs.statSync(destPath);
    console.log(`✓ Composited studio photograph: ${item.dest} (${Math.round(stats.size / 1024)} KB)`);
  }

  console.log("All remaining 11 products rendered successfully!");
}

renderRemaining().catch(console.error);
