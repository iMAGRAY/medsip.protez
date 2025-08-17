const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkCategory111() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== CHECKING CATEGORY 111 AND ITS CHILDREN ===\n');
  
  // Получаем информацию о категории 111
  const mainCat = await client.query(
    'SELECT id, name, parent_id, is_active FROM product_categories WHERE id = 111'
  );
  
  if (mainCat.rows.length === 0) {
    console.log('Category 111 not found');
    await client.end();
    return;
  }
  
  const category = mainCat.rows[0];
  console.log('Main category: "' + category.name + '" (ID: ' + category.id + ')');
  console.log('Status: ' + (category.is_active ? 'ACTIVE' : 'INACTIVE'));
  console.log('Parent ID: ' + (category.parent_id || 'NULL (root category)') + '\n');
  
  // Находим все дочерние категории рекурсивно
  const getAllChildren = async (parentId, level = 0) => {
    const children = await client.query(`
      SELECT id, name, parent_id, is_active,
             (SELECT COUNT(*) FROM products WHERE category_id = product_categories.id) as products_count
      FROM product_categories 
      WHERE parent_id = $1
      ORDER BY name
    `, [parentId]);
    
    for (const child of children.rows) {
      const indent = '  '.repeat(level + 1);
      const status = child.is_active ? 'ACTIVE' : 'INACTIVE';
      console.log(indent + '├─ "' + child.name + '" (ID: ' + child.id + ') | ' + status + ' | Products: ' + child.products_count);
      
      // Рекурсивно ищем детей
      await getAllChildren(child.id, level + 1);
    }
    
    return children.rows;
  };
  
  // Проверяем товары в основной категории
  const productsInMain = await client.query(
    'SELECT COUNT(*) as count FROM products WHERE category_id = 111'
  );
  
  console.log('Products in main category: ' + productsInMain.rows[0].count + '\n');
  
  console.log('Hierarchy:');
  const allChildren = await getAllChildren(111);
  
  if (allChildren.length === 0) {
    console.log('  (no children)');
  }
  
  console.log('\n=== DELETION PLAN ===');
  console.log('Will delete category 111 and all its descendants');
  
  await client.end();
}

checkCategory111().catch(console.error);
