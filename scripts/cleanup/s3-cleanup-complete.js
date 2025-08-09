const { S3Client, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')
require('dotenv').config({ path: '.env.local' })

// Используем MCP PostgreSQL API для подключения к БД
const { Pool } = require('pg')

function getPool() {
  return new Pool({
    host: process.env.POSTGRESQL_HOST,
    port: parseInt(process.env.POSTGRESQL_PORT || '5432'),
    database: process.env.POSTGRESQL_DBNAME,
    user: process.env.POSTGRESQL_USER,
    password: process.env.POSTGRESQL_PASSWORD,
  })
}

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME

async function cleanupS3Database() {
  const pool = getPool()

  try {
    // 1. АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ
    const mediaFilesCount = await pool.query('SELECT COUNT(*) FROM media_files')
    const productImagesCount = await pool.query('SELECT COUNT(*) FROM product_images')
    const productsWithImages = await pool.query('SELECT COUNT(*) FROM products WHERE image_url IS NOT NULL OR array_length(images, 1) > 0')
    // 2. АНАЛИЗ S3 ФАЙЛОВ
    let s3Files = []
    let totalS3Size = 0

    if (!S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
    } else {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: 'products/',
        })

        const s3Response = await s3Client.send(listCommand)
        s3Files = s3Response.Contents || []
        totalS3Size = s3Files.reduce((sum, file) => sum + (file.Size || 0), 0)
        // Группировка по типам файлов
        const fileTypes = {}
        s3Files.forEach(file => {
          const ext = file.Key.split('.').pop()?.toLowerCase() || 'unknown'
          fileTypes[ext] = (fileTypes[ext] || 0) + 1
        })
        Object.entries(fileTypes).forEach(([ext, count]) => {
        })
      } catch (error) {
      }
    }

    // 3. ПОИСК ПРОБЛЕМ
    // Неиспользуемые файлы в media_files
    const unusedMediaFiles = await pool.query(`
      SELECT mf.id, mf.original_name, mf.s3_url, mf.s3_key, mf.file_size
      FROM media_files mf
      WHERE mf.s3_url NOT IN (
        SELECT COALESCE(image_url, '') FROM products WHERE image_url IS NOT NULL
        UNION
        SELECT COALESCE(image_url, '') FROM product_images WHERE image_url IS NOT NULL
      )
      ORDER BY mf.created_at DESC
    `)
    // Несоответствия s3_key и s3_url
    const inconsistentFiles = await pool.query(`
      SELECT id, original_name, s3_key, s3_url
      FROM media_files
      WHERE s3_key != SUBSTRING(s3_url FROM 'products/.*')
    `)
    // Битые ссылки в продуктах
    const orphanedProductImages = await pool.query(`
      SELECT p.id, p.name, p.image_url
      FROM products p
      WHERE p.image_url IS NOT NULL
      AND p.image_url NOT IN (SELECT s3_url FROM media_files)
    `)
    // 4. ПЛАН ОЧИСТКИ
    let operationsCount = 0

    if (unusedMediaFiles.rows.length > 0) {
      operationsCount++
    }

    if (inconsistentFiles.rows.length > 0) {
      operationsCount++
    }

    if (s3Files.length > 0) {
      operationsCount++
    }

    if (operationsCount === 0) {
      return
    }

    // 5. ВЫПОЛНЕНИЕ ОЧИСТКИ
    let cleanedCount = 0
    let errorCount = 0

    // 5.1. Удаление неиспользуемых записей из media_files
    if (unusedMediaFiles.rows.length > 0) {
      for (const file of unusedMediaFiles.rows) {
        try {
          // Удаляем из S3 если файл существует
          if (s3Files.find(s3File => s3File.Key === file.s3_key)) {
            try {
              await s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: file.s3_key
              }))
            } catch (s3Error) {
            }
          }

          // Удаляем из БД
          await pool.query('DELETE FROM media_files WHERE id = $1', [file.id])
          cleanedCount++

        } catch (error) {
          errorCount++
        }
      }
    }

    // 5.2. Исправление несоответствий s3_key/s3_url
    if (inconsistentFiles.rows.length > 0) {
      for (const file of inconsistentFiles.rows) {
        try {
          // Извлекаем правильный s3_key из s3_url
          const urlParts = file.s3_url.split('/')
          const fileName = urlParts[urlParts.length - 1]
          const correctS3Key = `products/${fileName}`

          await pool.query(
            'UPDATE media_files SET s3_key = $1 WHERE id = $2',
            [correctS3Key, file.id]
          )
          cleanedCount++

        } catch (error) {
          errorCount++
        }
      }
    }

    // 5.3. Очистка S3 от файлов без записей в БД
    if (s3Files.length > 0) {
      const registeredS3Keys = await pool.query('SELECT s3_key FROM media_files')
      const registeredKeys = new Set(registeredS3Keys.rows.map(row => row.s3_key))

      for (const s3File of s3Files) {
        if (!registeredKeys.has(s3File.Key)) {
          try {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: S3_BUCKET,
              Key: s3File.Key
            }))
            cleanedCount++
          } catch (error) {
            errorCount++
          }
        }
      }
    }

    // 6. ФИНАЛЬНАЯ СТАТИСТИКА
    const finalMediaFiles = await pool.query('SELECT COUNT(*) FROM media_files')
    const finalProducts = await pool.query('SELECT COUNT(*) FROM products')

    let finalS3Count = 0
    if (S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      try {
        const finalS3Response = await s3Client.send(new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: 'products/',
        }))
        finalS3Count = (finalS3Response.Contents || []).length
      } catch (error) {
      }
    }
    // 7. РЕКОМЕНДАЦИИ
    if (finalMediaFiles.rows[0].count === '0') {
    }

    if (finalS3Count === 0) {
    }
  } catch (error) {
    console.error('❌ Критическая ошибка при очистке:', error)
    throw error
  } finally {
    await pool.end()
  }
}

// Запуск очистки
if (require.main === module) {
  cleanupS3Database().catch(console.error)
}

module.exports = { cleanupS3Database }