#!/usr/bin/env node

/**
 * Скрипт для поиска и удаления изображений сундуков из базы данных
 */

const { Pool } = require('pg')

// Создаем пул подключений
function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'medsip_protez'}`
  })
}

async function findAndDeleteChestImages() {
  const pool = getPool()
  try {
    // Поиск изображений сундуков по разным критериям
    const searchQuery = `
      SELECT id, product_id, image_url, alt_text, is_main
      FROM product_images
      WHERE
        image_url ILIKE '%chest%' OR
        image_url ILIKE '%trunk%' OR
        image_url ILIKE '%сундук%' OR
        image_url ILIKE '%sunduk%' OR
        image_url ILIKE '%box%' OR
        alt_text ILIKE '%сундук%' OR
        alt_text ILIKE '%chest%' OR
        alt_text ILIKE '%trunk%'
      ORDER BY id
    `

    const chestImages = await pool.query(searchQuery)

    if (chestImages.rows.length === 0) {
      return
    }
    chestImages.rows.forEach((img, index) => {
      if (img.alt_text) {
      }
    })

    // Удаление найденных изображений
    await pool.query('BEGIN')

    try {
      const deletedResults = {
        images: 0,
        updatedProducts: []
      }

      for (const img of chestImages.rows) {
        // Удаляем изображение
        await pool.query('DELETE FROM product_images WHERE id = $1', [img.id])
        deletedResults.images++

        // Если это было главное изображение, находим новое главное
        if (img.is_main) {
          const remainingImages = await pool.query(
            'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY image_order ASC LIMIT 1',
            [img.product_id]
          )

          if (remainingImages.rows.length > 0) {
            // Устанавливаем новое главное изображение
            await pool.query(
              'UPDATE product_images SET is_main = true WHERE product_id = $1 AND image_url = $2',
              [img.product_id, remainingImages.rows[0].image_url]
            )

            await pool.query(
              'UPDATE products SET image_url = $1 WHERE id = $2',
              [remainingImages.rows[0].image_url, img.product_id]
            )
          } else {
            // Если изображений не осталось, очищаем image_url товара
            await pool.query(
              'UPDATE products SET image_url = NULL WHERE id = $1',
              [img.product_id]
            )
          }

          deletedResults.updatedProducts.push(img.product_id)
        }
      }

      // Упорядочиваем image_order для всех затронутых товаров
      const affectedProductIds = [...new Set(chestImages.rows.map(img => img.product_id))]

      for (const productId of affectedProductIds) {
        await pool.query(`
          WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY image_order) AS rn
            FROM product_images
            WHERE product_id = $1
          )
          UPDATE product_images AS pi
          SET image_order = o.rn
          FROM ordered o
          WHERE pi.id = o.id;
        `, [productId])
      }

      await pool.query('COMMIT')
      if (deletedResults.updatedProducts.length > 0) {
      }

      // Финальная проверка
      const finalCheck = await pool.query(searchQuery)

      if (finalCheck.rows.length === 0) {
      } else {
      }

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('❌ Ошибка при работе с изображениями сундуков:', error.message)
  } finally {
    await pool.end()
  }
}

// Запуск если скрипт вызван напрямую
if (require.main === module) {
  findAndDeleteChestImages()
}