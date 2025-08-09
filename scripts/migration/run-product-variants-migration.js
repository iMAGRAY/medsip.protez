const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Используем предоставленные данные подключения
const DATABASE_URL = "postgresql://gen_user:Q1w2e3r4t5!%40@212.113.118.141:5432/default_db";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Начинаем миграцию системы вариантов товаров...\n');
    
    // Читаем SQL скрипт
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'create-product-variants-system.sql'), 
      'utf8'
    );
    
    // Выполняем миграцию в транзакции
    await client.query('BEGIN');
    
    console.log('📋 Выполняем SQL скрипт...');
    await client.query(sqlScript);
    
    // Проверяем результаты
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'product_variants', 
        'variant_attribute_types', 
        'variant_attribute_values',
        'variant_characteristics',
        'variant_images',
        'variant_price_tiers'
      )
      ORDER BY table_name
    `);
    
    console.log('\n✅ Созданы таблицы:');
    tablesCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Проверяем миграцию данных
    const variantsCount = await client.query(
      'SELECT COUNT(*) as count FROM product_variants'
    );
    
    console.log(`\n📊 Мигрировано вариантов: ${variantsCount.rows[0].count}`);
    
    // Проверяем представления
    const viewsCheck = await client.query(`
      SELECT viewname 
      FROM pg_views 
      WHERE schemaname = 'public' 
      AND viewname = 'v_product_variants_full'
    `);
    
    if (viewsCheck.rows.length > 0) {
      console.log('\n✅ Создано представление: v_product_variants_full');
    }
    
    await client.query('COMMIT');
    console.log('\n🎉 Миграция успешно завершена!');
    
    // Выводим примеры вариантов
    const examples = await client.query(`
      SELECT 
        pv.id,
        pv.name,
        pv.sku,
        pv.attributes,
        p.name as master_product
      FROM product_variants pv
      JOIN products p ON pv.master_id = p.id
      WHERE pv.is_active = true
      LIMIT 5
    `);
    
    if (examples.rows.length > 0) {
      console.log('\n📋 Примеры вариантов:');
      examples.rows.forEach(variant => {
        console.log(`\n   ID: ${variant.id}`);
        console.log(`   Название: ${variant.name}`);
        console.log(`   Товар: ${variant.master_product}`);
        console.log(`   SKU: ${variant.sku || 'Не указан'}`);
        console.log(`   Атрибуты: ${JSON.stringify(variant.attributes)}`);
      });
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Ошибка при выполнении миграции:', error.message);
    console.error('\nДетали ошибки:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем миграцию
runMigration().catch(console.error);