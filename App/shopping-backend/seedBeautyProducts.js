const mongoose = require("mongoose");
const config = require("./config/env");
const { Product } = require("./schema");

const beautyProducts = [
  {
    productName: "Moisture Repair Cream",
    subtitle: "Barrier Support & Deep Hydration",
    productPrice: 97.0,
    originalPrice: 104.0,
    size: "50 ml",
    category: "Body Care",
    quantity: 24,
    image: "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=600&auto=format&fit=crop&q=80",
    description: "Deeply restores and nourishes compromised skin barriers with botanical ceramides and restorative peptides, leaving skin velvety and supple.",
    howToUse: "Apply generously to cleansed skin morning and evening. Gently press into face and neck until fully absorbed.",
    ingredients: "Aqua, Butyrospermum Parkii (Shea) Butter, Squalane, Ceramide NP, Glycerin, Simmondsia Chinensis (Jojoba) Seed Oil, Chamomile Extract, Tocopherol (Vitamin E)."
  },
  {
    productName: "Vitamin Softening Cream",
    subtitle: "Radiance & Skin Smoothing Therapy",
    productPrice: 72.0,
    originalPrice: 85.0,
    size: "150 ml",
    category: "Mask",
    quantity: 18,
    image: "https://images.unsplash.com/photo-1608248597359-00a89d31610d?w=600&auto=format&fit=crop&q=80",
    description: "A whipped antioxidant-rich cream formulated to soften rough texture and deliver a radiant, luminous dewy complexion.",
    howToUse: "Smooth a nickel-sized amount over skin after cleansing and toning. Can be used under makeup or as a replenishing night cream.",
    ingredients: "Aqua, Camellia Japonica Seed Oil, Ascorbic Acid (Vitamin C), Niacinamide, Sodium Hyaluronate, Aloe Barbadensis Leaf Juice."
  },
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
    ingredients: "Aqua, 15% Ethyl Ascorbic Acid, Glycyrrhiza Glabra (Licorice) Root Extract, Ferulic Acid, Centella Asiatica, Sodium Hyaluronate."
  },
  {
    productName: "Vitamin Soothing Mask",
    subtitle: "Calming Chamomile & Oat Treatment",
    productPrice: 55.0,
    originalPrice: 62.0,
    size: "100 ml",
    category: "Mask",
    quantity: 15,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80",
    description: "An intensely soothing wash-off gel mask that cools redness, relieves irritation, and revives tired skin with fresh organic botanicals.",
    howToUse: "Apply a generous layer to cleansed skin. Relax for 10-15 minutes, then rinse with cool water.",
    ingredients: "Aloe Barbadensis Leaf Juice, Chamomilla Recutita Flower Water, Colloidal Oatmeal, Panthenol (Vitamin B5), Allantoin."
  },
  {
    productName: "Vitamin Skin Boost Mask",
    subtitle: "Glow Enhancing Vitamin Formula",
    productPrice: 45.0,
    originalPrice: 58.0,
    size: "50 ml",
    category: "Mask",
    quantity: 20,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&auto=format&fit=crop&q=80",
    description: "Vitamin Mask is enriched with essential vitamins that deeply nourish the skin, restore its natural balance, and enhance a healthy glow. The formula helps revitalize dull, tired skin, leaving it soft, smooth, and visibly refreshed.",
    howToUse: "Apply an even layer to clean skin. Leave on for 15 minutes, then rinse gently with lukewarm water. Use 2-3 times weekly.",
    ingredients: "Aqua, Chamomile Extract, Niacinamide, Ascorbyl Glucoside (Vitamin C), Tocopheryl Acetate (Vitamin E), Shea Butter, Glycerin, Rosa Damascena Flower Extract."
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
    ingredients: "Centella Asiatica Leaf Water, Ceramide NP, Squalane, Madecassoside, Sodium Hyaluronate, Camellia Sinensis (Green Tea) Leaf Extract."
  },
  {
    productName: "Gentle Botanical Cleanser",
    subtitle: "Balancing Low-pH Herbaceous Wash",
    productPrice: 38.0,
    originalPrice: 45.0,
    size: "150 ml",
    category: "Body Care",
    quantity: 35,
    image: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&auto=format&fit=crop&q=80",
    description: "Silky foaming gel cleanser that removes daily impurities and light makeup without stripping essential moisture.",
    howToUse: "Pump once into damp palms, lather gently over face in circular motions, and rinse clean with lukewarm water.",
    ingredients: "Aqua, Decyl Glucoside, Glycerin, Chamomile Extract, Rosmarinus Officinalis Leaf Water, Citric Acid, Lavandula Angustifolia Oil."
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
    ingredients: "100% Organic Rosa Damascena Flower Water, Vegetable Glycerin, Radish Root Ferment Filtrate."
  }
];

async function seed() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to MongoDB for beauty catalog seeding...");

    // Remove old non-skincare products
    await Product.deleteMany({});
    console.log("Cleared old products.");

    // Insert beauty and skin care products
    const inserted = await Product.insertMany(beautyProducts);
    console.log(`Successfully seeded ${inserted.length} beauty & skincare products!`);

    await mongoose.disconnect();
    console.log("Database disconnected cleanly.");
  } catch (err) {
    console.error("Seeding error:", err.message);
    process.exit(1);
  }
}

seed();

