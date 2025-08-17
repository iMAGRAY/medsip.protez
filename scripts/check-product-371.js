const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkProduct371() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log('=== CHECKING PRODUCT 371 AND RELATED DATA ===\n');
  
  // Проверяем структуру таблицы products
  const columns = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'products'
    ORDER BY ordinal_position
  `);
  
  console.log('Products table columns:');
  columns.rows.forEach(col => {
    console.log('  ' + col.column_name + ' (' + col.data_type + ')');
  });
  
  // Проверяем товар 371
  const product371 = await client.query('SELECT * FROM products WHERE id = 371');
  
  console.log('\nProduct with ID 371:');
  if (product371.rows.length === 0) {
    console.log('  No product found with ID 371');
  } else {
    const product = product371.rows[0];
    console.log('  ID: ' + product.id);
    console.log('  Name: "' + product.name + '"');
    console.log('  Category: ' + product.category_id);
  }
  
  // Проверяем варианты товара 371
  const variants = await client.query('SELECT * FROM product_variants WHERE product_id = 371');
  
  console.log('\nVariants for product 371:');
  if (variants.rows.length === 0) {
    console.log('  No variants found');
  } else {
    variants.rows.forEach(variant => {
      console.log('  Variant ID: ' + variant.id + ' | Name: "' + variant.name + '"');
    });
  }
  
  await client.end();
}

checkProduct371().catch(console.error);
