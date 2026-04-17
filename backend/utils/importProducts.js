const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const Product = require('../models/Product');
const Category = require('../models/Category');

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

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

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

    const parts = parseCSVLine(line);
    if (!parts || parts.length < 2) continue;

    let itemName, sellingPrice, mrp;
    if (hasItemCode === 'true' || hasItemCode === true) {
      // Item Code, Item Name, Selling, M.R.P
      itemName = parts[1];
      sellingPrice = parsePrice(parts[2]);
      mrp = parsePrice(parts[3]);
    } else {
      // Item Name, Selling, M.R.P
      itemName = parts[0];
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
      unit: itemName.toUpperCase().includes('KG') ? 'kg' : itemName.toUpperCase().includes('GM') ? 'gm' : itemName.toUpperCase().includes('LTR') ? 'ltr' : 'piece',
      isActive: true,
      description: `Premium quality ${itemName} available at Parivar Mart.`,
    });
  }

  return { productsToAdd, categoriesToEnsure };
}

async function run() {
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
  const MONGO_URI = process.env.MONGO_URI;

  try {
    console.log('Connecting to MongoDB...');
    try {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    } catch (err) {
      console.warn('Standard connection failed, trying direct fallback...');
      const directUri = MONGO_URI.replace('mongodb+srv://', 'mongodb://')
        .replace('cluster0.qbd0xg5.mongodb.net', 'ac-8nv0mrf-shard-00-00.qbd0xg5.mongodb.net:27017,ac-8nv0mrf-shard-00-01.qbd0xg5.mongodb.net:27017,ac-8nv0mrf-shard-00-02.qbd0xg5.mongodb.net:27017') + '&ssl=true&authSource=admin';
      await mongoose.connect(directUri);
    }
    console.log('Connected.');

    // 1. Clean up messed up products
    console.log('Cleaning up incorrectly imported products...');
    const delResult = await Product.deleteMany({ images: '/uploads/products/placeholder.webp' });
    console.log(`Deleted ${delResult.deletedCount} products.`);

    const file1 = await importFile('../PRODUCT1.csv', true);
    const file2 = await importFile('../PRODUCT 2.csv', false);
    const productsToAdd = [...file1.productsToAdd, ...file2.productsToAdd];
    const categoriesToEnsure = new Set([...file1.categoriesToEnsure, ...file2.categoriesToEnsure]);

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

run();
