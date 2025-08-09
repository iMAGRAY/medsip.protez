const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
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

async function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(`temp_images/${filename}`)
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        resolve(false)
        return
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve(true)
      })
    }).on('error', (err) => {
      resolve(false)
    })
  })
}

async function checkS3Images() {
  try {
    // Создаем папку для временных изображений
    if (!fs.existsSync('temp_images')) {
      fs.mkdirSync('temp_images')
    }
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

    // Собираем все уникальные URL
    const allUrls = new Set()

    products.rows.forEach(product => {
      allUrls.add({
        url: product.image_url,
        source: `product_${product.id}`,
        name: product.name
      })
    })

    productImages.rows.forEach(img => {
      allUrls.add({
        url: img.image_url,
        source: `product_image_${img.id}`,
        name: img.product_name
      })
    })
    let downloadCount = 0
    let errorCount = 0

    for (const imgData of allUrls) {
      // Извлекаем имя файла из URL
      const urlParts = imgData.url.split('/')
      const filename = `${imgData.source}_${urlParts[urlParts.length - 1]}`

      // Пробуем скачать изображение
      const success = await downloadImage(imgData.url, filename)

      if (success) {
        downloadCount++

        // Проверяем размер файла
        const stats = fs.statSync(`temp_images/${filename}`)
        // Простая проверка на изображение сундука (по размеру и имени)
        if (stats.size < 1000) {
        }

      } else {
        errorCount++
      }
    }
    if (downloadCount > 0) {
    }

    // Опция удаления проблемных изображений
    if (process.argv.includes('--delete-suspicious')) {
      const files = fs.readdirSync('temp_images')
      for (const file of files) {
        const stats = fs.statSync(`temp_images/${file}`)
        if (stats.size < 1000) {
          // Извлекаем ID и тип из имени файла
          const parts = file.split('_')
          if (parts[0] === 'product') {
            const productId = parts[1]
            await pool.query('UPDATE products SET image_url = NULL WHERE id = $1', [productId])
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message)
  } finally {
    await pool.end()
  }
}

// Очистка временных файлов
function cleanup() {
  if (fs.existsSync('temp_images')) {
    const files = fs.readdirSync('temp_images')
    files.forEach(file => {
      fs.unlinkSync(`temp_images/${file}`)
    })
    fs.rmdirSync('temp_images')
  }
}

// Обработка аргументов командной строки
if (process.argv.includes('--cleanup')) {
  cleanup()
} else {
  checkS3Images()
}