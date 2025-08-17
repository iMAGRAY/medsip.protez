const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkMisplacedCategories() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Категории которые пользователь видит как корневые, но не должны быть
  const problemCategories = [
    'Стопы', 'Замки и клапаны', 'Лайнеры', 'Несущие модули', 
    'Адаптеры', 'Косметические элементы', 'Комплектующие',
    'Коленный Модуль', 'Стопа'
  ];
  
  console.log('=== CHECKING CATEGORIES THAT APPEAR AS ROOT ===\n');
  
  for (const name of problemCategories) {
    const result = await client.query(
      `SELECT id, name, parent_id, is_active 
       FROM product_categories 
       WHERE name = $1 
         AND (is_deleted = false OR is_deleted IS NULL)`,
      [name]
    );
    
    if (result.rows.length > 0) {
      const cat = result.rows[0];
      if (cat.parent_id) {
        const parent = await client.query(
          'SELECT name, is_active FROM product_categories WHERE id = $1',
          [cat.parent_id]
        );
        const parentInfo = parent.rows[0];
        console.log(`❌ "${name}" (ID: ${cat.id})`);
        console.log(`   Should be child of: "${parentInfo?.name}" (ID: ${cat.parent_id})`);
        console.log(`   Parent is_active: ${parentInfo?.is_active}`);
        console.log(`   Child is_active: ${cat.is_active}`);
      } else {
        console.log(`✓ "${name}" (ID: ${cat.id}) - correctly ROOT (parent_id=NULL)`);
      }
    } else {
      console.log(`? "${name}" - not found in DB`);
    }
  }
  
  // Проверяем логику: может быть эти категории должны быть дочерними?
  console.log('\n=== CHECKING IF THESE SHOULD BE CHILDREN ===\n');
  
  // Логические связи
  const shouldBeChild = {
    'Стопы': 'Протезы',
    'Замки и клапаны': 'Комплектующие',
    'Лайнеры': 'Комплектующие',
    'Несущие модули': 'Комплектующие',
    'Адаптеры': 'Комплектующие',
    'Косметические элементы': 'Аксессуары',
    'Комплектующие': null, // должна быть корневой
    'Коленный Модуль': 'Протезы',
    'Стопа': 'Протезы'
  };
  
  for (const [child, expectedParent] of Object.entries(shouldBeChild)) {
    if (!expectedParent) continue;
    
    // Найдем потенциального родителя
    const parentResult = await client.query(
      `SELECT id, name FROM product_categories 
       WHERE name LIKE $1 
         AND parent_id IS NULL
         AND (is_deleted = false OR is_deleted IS NULL)
         AND is_active = true`,
      [`%${expectedParent}%`]
    );
    
    if (parentResult.rows.length > 0) {
      console.log(`Suggestion: "${child}" → should be child of "${parentResult.rows[0].name}" (ID: ${parentResult.rows[0].id})`);
    }
  }
  
  await client.end();
}

checkMisplacedCategories();