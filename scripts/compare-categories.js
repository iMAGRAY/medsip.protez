const { Client } = require('pg');
const http = require('http');
require('dotenv').config({ path: '.env.local' });

async function compareCategories() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Получаем корневые категории из БД
  const dbResult = await client.query(`
    SELECT id, name, is_active
    FROM product_categories
    WHERE parent_id IS NULL 
      AND (is_deleted = false OR is_deleted IS NULL)
    ORDER BY name
  `);
  
  console.log('Root categories in DB:', dbResult.rows.length);
  
  // Получаем из API
  http.get('http://localhost:3000/api/categories', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      try {
        const apiData = JSON.parse(data);
        const apiCategories = apiData.data || [];
        
        console.log('Root categories in API:', apiCategories.length);
        
        const apiNames = new Set(apiCategories.map(c => c.name));
        
        console.log('\n=== MISSING IN API ===');
        const missing = dbResult.rows.filter(dbCat => !apiNames.has(dbCat.name));
        
        if (missing.length > 0) {
          missing.forEach(dbCat => {
            console.log(`  - ${dbCat.name} (ID: ${dbCat.id}, is_active: ${dbCat.is_active})`);
          });
          
          // Проверяем что общего у пропущенных категорий
          console.log('\n=== ANALYSIS ===');
          const allActive = missing.every(c => c.is_active !== false);
          console.log(`All missing categories are active: ${allActive}`);
        } else {
          console.log('  None - all DB categories are in API');
        }
        
        console.log('\n=== EXTRA IN API ===');
        const dbNames = new Set(dbResult.rows.map(c => c.name));
        const extra = apiCategories.filter(apiCat => !dbNames.has(apiCat.name));
        
        if (extra.length > 0) {
          extra.forEach(apiCat => {
            console.log(`  - ${apiCat.name} (ID: ${apiCat.id})`);
          });
        } else {
          console.log('  None - all API categories are in DB');
        }
        
      } catch (err) {
        console.error('Error parsing API response:', err.message);
      } finally {
        await client.end();
      }
    });
  }).on('error', err => {
    console.error('HTTP Error:', err.message);
    client.end();
  });
}

compareCategories();