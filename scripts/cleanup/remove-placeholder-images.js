#!/usr/bin/env node

/**
 * Скрипт для удаления placeholder/тестовых изображений из базы данных
 */

const { Pool } = require('pg')

require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST,
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  user: process.env.POSTGRESQL_USER || process.env.PGUSER,
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
})

async function removePlaceholderImages() {
  try {
    // Поиск всех placeholder изображений
    const placeholderQuery = `
      SELECT id, product_id, image_url, is_main, image_order
      FROM product_images
      WHERE
        image_url LIKE '%example.com%' OR
        image_url LIKE '%s3.example.com%' OR
        image_url LIKE '%placeholder%' OR
        image_url LIKE '%test%'
      ORDER BY product_id, image_order
    `

    const placeholders = await pool.query(placeholderQuery)

    if (placeholders.rows.length === 0) {
      return
    }
    placeholders.rows.forEach((img, index) => {
    })

    // Начинаем транзакцию
    await pool.query('BEGIN')

    try {
      const deletedResults = {
        images: 0,
        updatedProducts: []
      }

      // Группируем по товарам для корректного обновления
      const productIds = [...new Set(placeholders.rows.map(img => img.product_id))]

      for (const productId of productIds) {
        const productPlaceholders = placeholders.rows.filter(img => img.product_id === productId)
        // Удаляем все placeholder изображения товара
        for (const img of productPlaceholders) {
          await pool.query('DELETE FROM product_images WHERE id = $1', [img.id])
          deletedResults.images++
        }

        // Проверяем, остались ли изображения у товара
        const remainingImages = await pool.query(
          'SELECT id, image_url FROM product_images WHERE product_id = $1 ORDER BY image_order ASC',
          [productId]
        )

        if (remainingImages.rows.length > 0) {
          // Есть оставшиеся изображения - устанавливаем первое как главное
          // Сбрасываем все is_main
          await pool.query(
            'UPDATE product_images SET is_main = false WHERE product_id = $1',
            [productId]
          )

          // Устанавливаем первое изображение как главное
          await pool.query(
            'UPDATE product_images SET is_main = true WHERE id = $1',
            [remainingImages.rows[0].id]
          )

          // Обновляем image_url в таблице products
          await pool.query(
            'UPDATE products SET image_url = $1 WHERE id = $2',
            [remainingImages.rows[0].image_url, productId]
          )

          // Упорядочиваем image_order
          await pool.query(`
            WITH ordered AS (
              SELECT id, ROW_NUMBER() OVER (ORDER BY image_order, id) AS rn
              FROM product_images
              WHERE product_id = $1
            )
            UPDATE product_images AS pi
            SET image_order = o.rn
            FROM ordered o
            WHERE pi.id = o.id;
          `, [productId])

        } else {
          // Изображений не осталось - очищаем image_url товара
          await pool.query(
            'UPDATE products SET image_url = NULL WHERE id = $1',
            [productId]
          )
        }

        deletedResults.updatedProducts.push(productId)
      }

      await pool.query('COMMIT')
      // Финальная проверка
      const finalCheck = await pool.query(placeholderQuery)

      if (finalCheck.rows.length === 0) {
      } else {
      }

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('❌ Ошибка при удалении placeholder изображений:', error.message)
  } finally {
    await pool.end()
  }
}

// Запуск если скрипт вызван напрямую
if (require.main === module) {
  removePlaceholderImages()
}