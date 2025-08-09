const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  ssl: false
});

async function cleanupDatabase() {
  const client = await pool.connect();

  try {
    console.log('=' .repeat(60));

    // Начинаем транзакцию
    await client.query('BEGIN');

    // 1. Проверяем дублированные товары
    const duplicatesCheck = await client.query(`
      SELECT
          p1.id as original_id, p1.name as original_name,
          p2.id as duplicate_id, p2.name as duplicate_name
      FROM products p1
      JOIN products p2 ON p1.name = p2.name AND p1.model_line_id = p2.model_line_id
      WHERE p1.id < p2.id
      ORDER BY p1.id
    `);

    if (duplicatesCheck.rows.length > 0) {
      duplicatesCheck.rows.forEach(row => {
      });
    } else {
    }

    // 2. Удаляем связанные записи для дублированных товаров
    const deleteFeatures = await client.query(`
      DELETE FROM product_features WHERE product_id IN (18, 19, 20, 21, 22, 23)
    `);
    const deleteMaterials = await client.query(`
      DELETE FROM product_materials WHERE product_id IN (18, 19, 20, 21, 22, 23)
    `);
    const deleteStats = await client.query(`
      DELETE FROM product_view_stats WHERE product_id IN (18, 19, 20, 21, 22, 23)
    `);
    // 3. Удаляем дублированные товары
    const deleteProducts = await client.query(`
      DELETE FROM products WHERE id IN (18, 19, 20, 21, 22, 23)
    `);
    // 4. Удаляем систему рейтингов
    try {
      await client.query('ALTER TABLE products DROP COLUMN IF EXISTS rating');
    } catch (err) {
    }

    try {
      await client.query('ALTER TABLE products DROP COLUMN IF EXISTS review_count');
    } catch (err) {
    }

    // 5. Проверяем результаты
    // Проверяем дубли
    const duplicatesAfter = await client.query(`
      SELECT name, model_line_id, COUNT(*) as count
      FROM products
      GROUP BY name, model_line_id
      HAVING COUNT(*) > 1
    `);

    if (duplicatesAfter.rows.length === 0) {
    } else {
    }

    // Итоговая статистика
    const stats = await client.query(`
      SELECT * FROM (
        SELECT
            'Производители' as type, COUNT(*) as count, 1 as order_num FROM manufacturers
        UNION ALL
        SELECT
            'Модельные ряды' as type, COUNT(*) as count, 2 as order_num FROM model_lines
        UNION ALL
        SELECT
            'Товары' as type, COUNT(*) as count, 3 as order_num FROM products
        UNION ALL
        SELECT
            'Категории' as type, COUNT(*) as count, 4 as order_num FROM categories
        UNION ALL
        SELECT
            'Материалы' as type, COUNT(*) as count, 5 as order_num FROM materials
        UNION ALL
        SELECT
            'Характеристики' as type, COUNT(*) as count, 6 as order_num FROM features
      ) as stats
      ORDER BY order_num
    `);
    stats.rows.forEach(row => {
    });

    // Проверяем структуру товаров
    const productsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    productsStructure.rows.forEach(row => {
    });

    // Проверяем целостность данных
    const integrity = await client.query(`
      SELECT
          p.id, p.name, p.model_line_id, ml.name as model_line_name, m.name as manufacturer_name
      FROM products p
      JOIN model_lines ml ON p.model_line_id = ml.id
      JOIN manufacturers m ON ml.manufacturer_id = m.id
      ORDER BY m.name, ml.name, p.name
    `);
    // Подтверждаем транзакцию
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при очистке базы данных:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await cleanupDatabase();
  } catch (error) {
    console.error('💥 Критическая ошибка:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { cleanupDatabase };