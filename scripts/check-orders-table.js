const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkOrdersTable() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== CHECKING ORDERS TABLE ===\n');
  
  // Проверяем существует ли таблица orders
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'orders'
    )
  `);
  
  const tableExists = tableCheck.rows[0].exists;
  console.log('Orders table exists:', tableExists);
  
  if (!tableExists) {
    console.log('❌ Table "orders" does not exist - this explains the 500 error');
  } else {
    // Если таблица существует, проверим её содержимое
    const count = await client.query('SELECT COUNT(*) as count FROM orders');
    console.log('Orders count:', count.rows[0].count);
  }
  
  await client.end();
}

checkOrdersTable().catch(console.error);
