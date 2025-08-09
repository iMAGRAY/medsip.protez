#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
// Конфигурация подключения к БД
const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  ssl: false
});

async function setupSpecs() {
  try {
    // Применяем схему
    const schemaPath = path.join(__dirname, '..', 'database', 'product-specifications-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schemaSql);
    // Проверяем таблицу
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'product_specifications'
    `);

    if (tableCheck.rows.length === 0) {
      throw new Error('Таблица не создана');
    }
    // Получаем товары
    const products = await pool.query('SELECT id, name FROM products ORDER BY id LIMIT 3');
    if (products.rows.length === 0) {
      return;
    }

    // Проверяем есть ли уже характеристики
    const existing = await pool.query('SELECT COUNT(*) as count FROM product_specifications');

    if (existing.rows[0].count > 0) {
      return;
    }

    // Добавляем примеры характеристик для первого товара
    const productId = products.rows[0].id;
    const specs = [
      { name: 'Вес', value: '1.2 кг', type: 'weight', unit: 'кг', numeric: 1.2, primary: true, order: 1 },
      { name: 'Время работы', value: '16 часов', type: 'duration', unit: 'часы', numeric: 16, primary: true, order: 2 },
      { name: 'Гарантия', value: '3 года', type: 'warranty', unit: 'годы', numeric: 3, primary: true, order: 3 },
      { name: 'Степень защиты', value: 'IP67', type: 'text', unit: null, numeric: null, primary: false, order: 4 },
      { name: 'Время зарядки', value: '2 часа', type: 'duration', unit: 'часы', numeric: 2, primary: false, order: 5 }
    ];
    for (const spec of specs) {
      await pool.query(`
        INSERT INTO product_specifications (
          product_id, spec_name, spec_value, spec_type, unit,
          numeric_value, is_primary, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        productId, spec.name, spec.value, spec.type, spec.unit,
        spec.numeric, spec.primary, spec.order
      ]);
    }

    const finalCount = await pool.query('SELECT COUNT(*) as count FROM product_specifications');
    // Статистика
    const stats = await pool.query(`
      SELECT
        ps.spec_name,
        COUNT(*) as count,
        COUNT(CASE WHEN ps.is_primary THEN 1 END) as primary_count
      FROM product_specifications ps
      GROUP BY ps.spec_name
      ORDER BY count DESC
    `);
    stats.rows.forEach(stat => {
    });
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

setupSpecs()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });