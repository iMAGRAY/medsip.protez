const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3')
require('dotenv').config({ path: '.env.local' })

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

async function cleanupS3Files() {
  if (!S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
    return
  }

  try {
    // 1. Получаем все файлы в S3
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'products/',
    })

    const s3Response = await s3Client.send(listCommand)
    const s3Files = s3Response.Contents || []
    if (s3Files.length === 0) {
      return
    }

    // Показываем детали файлов
    let totalSize = 0
    const fileTypes = {}

    s3Files.forEach(file => {
      const ext = file.Key.split('.').pop()?.toLowerCase() || 'unknown'
      fileTypes[ext] = (fileTypes[ext] || 0) + 1
      totalSize += file.Size || 0
    })
    Object.entries(fileTypes).forEach(([ext, count]) => {
    })

    // 2. Удаление файлов
    let deletedCount = 0
    let errorCount = 0
    for (const file of s3Files) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: file.Key
        }))
        deletedCount++

      } catch (error) {
        errorCount++
      }
    }

    // 3. Финальная проверка
    const finalListCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'products/',
    })

    const finalS3Response = await s3Client.send(finalListCommand)
    const finalS3Files = finalS3Response.Contents || []
    if (finalS3Files.length === 0) {
    } else {
      finalS3Files.forEach(file => {
      })
    }

  } catch (error) {
    console.error('❌ Ошибка при очистке S3:', error)
    throw error
  }
}

// Запуск очистки
if (require.main === module) {
  cleanupS3Files().catch(console.error)
}

module.exports = { cleanupS3Files }