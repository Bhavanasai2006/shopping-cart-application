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
const { User, Product } = require("../schema");

const cosmeticProducts = [
  {
    productName: "Moisture Brightening Serum",
    subtitle: "Illuminating Vitamin C & Peptide Complex",
    productPrice: 84.0,
    originalPrice: 95.0,
    size: "30 ml",
    category: "Cosmetic",
    quantity: 30,
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80",
    description: "Target uneven skin tone, dullness, and fatigue with our high-potency lightweight brightening serum.",
    howToUse: "Dispense 3-4 drops into palms and gently pat onto face and décolleté before your favorite cream.",
    ingredients: "Aqua, 15% Ethyl Ascorbic Acid, Glycyrrhiza Glabra (Licorice) Root Extract, Ferulic Acid, Centella Asiatica, Sodium Hyaluronate.",
    isActive: true
  },
  {
    productName: "Moisture Calm Serum",
    subtitle: "Restorative Centella & Botanical Elixir",
    productPrice: 67.0,
    originalPrice: 98.0,
    size: "30 ml",
    category: "Cosmetic",
    quantity: 22,
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&auto=format&fit=crop&q=80",
    description: "Formulated specifically for delicate, reactive skin to neutralize redness and reinforce lipid defenses with bio-identical botanicals.",
    howToUse: "Apply 2-3 drops morning and night to clean skin before creams or face oils.",
    ingredients: "Centella Asiatica Leaf Water, Ceramide NP, Squalane, Madecassoside, Sodium Hyaluronate, Camellia Sinensis (Green Tea) Leaf Extract.",
    isActive: true
  },
  {
    productName: "Rosewater Balancing Mist",
    subtitle: "Hydrating Floral Essence Tonic",
    productPrice: 34.0,
    originalPrice: 40.0,
    size: "100 ml",
    category: "Cosmetic",
    quantity: 25,
    image: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&auto=format&fit=crop&q=80",
    description: "Pure steam-distilled organic rose petal hydrosol combined with plant glycerin for all-day skin hydration and antioxidant protection.",
    howToUse: "Mist freely onto face, neck, and body whenever skin feels dehydrated or to set makeup.",
    ingredients: "100% Organic Rosa Damascena Flower Water, Vegetable Glycerin, Radish Root Ferment Filtrate.",
    isActive: true
  },
  {
    productName: "Velvet Lip Tint & Hydration Balm",
    subtitle: "Peptide-Infused Plumping Botanical Color",
    productPrice: 28.0,
    originalPrice: 34.0,
    size: "15 ml",
    category: "Cosmetic",
    quantity: 35,
    image: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&auto=format&fit=crop&q=80",
    description: "A conditioning lip elixir enriched with organic shea butter and botanical pigments for a natural rose-tinted dewy finish.",
    howToUse: "Glide across lips throughout the day for hydration and a subtle wash of buildable color.",
    ingredients: "Ricinus Communis Seed Oil, Shea Butter, Tripeptide-1, Jojoba Seed Oil, Iron Oxides, Tocopherol.",
    isActive: true
  },
  {
    productName: "Luminous Silk Skin Tint Foundation",
    subtitle: "Breathable Hyaluronic Acid Mineral Shield",
    productPrice: 52.0,
    originalPrice: 60.0,
    size: "30 ml",
    category: "Cosmetic",
    quantity: 20,
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
    description: "Weightless serum foundation blending skincare benefits with light-to-medium luminous coverage for a natural radiant finish.",
    howToUse: "Shake well and blend 2-3 drops outward from center of face using fingertips or beauty sponge.",
    ingredients: "Aqua, Squalane, Titanium Dioxide, Zinc Oxide, Niacinamide, Sodium Hyaluronate, Camellia Leaf Extract.",
    isActive: true
  },
  {
    productName: "Dewy Cheek & Lip Stain Blush",
    subtitle: "Beetroot & Hibiscus Flush",
    productPrice: 32.0,
    originalPrice: 38.0,
    size: "10 ml",
    category: "Cosmetic",
    quantity: 18,
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&auto=format&fit=crop&q=80",
    description: "Concentrated botanical liquid stain that mimics a healthy, youthful flush on cheeks and lips with zero stickiness.",
    howToUse: "Dot 1-2 drops onto the apples of cheeks and quickly blend with fingertips. Pat onto lips.",
    ingredients: "Hibiscus Sabdariffa Flower Extract, Beta Vulgaris (Beet) Root Extract, Aloe Vera, Vegetable Glycerin, Rosehip Oil.",
    isActive: true
  }
];

async function addCosmetics() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to MongoDB Atlas.");

    // Verify admin identity
    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      console.warn("Warning: No administrator account found in database. Please provision one first.");
    } else {
      console.log(`Action verified from Admin Account: ${admin.username} (${admin.emailId})`);
    }

    let addedCount = 0;
    for (const item of cosmeticProducts) {
      const existing = await Product.findOne({ productName: item.productName });
      if (!existing) {
        await Product.create(item);
        console.log(`+ Added: "${item.productName}" [${item.category}] - $${item.productPrice}`);
        addedCount++;
      } else {
        // Ensure image, category, and active status are set
        existing.image = item.image;
        existing.category = item.category;
        existing.isActive = true;
        await existing.save();
        console.log(`✓ Updated existing: "${item.productName}" with photo`);
      }
    }

    console.log(`\nSuccessfully processed ${cosmeticProducts.length} cosmetic products (${addedCount} newly added).`);
    await mongoose.disconnect();
    console.log("Database disconnected.");
  } catch (err) {
    console.error("Error adding cosmetic products:", err.message);
    process.exit(1);
  }
}

addCosmetics();
