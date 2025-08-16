const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixCategoryHierarchy() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Connected to database\n');
    
    // Начинаем транзакцию
    await client.query('BEGIN');
    
    console.log('=== FIXING CATEGORY HIERARCHY ===\n');
    
    // Определяем правильные связи
    const corrections = [
      { child: 'Стопы', parent: 'Протезы' },
      { child: 'Стопа', parent: 'Протезы' },
      { child: 'Коленный Модуль', parent: 'Протезы' },
      { child: 'Замки и клапаны', parent: 'Комплектующие' },
      { child: 'Лайнеры', parent: 'Комплектующие' },
      { child: 'Несущие модули', parent: 'Комплектующие' },
      { child: 'Адаптеры', parent: 'Комплектующие' },
      { child: 'Косметические элементы', parent: 'Аксессуары и расходные материалы' },
      { child: 'Адаптеры и втулки', parent: 'Комплектующие' }
    ];
    
    for (const correction of corrections) {
      // Находим родителя
      const parentResult = await client.query(
        `SELECT id, name FROM product_categories 
         WHERE name = $1 
           AND parent_id IS NULL
           AND (is_deleted = false OR is_deleted IS NULL)
           AND is_active = true`,
        [correction.parent]
      );
      
      if (parentResult.rows.length === 0) {
        console.log(`⚠️ Parent category "${correction.parent}" not found, skipping "${correction.child}"`);
        continue;
      }
      
      const parentId = parentResult.rows[0].id;
      
      // Обновляем дочернюю категорию
      const updateResult = await client.query(
        `UPDATE product_categories 
         SET parent_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE name = $2 
           AND (is_deleted = false OR is_deleted IS NULL)
           AND is_active = true
         RETURNING id, name`,
        [parentId, correction.child]
      );
      
      if (updateResult.rows.length > 0) {
        console.log(`✅ Moved "${correction.child}" → under "${correction.parent}" (parent_id=${parentId})`);
      } else {
        console.log(`⚠️ Category "${correction.child}" not found or already has parent`);
      }
    }
    
    // Проверяем результат
    console.log('\n=== VERIFICATION ===\n');
    
    const rootCategories = await client.query(`
      SELECT COUNT(*) as count
      FROM product_categories
      WHERE parent_id IS NULL
        AND (is_deleted = false OR is_deleted IS NULL)
        AND is_active = true
    `);
    
    console.log(`Root categories after fix: ${rootCategories.rows[0].count}`);
    
    // Показываем новую структуру
    const structure = await client.query(`
      SELECT 
        p.name as parent_name,
        COUNT(c.id) as children_count
      FROM product_categories p
      LEFT JOIN product_categories c ON c.parent_id = p.id AND c.is_active = true AND (c.is_deleted = false OR c.is_deleted IS NULL)
      WHERE p.parent_id IS NULL
        AND (p.is_deleted = false OR p.is_deleted IS NULL)
        AND p.is_active = true
      GROUP BY p.id, p.name
      HAVING COUNT(c.id) > 0
      ORDER BY p.name
    `);
    
    console.log('\nCategories with children:');
    structure.rows.forEach(row => {
      console.log(`  ${row.parent_name}: ${row.children_count} children`);
    });
    
    // Коммитим транзакцию
    await client.query('COMMIT');
    console.log('\n✅ Hierarchy fixed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error, rolling back:', error.message);
  } finally {
    await client.end();
  }
}

// Запускаем с подтверждением
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('This script will reorganize categories into proper hierarchy.');
console.log('Categories like "Стопы", "Лайнеры", etc. will be moved under their parent categories.\n');

rl.question('Do you want to proceed? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    fixCategoryHierarchy();
  } else {
    console.log('Operation cancelled');
    process.exit(0);
  }
  rl.close();
});