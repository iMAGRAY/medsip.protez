const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function findStrangeCategories() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== FINDING STRANGE CATEGORIES ===\n');
  
  // Найдем все корневые категории
  const rootCats = await client.query(`
    SELECT id, name, parent_id, is_active
    FROM product_categories
    WHERE parent_id IS NULL 
      AND (is_deleted = false OR is_deleted IS NULL)
      AND is_active = true
    ORDER BY id
  `);
  
  console.log('Root categories in DB:');
  rootCats.rows.forEach(cat => {
    console.log('  ID: ' + cat.id + ' | Name: "' + cat.name + '"');
  });
  
  // Найдем категории с числовыми именами
  const numericNames = await client.query(`
    SELECT id, name, parent_id, is_active
    FROM product_categories
    WHERE name ~ '^[0-9]+$'
      AND (is_deleted = false OR is_deleted IS NULL)
      AND is_active = true
    ORDER BY name
  `);
  
  console.log('\nCategories with numeric names:');
  numericNames.rows.forEach(cat => {
    console.log('  ID: ' + cat.id + ' | Name: "' + cat.name + '" | Parent: ' + (cat.parent_id || 'NULL'));
  });
  
  // Найдем категории с подозрительными именами
  const suspicious = await client.query(`
    SELECT id, name, parent_id, is_active,
           (SELECT COUNT(*) FROM products WHERE category_id = product_categories.id) as products_count
    FROM product_categories
    WHERE (name = '111' OR name = '13' OR name = '1' OR LENGTH(name) <= 3)
      AND (is_deleted = false OR is_deleted IS NULL)
      AND is_active = true
    ORDER BY name
  `);
  
  console.log('\nSuspicious categories (short names):');
  suspicious.rows.forEach(cat => {
    console.log('  ID: ' + cat.id + ' | Name: "' + cat.name + '" | Parent: ' + (cat.parent_id || 'NULL') + ' | Products: ' + cat.products_count);
  });
  
  await client.end();
}

findStrangeCategories().catch(console.error);
