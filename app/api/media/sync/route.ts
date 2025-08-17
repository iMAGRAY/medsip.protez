import { NextRequest, NextResponse } from "next/server"
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getPool } from "@/lib/db-connection"
import { calculateFileHashFromUrl } from "@/lib/file-hash"

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'https://s3.amazonaws.com',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
})

const S3_BUCKET = process.env.S3_BUCKET!

// POST /api/media/sync - Синхронизация файлов из S3 в базу данных
export async function POST(_request: NextRequest) {
  const pool = getPool()

  try {

    // Получаем все файлы из S3
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'products/',
    })

    const response = await s3Client.send(listCommand)

    if (!response.Contents || response.Contents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Файлы в S3 не найдены",
        synced: 0,
        skipped: 0
      })
    }

    // Получаем уже зарегистрированные файлы
    const existingResult = await pool.query(
      'SELECT s3_key FROM media_files'
    )
    const existingKeys = new Set(existingResult.rows.map(row => row.s3_key))

    let synced = 0
    let skipped = 0
    let errors = 0

    // Обрабатываем каждый файл
    for (const obj of response.Contents) {
      if (!obj.Key || !obj.Size || obj.Size <= 0) {
        skipped++
        continue
      }

      // Пропускаем уже зарегистрированные файлы
      if (existingKeys.has(obj.Key)) {
        skipped++
        continue
      }

      try {
        // Получаем метаданные файла
        const headCommand = new HeadObjectCommand({
          Bucket: S3_BUCKET,
          Key: obj.Key,
        })

        const headResponse = await s3Client.send(headCommand)

        const fileName = obj.Key.split('/').pop() || obj.Key
        const extension = fileName.split('.').pop()?.toLowerCase() || ''
        const mimeType = headResponse.ContentType || 'application/octet-stream'
        const s3Url = `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${obj.Key}`

        // Вычисляем хеш файла
        let fileHash: string
        try {
          fileHash = await calculateFileHashFromUrl(s3Url)
        } catch (_hashError) {
          fileHash = obj.Key.replace(/[^a-zA-Z0-9]/g, '')
        }

        // Проверяем, нет ли файла с таким хешем
        const hashCheck = await pool.query(
          'SELECT id FROM media_files WHERE file_hash = $1',
          [fileHash]
        )

        if (hashCheck.rows.length > 0) {
skipped++
          continue
        }

        // Регистрируем файл в базе данных
        await pool.query(`
          INSERT INTO media_files (
            file_hash,
            original_name,
            file_extension,
            file_size,
            mime_type,
            s3_key,
            s3_url,
            width,
            height,
            upload_count,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          fileHash,
          fileName,
          extension,
          obj.Size,
          mimeType,
          obj.Key,
          s3Url,
          null, // width
          null, // height
          1,    // upload_count
          JSON.stringify({
            syncedAt: new Date().toISOString(),
            s3LastModified: obj.LastModified?.toISOString()
          })
        ])

        synced++

      } catch (error) {
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Синхронизация завершена`,
      synced,
      skipped,
      errors,
      total: response.Contents.length
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при синхронизации файлов",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}