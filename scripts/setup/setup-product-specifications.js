#!/usr/bin/env node

// Используем динамический импорт для ES модулей
const { getPool } = require('../lib/db-connection.ts');
const fs = require('fs');
const path = require('path');
async function setupProductSpecifications() {
  const pool = getPool();

  try {
    // Читаем и применяем схему
    const schemaPath = path.join(__dirname, '..', 'database', 'product-specifications-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schemaSql);
    // Проверяем создание таблицы
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'product_specifications'
    `);

    if (tableCheck.rows.length === 0) {
      throw new Error('Таблица product_specifications не была создана');
    }
    // Получаем существующие товары для примеров
    const productsResult = await pool.query('SELECT id, name FROM products LIMIT 5');
    const products = productsResult.rows;

    if (products.length === 0) {
      return;
    }
    // Добавляем примеры характеристик для первых товаров
    const exampleSpecs = [
      // Характеристики для первого товара
      {
        product_id: products[0].id,
        specs: [
          { name: 'Вес', value: '1.2 кг', type: 'weight', unit: 'кг', numeric: 1.2, primary: true },
          { name: 'Время работы', value: '16 часов', type: 'duration', unit: 'часы', numeric: 16, primary: true },
          { name: 'Гарантия', value: '3 года', type: 'warranty', unit: 'годы', numeric: 3, primary: true },
          { name: 'Рабочая температура', value: '-10°C до +45°C', type: 'temperature', unit: '°C', numeric: null, primary: false },
          { name: 'Степень защиты', value: 'IP67', type: 'text', unit: null, numeric: null, primary: false },
          { name: 'Время зарядки', value: '2 часа', type: 'duration', unit: 'часы', numeric: 2, primary: false }
        ]
      }
    ];

    // Добавляем характеристики если их еще нет
    const existingSpecs = await pool.query('SELECT COUNT(*) as count FROM product_specifications');

    if (existingSpecs.rows[0].count == 0) {
      for (const productSpecs of exampleSpecs) {
        for (const [index, spec] of productSpecs.specs.entries()) {
          await pool.query(`
            INSERT INTO product_specifications (
              product_id, spec_name, spec_value, spec_type, unit,
              numeric_value, is_primary, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            productSpecs.product_id,
            spec.name,
            spec.value,
            spec.type,
            spec.unit,
            spec.numeric,
            spec.primary,
            index + 1
          ]);
        }
      }

      const finalCount = await pool.query('SELECT COUNT(*) as count FROM product_specifications');
    } else {
    }

    // Показываем статистику
    const statsQuery = await pool.query(`
      SELECT
        ps.spec_name,
        COUNT(*) as count,
        COUNT(CASE WHEN ps.is_primary THEN 1 END) as primary_count
      FROM product_specifications ps
      GROUP BY ps.spec_name
      ORDER BY count DESC
    `);
    statsQuery.rows.forEach(stat => {
    });
  } catch (error) {
    console.error('❌ Ошибка настройки характеристик:', error);
    throw error;
  }
}

// Запускаем настройку
setupProductSpecifications()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });