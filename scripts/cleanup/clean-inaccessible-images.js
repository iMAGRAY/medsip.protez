const { Pool } = require('pg')
const https = require('https')

// Подключение к PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  ssl: false
})

async function checkImageAccess(url) {
  return new Promise((resolve) => {
    const request = https.get(url, (response) => {
      resolve(response.statusCode === 200)
    })

    request.on('error', () => {
      resolve(false)
    })

    // Таймаут для быстрой проверки
    request.setTimeout(5000, () => {
      request.destroy()
      resolve(false)
    })
  })
}

async function cleanInaccessibleImages() {
  try {
    // Получаем все изображения из базы данных
    const products = await pool.query(`
      SELECT id, name, image_url
      FROM products
      WHERE image_url IS NOT NULL AND image_url != ''
      ORDER BY id
    `)

    const productImages = await pool.query(`
      SELECT pi.id, pi.product_id, pi.image_url, p.name as product_name
      FROM product_images pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.image_url IS NOT NULL AND pi.image_url != ''
      ORDER BY pi.product_id
    `)

    let checkedCount = 0
    let inaccessibleProducts = []
    let inaccessibleProductImages = []

    // Проверяем доступность изображений товаров
    for (const product of products.rows) {
      checkedCount++
      const isAccessible = await checkImageAccess(product.image_url)

      if (isAccessible) {
      } else {
        console.log('   ❌ Недоступно (403/ошибка)')
        inaccessibleProducts.push(product)
      }
    }

    // Проверяем доступность дополнительных изображений
    for (const img of productImages.rows) {
      checkedCount++
      const isAccessible = await checkImageAccess(img.image_url)

      if (isAccessible) {
      } else {
        console.log('   ❌ Недоступно (403/ошибка)')
        inaccessibleProductImages.push(img)
      }
    }

    // Выводим статистику
    // Если есть недоступные изображения, предлагаем удалить
    const totalInaccessible = inaccessibleProducts.length + inaccessibleProductImages.length

    if (totalInaccessible > 0) {
      if (process.argv.includes('--delete')) {
        // Удаляем недоступные изображения товаров
        for (const product of inaccessibleProducts) {
          await pool.query('UPDATE products SET image_url = NULL WHERE id = $1', [product.id])
        }

        // Удаляем недоступные дополнительные изображения
        for (const img of inaccessibleProductImages) {
          await pool.query('DELETE FROM product_images WHERE id = $1', [img.id])
        }
        console.log('📱 Теперь обновите страницы в браузере (Ctrl+F5) чтобы увидеть изменения')

      } else {
        if (inaccessibleProducts.length > 0) {
          inaccessibleProducts.forEach((product, index) => {
          })
        }

        if (inaccessibleProductImages.length > 0) {
          inaccessibleProductImages.forEach((img, index) => {
          })
        }
      }
    } else {
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message)
  } finally {
    await pool.end()
  }
}

cleanInaccessibleImages()