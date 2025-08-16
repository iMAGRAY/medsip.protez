const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function deleteTestCategoriesHard() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== HARD DELETE TEST CATEGORIES ===\n');
  
  try {
    await client.query('BEGIN');
    
    // Находим тестовые категории
    const testCats = await client.query(`
      SELECT id, name FROM product_categories
      WHERE LOWER(name) LIKE '%тест%' OR LOWER(name) LIKE '%test%'
    `);
    
    console.log(`Found ${testCats.rows.length} test categories to delete:\n`);
    
    for (const cat of testCats.rows) {
      console.log(`Deleting "${cat.name}" (ID: ${cat.id})`);
      
      // Проверяем есть ли товары
      const products = await client.query(
        'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
        [cat.id]
      );
      
      if (parseInt(products.rows[0].count) > 0) {
        console.log(`⚠️ Category has ${products.rows[0].count} products - skipping`);
        continue;
      }
      
      // Проверяем есть ли дочерние категории
      const children = await client.query(
        'SELECT COUNT(*) as count FROM product_categories WHERE parent_id = $1',
        [cat.id]
      );
      
      if (parseInt(children.rows[0].count) > 0) {
        console.log(`⚠️ Category has ${children.rows[0].count} children - skipping`);
        continue;
      }
      
      // Физическое удаление
      await client.query('DELETE FROM product_categories WHERE id = $1', [cat.id]);
      console.log(`✅ Deleted "${cat.name}"`);
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Test categories deleted successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

deleteTestCategoriesHard().catch(console.error);
