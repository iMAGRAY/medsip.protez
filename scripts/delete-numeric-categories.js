const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function deleteNumericCategories() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== DELETING NUMERIC/TEST CATEGORIES ===\n');
  
  try {
    await client.query('BEGIN');
    
    // Находим все категории с числовыми именами и их детей
    const categoriesToDelete = [114, 115, 116]; // ID категорий "111", "13", "1"
    
    for (const catId of categoriesToDelete) {
      // Получаем информацию о категории
      const catInfo = await client.query(
        'SELECT id, name, parent_id FROM product_categories WHERE id = $1',
        [catId]
      );
      
      if (catInfo.rows.length === 0) {
        console.log('Category ID ' + catId + ' not found');
        continue;
      }
      
      const cat = catInfo.rows[0];
      
      // Проверяем товары
      const products = await client.query(
        'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
        [catId]
      );
      
      const productCount = parseInt(products.rows[0].count);
      
      if (productCount > 0) {
        console.log('⚠️ Category "' + cat.name + '" has ' + productCount + ' products - skipping');
        continue;
      }
      
      // Проверяем дочерние категории
      const children = await client.query(
        'SELECT id, name FROM product_categories WHERE parent_id = $1',
        [catId]
      );
      
      if (children.rows.length > 0) {
        console.log('Category "' + cat.name + '" has ' + children.rows.length + ' children - will delete them first');
        
        // Удаляем дочерние категории рекурсивно (только если у них нет товаров)
        for (const child of children.rows) {
          const childProducts = await client.query(
            'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
            [child.id]
          );
          
          if (parseInt(childProducts.rows[0].count) === 0) {
            await client.query('DELETE FROM product_categories WHERE id = $1', [child.id]);
            console.log('  ✅ Deleted child "' + child.name + '" (ID: ' + child.id + ')');
          } else {
            console.log('  ⚠️ Child "' + child.name + '" has products - skipping');
          }
        }
      }
      
      // Удаляем основную категорию
      await client.query('DELETE FROM product_categories WHERE id = $1', [catId]);
      console.log('✅ Deleted "' + cat.name + '" (ID: ' + catId + ')');
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Numeric categories deleted successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

deleteNumericCategories().catch(console.error);
