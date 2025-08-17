const { Client } = require('pg');
const http = require('http');
require('dotenv').config({ path: '.env.local' });

async function compareDbVsApi() {
  console.log('=== COMPARING DB vs API RESULTS ===\n');
  
  // 1. Получаем данные из БД
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const dbResult = await client.query(`
    SELECT id, name, parent_id, is_active
    FROM product_categories
    WHERE (is_deleted = false OR is_deleted IS NULL)
      AND is_active = true
    ORDER BY name
  `);
  
  const dbCategories = dbResult.rows;
  console.log(`🗄️ Database: ${dbCategories.length} categories`);
  
  // Подсчитаем root категории в БД
  const dbRootCategories = dbCategories.filter(cat => !cat.parent_id);
  console.log(`🗄️ Database ROOT categories: ${dbRootCategories.length}`);
  dbRootCategories.forEach(cat => console.log(`   - ${cat.name}`));
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. Получаем данные из API  
  const apiPromise = new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/categories?nocache=true', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.data || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
  
  const apiCategories = await apiPromise;
  console.log(`🌐 API: ${apiCategories.length} root categories`);
  apiCategories.forEach(cat => console.log(`   - ${cat.name}`));
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 3. Сравнение
  console.log('🔍 COMPARISON ANALYSIS:');
  
  const dbRootNames = new Set(dbRootCategories.map(c => c.name));
  const apiRootNames = new Set(apiCategories.map(c => c.name));
  
  // Категории, которые есть в API, но НЕ должны быть ROOT
  const shouldNotBeRoot = [...apiRootNames].filter(name => !dbRootNames.has(name));
  
  if (shouldNotBeRoot.length > 0) {
    console.log(`❌ ${shouldNotBeRoot.length} categories appear as ROOT in API but should be children:`);
    shouldNotBeRoot.forEach(name => {
      const dbCat = dbCategories.find(c => c.name === name);
      if (dbCat && dbCat.parent_id) {
        const parent = dbCategories.find(c => c.id === dbCat.parent_id);
        console.log(`   - "${name}" should be under "${parent?.name || 'UNKNOWN'}" (parent_id=${dbCat.parent_id})`);
      }
    });
  } else {
    console.log('✅ All API root categories match database root categories');
  }
  
  await client.end();
}

compareDbVsApi().catch(console.error);
