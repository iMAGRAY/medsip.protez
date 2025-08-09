const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupProductSizesFixed() {
  // Подключение из .env.local
  const pool = new Pool({
    host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
    user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
    database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
    ssl: false
  });

  try {
    // Проверяем подключение
    await pool.query('SELECT 1');
    // Читаем исправленную SQL-схему
    const schemaPath = path.join(__dirname, '..', 'database', 'product-sizes-schema-fixed.sql');

    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Файл схемы не найден:', schemaPath);
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    // Выполняем SQL-схему
    const result = await pool.query(schema);
    // Проверяем созданные таблицы
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('product_sizes', 'size_charts', 'size_chart_values')
      ORDER BY table_name
    `;

    const tablesResult = await pool.query(tablesQuery);
    tablesResult.rows.forEach(row => {
    });

    // Проверяем данные
    const chartsCount = await pool.query('SELECT COUNT(*) FROM size_charts');
    const valuesCount = await pool.query('SELECT COUNT(*) FROM size_chart_values');
    // Показываем примеры размерных сеток
    const chartsExample = await pool.query('SELECT name, size_type, unit FROM size_charts ORDER BY id');
    chartsExample.rows.forEach(chart => {
    });
  } catch (error) {
    console.error('❌ Ошибка настройки размерного ряда:', error.message);
    console.error('Детали:', error);
  } finally {
    await pool.end();
  }
}

setupProductSizesFixed();