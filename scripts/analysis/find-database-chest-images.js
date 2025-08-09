const { Pool } = require('pg')

// Подключение к удаленной PostgreSQL базе
const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  ssl: false
})

async function findAllDatabaseImages() {
  try {
    // Поиск в таблице products
    const products = await pool.query(`
      SELECT id, name, image_url
      FROM products
      WHERE image_url IS NOT NULL AND image_url != ''
      ORDER BY id
    `)
    products.rows.forEach(product => {
    })

    // Поиск в таблице product_images
    try {
      const productImages = await pool.query(`
        SELECT pi.id, pi.product_id, pi.image_url, p.name as product_name
        FROM product_images pi
        LEFT JOIN products p ON pi.product_id = p.id
        WHERE pi.image_url IS NOT NULL AND pi.image_url != ''
        ORDER BY pi.product_id
      `)
      productImages.rows.forEach(img => {
      })
    } catch (error) {
    }

    // Поиск в таблице media
    try {
      const media = await pool.query(`
        SELECT id, filename, url, file_type, file_size, created_at
        FROM media
        ORDER BY created_at DESC
      `)
      media.rows.forEach(file => {
      })
    } catch (error) {
    }

    // Поиск подозрительных изображений (возможные сундуки)
    const suspiciousImages = []

    // Проверяем products
    products.rows.forEach(product => {
      const url = product.image_url.toLowerCase()
      if (url.includes('chest') || url.includes('trunk') || url.includes('сундук') ||
          url.includes('example.com') || url.includes('placeholder') || url.includes('demo') ||
          !url.startsWith('https://') || url.endsWith('.jpg\n') || url.includes('undefined')) {
        suspiciousImages.push({
          type: 'product',
          id: product.id,
          name: product.name,
          url: product.image_url
        })
      }
    })

    if (suspiciousImages.length > 0) {
      suspiciousImages.forEach((img, index) => {
        if (img.product_id) console.log(`     Товар ID: ${img.product_id} (${img.product_name})`)
        if (img.name) console.log(`     Товар: ${img.name}`)
      })

      // Опция удаления
      if (process.argv.includes('--delete')) {
        for (const img of suspiciousImages) {
          if (img.type === 'product') {
            await pool.query('UPDATE products SET image_url = NULL WHERE id = $1', [img.id])
          }
        }
      } else {
      }
    } else {
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message)
  } finally {
    await pool.end()
  }
}

// Запуск скрипта
findAllDatabaseImages()