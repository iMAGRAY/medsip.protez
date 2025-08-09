const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db'
});

async function setupProductSizes() {
  try {
    // Читаем SQL схему из файла
    const schemaPath = path.join(__dirname, '..', 'database', 'product-sizes-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Выполняем SQL схему
    await pool.query(schemaSql);
    // Проверяем созданные таблицы
    const tablesResult = await pool.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns_count
      FROM information_schema.tables t
      WHERE table_name IN ('product_sizes', 'size_charts', 'size_chart_values')
      ORDER BY table_name
    `);

    tablesResult.rows.forEach(table => {
    });

    // Проверяем размерные сетки
    const sizeChartsResult = await pool.query(`
      SELECT sc.name, sc.size_type, sc.unit, COUNT(scv.id) as values_count
      FROM size_charts sc
      LEFT JOIN size_chart_values scv ON sc.id = scv.size_chart_id
      GROUP BY sc.id, sc.name, sc.size_type, sc.unit
      ORDER BY sc.id
    `);

    sizeChartsResult.rows.forEach(chart => {
    });

    // Проверяем значения размеров
    const valuesResult = await pool.query(`
      SELECT COUNT(*) as total_values FROM size_chart_values
    `);
    // Создаем пример размеров для существующих продуктов
    // Получаем случайный продукт для демонстрации
    const productsResult = await pool.query(`
      SELECT id, name FROM products LIMIT 3
    `);

    if (productsResult.rows.length > 0) {
      for (const product of productsResult.rows) {
        // Создаем размеры для первого продукта
        await pool.query(`
          INSERT INTO product_sizes (product_id, size_name, size_value, sku, price, stock_quantity, weight, is_available, sort_order)
          VALUES
            ($1, 'S', 'S', $2, 45000.00, 5, 1.2, true, 1),
            ($1, 'M', 'M', $3, 47000.00, 8, 1.4, true, 2),
            ($1, 'L', 'L', $4, 49000.00, 3, 1.6, true, 3)
          ON CONFLICT (product_id, size_name) DO NOTHING
        `, [
          product.id,
          `${product.name}-S-${Date.now()}`,
          `${product.name}-M-${Date.now()}`,
          `${product.name}-L-${Date.now()}`
        ]);
      }
    }

    // Итоговая статистика
    const finalStats = await pool.query(`
      SELECT
        'Размерные сетки' as type, COUNT(*) as count
      FROM size_charts
      UNION ALL
      SELECT
        'Значения размеров' as type, COUNT(*) as count
      FROM size_chart_values
      UNION ALL
      SELECT
        'Размеры продуктов' as type, COUNT(*) as count
      FROM product_sizes
    `);

    finalStats.rows.forEach(stat => {
    });
  } catch (error) {
    console.error('❌ Ошибка настройки размерного ряда:', error.message);
    console.error('Детали:', error);
  } finally {
    await pool.end();
  }
}

setupProductSizes();