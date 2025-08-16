const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function findTestCategories() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== FINDING TEST CATEGORIES ===\n');
  
  // Ищем категории с тестовыми названиями
  const result = await client.query(`
    SELECT id, name, parent_id, is_active, is_deleted,
           (SELECT COUNT(*) FROM products WHERE category_id = product_categories.id) as products_count
    FROM product_categories
    WHERE LOWER(name) LIKE '%тест%' 
       OR LOWER(name) LIKE '%test%'
    ORDER BY name
  `);
  
  console.log(`Found ${result.rows.length} test categories:\n`);
  
  result.rows.forEach(cat => {
    const status = cat.is_active ? 'ACTIVE' : 'INACTIVE';
    const deleted = cat.is_deleted ? ' (DELETED)' : '';
    console.log(`ID: ${cat.id} | "${cat.name}" | ${status}${deleted} | Products: ${cat.products_count}`);
  });
  
  if (result.rows.length > 0) {
    console.log('\n=== CATEGORIES TO DELETE ===');
    const toDelete = result.rows.filter(cat => !cat.is_deleted);
    toDelete.forEach(cat => {
      console.log(`- "${cat.name}" (ID: ${cat.id}) - ${cat.products_count} products`);
    });
  }
  
  await client.end();
}

findTestCategories().catch(console.error);
