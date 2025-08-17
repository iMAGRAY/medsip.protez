const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Начинаем обновление системы вариантов товаров...\n');
    
    // Читаем SQL скрипт
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'update-product-variants-system.sql'), 
      'utf8'
    );
    
    // Выполняем миграцию в транзакции
    await client.query('BEGIN');
    
    console.log('📋 Выполняем SQL скрипт обновления...');
    await client.query(sqlScript);
    
    await client.query('COMMIT');
    console.log('\n🎉 Обновление успешно завершено!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Ошибка при выполнении обновления:', error.message);
    console.error('\nДетали ошибки:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем миграцию
runMigration().catch(console.error);
