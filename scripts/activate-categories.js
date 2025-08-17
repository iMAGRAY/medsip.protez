const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function activateCategories() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Connected to database\n');
    
    // Проверяем текущее состояние
    const checkQuery = `
      SELECT COUNT(*) as inactive_count
      FROM product_categories
      WHERE is_active = false
        AND (is_deleted = false OR is_deleted IS NULL)
    `;
    
    const before = await client.query(checkQuery);
    console.log(`Found ${before.rows[0].inactive_count} inactive categories\n`);
    
    if (before.rows[0].inactive_count > 0) {
      // Активируем все неактивные категории
      const updateResult = await client.query(`
        UPDATE product_categories
        SET is_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE is_active = false
          AND (is_deleted = false OR is_deleted IS NULL)
        RETURNING id, name
      `);
      
      console.log(`✅ Activated ${updateResult.rows.length} categories:`);
      updateResult.rows.forEach(cat => {
        console.log(`  - ${cat.name} (ID: ${cat.id})`);
      });
    } else {
      console.log('✅ All categories are already active!');
    }
    
    // Проверяем результат
    const afterQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
      FROM product_categories
      WHERE (is_deleted = false OR is_deleted IS NULL)
    `;
    
    const after = await client.query(afterQuery);
    console.log('\n=== FINAL STATUS ===');
    console.log(`Total categories: ${after.rows[0].total}`);
    console.log(`Active: ${after.rows[0].active}`);
    console.log(`Inactive: ${after.rows[0].inactive}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

activateCategories();