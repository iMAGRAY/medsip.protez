const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function debugCategoriesMap() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== DEBUGGING CATEGORIES MAP LOGIC ===\n');
  
  // Точно такой же запрос как в API
  const query = `
    SELECT
      id,
      name,
      description,
      parent_id,
      is_active,
      sort_order as display_order,
      created_at,
      updated_at
    FROM product_categories
    WHERE (is_deleted = false OR is_deleted IS NULL)
      AND is_active = true
    ORDER BY sort_order, name
  `;

  const result = await client.query(query);
  let categories = result.rows;
  
  console.log(`Total categories from DB: ${categories.length}\n`);
  
  // Симулируем логику API
  const categoriesMap = new Map();
  categories.forEach(cat => {
    categoriesMap.set(cat.id, { ...cat, children: [] });
  });
  
  console.log('=== CATEGORIES WITH PARENT_ID ===');
  const withParent = categories.filter(cat => cat.parent_id);
  console.log(`Categories with parent_id: ${withParent.length}\n`);
  
  const rootCategories = [];
  const orphaned = [];
  
  categories.forEach(cat => {
    if (cat.parent_id) {
      const parent = categoriesMap.get(cat.parent_id);
      if (parent) {
        parent.children.push(categoriesMap.get(cat.id));
        console.log(`✓ "${cat.name}" → placed under "${parent.name}"`);
      } else {
        // Эта логика проблемная!
        rootCategories.push(categoriesMap.get(cat.id));
        orphaned.push(cat);
        console.log(`❌ "${cat.name}" → ORPHANED (parent_id=${cat.parent_id} not found in map)`);
      }
    } else {
      rootCategories.push(categoriesMap.get(cat.id));
      console.log(`✓ "${cat.name}" → ROOT (no parent_id)`);
    }
  });
  
  console.log(`\n=== RESULT ===`);
  console.log(`Root categories: ${rootCategories.length}`);
  console.log(`Orphaned categories: ${orphaned.length}`);
  
  if (orphaned.length > 0) {
    console.log('\n=== ORPHANED CATEGORIES ANALYSIS ===');
    for (const orphan of orphaned) {
      // Проверяем, есть ли parent_id в исходных данных
      const parentExists = categories.find(c => c.id === orphan.parent_id);
      if (parentExists) {
        console.log(`❌ "${orphan.name}" parent "${parentExists.name}" EXISTS but not in map!`);
      } else {
        console.log(`⚠️ "${orphan.name}" parent_id=${orphan.parent_id} NOT FOUND in DB`);
      }
    }
  }
  
  await client.end();
}

debugCategoriesMap().catch(console.error);
