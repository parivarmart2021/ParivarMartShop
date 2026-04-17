const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// This script can be run standalone to import products from CSV/Excel
// Usage: node importProducts.js <path_to_csv> <has_item_code_true_false>

const Product = require('./models/Product');
const Category = require('./models/Category');

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const categoryMapping = [
  { keywords: ['OIL'], category: 'Oils' },
  { keywords: ['DAL', 'DALL', 'RICE', 'WHEAT', 'POHA', 'VATANA', 'CHANA', 'MATKI', 'UKDA', 'KOLAM', 'MUNG', 'TUR'], category: 'Grains & Pulses' },
  { keywords: ['JEERA', 'RAI', 'SING DANA', 'SUGAR', 'MASALA', 'SALT', 'HALDI', 'MIRCH'], category: 'Spices & Condiments' },
  { keywords: ['ATTA', 'MAIDA', 'BESAN', 'SOOJI', 'RAWA'], category: 'Atta & Flours' },
  { keywords: ['JUICE', 'DRINK', 'COLA', 'WATER', 'PEPSI', 'COKE', 'THUMS', 'SPRITE'], category: 'Beverages' },
  { keywords: ['BISCUIT', 'KHAKHRA', 'CHIPS', 'NAMKEEN', 'SNACK', 'MAGGI', 'NOODLE'], category: 'Snacks' },
  { keywords: ['WIPER', 'PEDAL', 'SOAP', 'DETERGENT', 'CLEANER', 'STEEL', 'BRUSH', 'MOP', 'PHENYLE'], category: 'Household Items' },
];

const getCategoryName = (itemName) => {
  const upperName = itemName.toUpperCase();
  for (const map of categoryMapping) {
    if (map.keywords.some(kw => upperName.includes(kw))) {
      return map.category;
    }
  }
  return 'Others';
};

const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[",]/g, '');
  return parseFloat(cleaned) || 0;
};

async function importFile(filePath, hasItemCode) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const productsToAdd = [];
  const categoriesToEnsure = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!parts) continue;

    let itemName, sellingPrice, mrp;
    if (hasItemCode === 'true' || hasItemCode === true) {
      itemName = parts[1]?.replace(/"/g, '');
      sellingPrice = parsePrice(parts[2]);
      mrp = parsePrice(parts[3]);
    } else {
      itemName = parts[0]?.replace(/"/g, '');
      sellingPrice = parsePrice(parts[1]);
      mrp = parsePrice(parts[2]);
    }

    if (!itemName) continue;

    const categoryName = getCategoryName(itemName);
    categoriesToEnsure.add(categoryName);

    productsToAdd.push({
      name: itemName,
      price: mrp || sellingPrice,
      discountPrice: (sellingPrice > 0 && mrp > 0 && sellingPrice < mrp) ? sellingPrice : 0,
      categoryName: categoryName,
      stock: 100,
      unit: itemName.includes('KG') ? 'kg' : itemName.includes('GM') ? 'gm' : itemName.includes('LTR') ? 'ltr' : 'piece',
      isActive: true,
      description: `Premium quality ${itemName} available at Parivar Mart.`,
    });
  }

  return { productsToAdd, categoriesToEnsure };
}

async function run() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const hasItemCode = args[1] || 'false';

  if (!filePath) {
    console.log('Usage: node importProducts.js <path_to_csv> <has_item_code_true_false>');
    process.exit(1);
  }

  dotenv.config({ path: path.join(__dirname, '.env') });
  const MONGO_URI = process.env.MONGO_URI;

  try {
    console.log('Connecting to MongoDB...');
    // Fallback for environments with DNS issues
    try {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    } catch (err) {
      console.warn('Standard connection failed, trying direct fallback...');
      const directUri = MONGO_URI.replace('mongodb+srv://', 'mongodb://')
        .replace('cluster0.qbd0xg5.mongodb.net', 'ac-8nv0mrf-shard-00-00.qbd0xg5.mongodb.net:27017,ac-8nv0mrf-shard-00-01.qbd0xg5.mongodb.net:27017,ac-8nv0mrf-shard-00-02.qbd0xg5.mongodb.net:27017') + '&ssl=true&authSource=admin';
      await mongoose.connect(directUri);
    }
    console.log('Connected.');

    const { productsToAdd, categoriesToEnsure } = await importFile(filePath, hasItemCode);

    // Ensure categories
    const categoryMap = {};
    for (const catName of categoriesToEnsure) {
      let category = await Category.findOne({ name: catName });
      if (!category) {
        category = await Category.create({
          name: catName,
          slug: slugify(catName),
          description: `${catName} products.`,
        });
      }
      categoryMap[catName] = category._id;
    }

    // Prepare batch
    const existingProducts = await Product.find({}, { slug: 1 });
    const existingSlugs = new Set(existingProducts.map(p => p.slug));
    const toInsert = [];
    const seenInBatch = new Set();

    for (const p of productsToAdd) {
      const slug = slugify(p.name);
      if (existingSlugs.has(slug) || seenInBatch.has(slug)) continue;
      seenInBatch.add(slug);
      toInsert.push({
        ...p,
        slug,
        category: categoryMap[p.categoryName],
        images: ['/uploads/products/placeholder.webp']
      });
    }

    console.log(`Inserting ${toInsert.length} products...`);
    const BATCH_SIZE = 500;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      await Product.insertMany(toInsert.slice(i, i + BATCH_SIZE), { ordered: false }).catch(() => {});
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length}`);
    }

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}
