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
