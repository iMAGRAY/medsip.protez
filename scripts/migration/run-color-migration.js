const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function runColorMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    // Читаем миграцию
    const migrationPath = path.join(__dirname, '../database/migrations/20250130_add_color_support.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    // Выполняем миграцию
    const result = await client.query(migrationSQL);
    // Проверяем, что поле добавлено
    const checkResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_characteristics'
      AND column_name = 'value_color'
    `);

    if (checkResult.rows.length > 0) {
    } else {
    }

  } catch (error) {
    console.error('❌ Ошибка выполнения миграции:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Запускаем миграцию если файл вызывается напрямую
if (require.main === module) {
  runColorMigration();
}

module.exports = runColorMigration;