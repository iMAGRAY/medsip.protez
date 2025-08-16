const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkParentStatus() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== CHECKING PARENT CATEGORY STATUS ===\n');
  
  // Проверяем статус всех уникальных родителей
  const parents = await client.query(`
    SELECT DISTINCT 
      p.id, p.name, p.is_active, p.is_deleted,
      COUNT(c.id) as children_count
    FROM product_categories p
    INNER JOIN product_categories c ON c.parent_id = p.id
    WHERE (c.is_deleted = false OR c.is_deleted IS NULL) 
      AND c.is_active = true
    GROUP BY p.id, p.name, p.is_active, p.is_deleted
    ORDER BY p.name
  `);
  
  console.log('Parent categories status:');
  let inactive_parents = [];
  parents.rows.forEach(row => {
    const status = row.is_active ? '✓ ACTIVE' : '❌ INACTIVE';
    const deleted = row.is_deleted ? ' (DELETED)' : '';
    console.log(`  ${status}${deleted}: ${row.name} (has ${row.children_count} children)`);
    
    if (!row.is_active || row.is_deleted) {
      inactive_parents.push(row);
    }
  });
  
  if (inactive_parents.length > 0) {
    console.log(`\n❌ FOUND ${inactive_parents.length} INACTIVE/DELETED PARENT CATEGORIES:`);
    inactive_parents.forEach(parent => {
      console.log(`   - ${parent.name} (ID: ${parent.id})`);
    });
    console.log('This explains why their children appear as ROOT in the API!');
  } else {
    console.log('\n✓ All parent categories are active');
  }
  
  await client.end();
}

checkParentStatus().catch(console.error);
