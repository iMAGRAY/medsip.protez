import { NextRequest, NextResponse } from "next/server"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getPool } from "@/lib/db-connection"

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

// DELETE /api/media/delete - Delete image from S3 AND database
export async function DELETE(request: NextRequest) {
  const pool = getPool()

  try {
    // Поддерживаем и query параметры и JSON body
    let url: string | null = null
    let key: string | null = null

    // Сначала пробуем получить из query параметров
    const { searchParams } = new URL(request.url)
    url = searchParams.get('url')
    key = searchParams.get('key')

    // Если нет query параметров, пробуем JSON body
    if (!url && !key) {
      try {
        const body = await request.json()
        url = body.url
        key = body.key
      } catch (e) {
        // Игнорируем ошибки парсинга JSON
      }
    }

    if (!url && !key) {
      return NextResponse.json(
        { error: "Either 'url' or 'key' parameter is required" },
        { status: 400 }
      )
    }

    // Удаляем query-параметры из URL, чтобы правильно извлечь S3 ключ
    if (url) {
      const queryIndex = url.indexOf('?')
      if (queryIndex !== -1) {
        url = url.substring(0, queryIndex)
      }
    }

    // Определяем S3 ключ
    let s3Key = key

    // Extract key from URL if only URL is provided
    if (!s3Key && url) {
      try {
        const urlParts = url.split('/')

        // Метод 1: Поиск по имени бакета
        const bucketIndex = urlParts.findIndex(part => part === S3_BUCKET)
        if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
          s3Key = urlParts.slice(bucketIndex + 1).join('/')

        } else {
          // Метод 2: Извлечение последних частей после домена
          const protocolIndex = urlParts.findIndex(part => part.includes('://'))
          if (protocolIndex !== -1 && protocolIndex + 2 < urlParts.length) {
            // Пропускаем протокол и домен, берем остальное
            s3Key = urlParts.slice(protocolIndex + 2).join('/')

          } else {
            // Метод 3: Попробуем найти 'products/' и взять от него
            const productsIndex = urlParts.findIndex(part => part === 'products')
            if (productsIndex !== -1) {
              s3Key = urlParts.slice(productsIndex).join('/')

            } else {

              return NextResponse.json(
                {
                  error: "Could not extract S3 key from URL",
                  debug: { urlParts, bucket: S3_BUCKET }
                },
                { status: 400 }
              )
            }
          }
        }
      } catch (error) {
        console.error('❌ Error extracting key from URL:', error)
        return NextResponse.json(
          { error: "Failed to extract key from URL" },
          { status: 400 }
        )
      }
    }

    if (!s3Key) {
      return NextResponse.json(
        { error: "Could not determine S3 key" },
        { status: 400 }
      )
    }

    // Начинаем транзакцию для полного удаления
    await pool.query('BEGIN')

    try {
      // 1. Сначала удаляем из базы данных все записи с этим URL
          const dbResults = {
      productImages: 0,
      updatedProducts: 0,
      mediaFiles: 0
    }

      // Удаляем из media_files
      const mediaFilesResult = await pool.query(
        'DELETE FROM media_files WHERE s3_url = $1 OR s3_key = $2 RETURNING id',
        [url, s3Key]
      )

      // Удаляем из product_images
      const productImagesResult = await pool.query(
        'DELETE FROM product_images WHERE image_url = $1 RETURNING product_id, is_main',
        [url]
      )

      dbResults.productImages = productImagesResult.rows.length
      dbResults.mediaFiles = mediaFilesResult.rows.length

      // Если удалили изображения товаров, обновляем главные изображения
      if (productImagesResult.rows.length > 0) {
        const affectedProducts = new Set(productImagesResult.rows.map(row => row.product_id))

        for (const productId of affectedProducts) {
          // Проверяем, есть ли ещё изображения у товара
          const remainingImages = await pool.query(
            'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY image_order ASC LIMIT 1',
            [productId]
          )

          if (remainingImages.rows.length > 0) {
            // Устанавливаем первое оставшееся изображение как главное
            await pool.query(
              'UPDATE product_images SET is_main = true WHERE product_id = $1 AND image_url = $2',
              [productId, remainingImages.rows[0].image_url]
            )

            await pool.query(
              'UPDATE products SET image_url = $1 WHERE id = $2',
              [remainingImages.rows[0].image_url, productId]
            )
          } else {
            // Если изображений не осталось, очищаем image_url товара
            await pool.query(
              'UPDATE products SET image_url = NULL WHERE id = $1',
              [productId]
            )
          }
          dbResults.updatedProducts++
        }

        // Упорядочиваем image_order для всех затронутых товаров
        for (const productId of affectedProducts) {
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
      }

      // 2. Теперь удаляем файл из S3

      const deleteCommand = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      })

      const s3Result = await s3Client.send(deleteCommand)

      // Коммитим транзакцию
      await pool.query('COMMIT')

      // Очищаем кеш медиатеки
      try {
        const { apiCache } = await import('../../../../lib/cache-manager')
        apiCache.clear()

      } catch (cacheError) {
        console.warn('⚠️ Failed to clear media cache:', cacheError)
      }

      // Очищаем кеш продуктов, чтобы интерфейс сразу обновился
      try {
        const { redisClient } = await import('../../../../lib/redis-client')
        await redisClient.flushPattern('products-*')

      } catch (prodCacheErr) {
        console.warn('⚠️ Failed to clear products cache:', prodCacheErr)
      }

      return NextResponse.json({
        success: true,
        message: "Media file completely deleted from S3 and database",
        key: s3Key,
        url: url,
        type: 'complete',
        dbResults
      })

    } catch (error) {
      // Откатываем изменения в БД
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error("Error deleting media file:", error)
    return NextResponse.json(
      { error: "Failed to delete media file completely" },
      { status: 500 }
    )
  }
}