require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function createMediaDeduplicationTables() {
  const pool = new Pool({
    host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
    user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
    database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
    ssl: false
  });

  try {
    // Читаем SQL файл миграции
    const migrationPath = path.join(__dirname, '../database/migrations/20250130_create_media_deduplication.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Выполняем миграцию
    await pool.query(migrationSQL);
    // Проверяем созданные таблицы
    const tablesResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('media_files', 'product_media_links')
      ORDER BY tablename
    `);
    tablesResult.rows.forEach(row => {
    });

    // Проверяем структуру таблицы media_files
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'media_files'
      ORDER BY ordinal_position
    `);
    columnsResult.rows.forEach(row => {
    });

    // Проверяем индексы
    const indexesResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('media_files', 'product_media_links')
      ORDER BY tablename, indexname
    `);
    indexesResult.rows.forEach(row => {
    });

    // Проверяем функции
    const functionsResult = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_name IN ('cleanup_unused_media_files', 'find_duplicate_by_hash')
      ORDER BY routine_name
    `);
    functionsResult.rows.forEach(row => {
    });
  } catch (error) {
    console.error('❌ Ошибка при создании таблиц дедупликации:', error);
    console.error('Детали:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Убедитесь, что PostgreSQL сервер запущен и доступен');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запуск скрипта если он вызван напрямую
if (require.main === module) {
  createMediaDeduplicationTables();
}

module.exports = { createMediaDeduplicationTables };