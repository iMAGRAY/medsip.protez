const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://gen_user:Q1w2e3r4t5!%40@212.113.118.141:5432/default_db'
});

async function checkVariantSystem() {
  try {
    // Проверяем структуру product_sizes
    const sizesColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_sizes'
      ORDER BY ordinal_position
    `);
    
    console.log('=== СТРУКТУРА product_sizes ===');
    sizesColumns.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Проверяем структуру product_variants
    const variantsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_variants'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== СТРУКТУРА product_variants ===');
    variantsColumns.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Проверяем данные
    const sizesCount = await pool.query('SELECT COUNT(*) FROM product_sizes');
    const variantsCount = await pool.query('SELECT COUNT(*) FROM product_variants');
    
    console.log('\n=== КОЛИЧЕСТВО ЗАПИСЕЙ ===');
    console.log('product_sizes:', sizesCount.rows[0].count);
    console.log('product_variants:', variantsCount.rows[0].count);
    
    // Проверяем примеры данных
    console.log('\n=== ПРИМЕРЫ ДАННЫХ product_sizes ===');
    const sizesData = await pool.query('SELECT id, product_id, name, sku FROM product_sizes LIMIT 2');
    console.log(sizesData.rows);
    
    console.log('\n=== ПРИМЕРЫ ДАННЫХ product_variants ===');
    const variantsData = await pool.query('SELECT id, master_id, name, sku FROM product_variants LIMIT 2');
    console.log(variantsData.rows);
    
    // Проверяем какие API используют какие таблицы
    console.log('\n=== АНАЛИЗ ИСПОЛЬЗОВАНИЯ ===');
    console.log('product_sizes используется в старых API endpoints');
    console.log('product_variants используется в новых API v2');
    console.log('\nРЕКОМЕНДАЦИЯ: Необходима миграция с product_sizes на product_variants');
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

checkVariantSystem();