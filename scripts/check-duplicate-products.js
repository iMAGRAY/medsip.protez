const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkDuplicateProducts() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== CHECKING FOR DUPLICATE PRODUCT IDS ===\n');
  
  // Проверяем дублированные ID в таблице products
  const duplicates = await client.query(`
    SELECT id, COUNT(*) as count, array_agg(name) as names
    FROM products
    GROUP BY id
    HAVING COUNT(*) > 1
    ORDER BY count DESC, id
  `);
  
  if (duplicates.rows.length > 0) {
    console.log('Found ' + duplicates.rows.length + ' duplicate product IDs:');
    duplicates.rows.forEach(row => {
      console.log('  ID ' + row.id + ': ' + row.count + ' occurrences');
      row.names.forEach(name => console.log('    - "' + name + '"'));
    });
  } else {
    console.log('✅ No duplicate product IDs found');
  }
  
  // Проверяем товар с ID 371 конкретно
  const product371 = await client.query(`
    SELECT id, name, category_id, is_active, is_deleted
    FROM products
    WHERE id = 371
  `);
  
  console.log('\nProduct with ID 371:');
  if (product371.rows.length === 0) {
    console.log('  No product found with ID 371');
  } else {
    product371.rows.forEach((row, i) => {
      console.log('  ' + (i+1) + '. "' + row.name + '" | Category: ' + row.category_id + ' | Active: ' + row.is_active + ' | Deleted: ' + row.is_deleted);
    });
  }
  
  await client.end();
}

checkDuplicateProducts().catch(console.error);
