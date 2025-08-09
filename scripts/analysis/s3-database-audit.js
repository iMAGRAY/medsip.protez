const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3')
require('dotenv').config({ path: '.env.local' })

// Переиспользуем настройки подключения
const { Pool } = require('pg')

function getPool() {
  return new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })
}

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
})

const S3_BUCKET = process.env.S3_BUCKET

async function auditS3Database() {
  const pool = getPool()

  try {
    // 1. Анализ таблиц медиа в БД
    const mediaFilesCount = await pool.query('SELECT COUNT(*) FROM media_files')
    const productImagesCount = await pool.query('SELECT COUNT(*) FROM product_images WHERE image_url IS NOT NULL')
    const productsWithImagesCount = await pool.query('SELECT COUNT(*) FROM products WHERE image_url IS NOT NULL')
    // 2. Анализ S3 файлов
    if (!S3_BUCKET || !process.env.S3_ACCESS_KEY) {
    } else {
      const listCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: 'products/',
      })

      const s3Response = await s3Client.send(listCommand)
      const s3Files = s3Response.Contents || []
      // Группировка по типам файлов
      const fileTypes = {}
      let totalSize = 0

      s3Files.forEach(file => {
        const ext = file.Key.split('.').pop()?.toLowerCase() || 'unknown'
        fileTypes[ext] = (fileTypes[ext] || 0) + 1
        totalSize += file.Size || 0
      })
      Object.entries(fileTypes).forEach(([ext, count]) => {
      })
    }

    // 3. Поиск дубликатов в БД
    // Дубликаты по хешу в media_files
    const hashDuplicates = await pool.query(`
      SELECT file_hash, COUNT(*) as count
      FROM media_files
      GROUP BY file_hash
      HAVING COUNT(*) > 1
    `)
    // Дубликаты URL в product_images
    const urlDuplicates = await pool.query(`
      SELECT image_url, COUNT(*) as count
      FROM product_images
      GROUP BY image_url
      HAVING COUNT(*) > 1
    `)
    // 4. Поиск битых ссылок
    // Продукты с image_url, которых нет в media_files
    const orphanedProductImages = await pool.query(`
      SELECT p.id, p.name, p.image_url
      FROM products p
      WHERE p.image_url IS NOT NULL
      AND p.image_url NOT IN (SELECT s3_url FROM media_files)
      ORDER BY p.id
    `)
    // product_images с битыми ссылками
    const orphanedImages = await pool.query(`
      SELECT pi.id, pi.product_id, pi.image_url
      FROM product_images pi
      WHERE pi.image_url NOT IN (SELECT s3_url FROM media_files)
      ORDER BY pi.product_id
    `)
    // 5. Поиск неиспользуемых файлов в media_files
    const unusedMediaFiles = await pool.query(`
      SELECT mf.id, mf.original_name, mf.s3_url, mf.file_size
      FROM media_files mf
      WHERE mf.s3_url NOT IN (SELECT image_url FROM products WHERE image_url IS NOT NULL)
      AND mf.s3_url NOT IN (SELECT image_url FROM product_images WHERE image_url IS NOT NULL)
      ORDER BY mf.created_at DESC
    `)
    const unusedSize = unusedMediaFiles.rows.reduce((sum, file) => sum + (file.file_size || 0), 0)
    // 6. Детальный отчет
    if (orphanedProductImages.rows.length > 0) {
      orphanedProductImages.rows.slice(0, 10).forEach(product => {
      })
      if (orphanedProductImages.rows.length > 10) {
      }
    }

    if (unusedMediaFiles.rows.length > 0) {
      console.log('\n🗑️ НЕИСПОЛЬЗУЕМЫЕ ФАЙЛЫ (первые 10):')
      unusedMediaFiles.rows.slice(0, 10).forEach(file => {
      })
      if (unusedMediaFiles.rows.length > 10) {
      }
    }

    if (hashDuplicates.rows.length > 0) {
      console.log('\n🔄 ДУБЛИКАТЫ ПО ХЕШУ (первые 5):')
      for (let i = 0; i < Math.min(5, hashDuplicates.rows.length); i++) {
        const dup = hashDuplicates.rows[i]
        const files = await pool.query(
          'SELECT id, original_name, s3_url FROM media_files WHERE file_hash = $1',
          [dup.file_hash]
        )
        files.rows.forEach(file => {
        })
      }
    }

    // 7. Рекомендации
    if (hashDuplicates.rows.length > 0) {
    }

    if (orphanedProductImages.rows.length > 0) {
    }

    if (orphanedImages.rows.length > 0) {
    }

    if (unusedMediaFiles.rows.length > 0) {
    }
  } catch (error) {
    console.error('❌ Ошибка при аудите:', error)
  } finally {
    await pool.end()
  }
}

// Запуск аудита
auditS3Database().catch(console.error)