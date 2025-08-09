import { NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import path from 'path'
import { getPool } from '@/lib/db-connection'
import { Worker } from 'worker_threads'
import { cpus } from 'os'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

// Контроль ресурсов
const MAX_WORKERS = Math.min(cpus().length, 4) // Не более 4 воркеров
const BATCH_SIZE = 50 // Обрабатываем файлы батчами
const MAX_DB_CONNECTIONS = 2 // Ограничиваем подключения к БД

// Кэш для повышения производительности
const mediaCache = new Map<string, any>()
const CACHE_TTL = 60000 // 1 минута

// Semaphore для ограничения параллельных операций
class Semaphore {
  private count: number
  private waiting: Array<() => void> = []

  constructor(count: number) {
    this.count = count
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.count > 0) {
        this.count--
        resolve()
      } else {
        this.waiting.push(resolve)
      }
    })
  }

  release(): void {
    this.count++
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!
      this.count--
      resolve()
    }
  }
}

const dbSemaphore = new Semaphore(MAX_DB_CONNECTIONS)

// Параллельная обработка файлов
async function processFilesInParallel(files: any[], batchSize: number = BATCH_SIZE) {
  const results: any[] = []

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)

    // Обрабатываем батч параллельно
    const batchPromises = batch.map(async (obj) => {
      if (!obj.Key || !obj.Size || obj.Size <= 0) return null

      const key = obj.Key
      const fileName = key.split('/').pop() || key
      const ext = path.extname(fileName).toLowerCase().substring(1)

      return {
        name: fileName,
        url: `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${key}`,
        size: obj.Size || 0,
        uploadedAt: obj.LastModified || new Date(),
        type: ext,
        source: 's3' as const,
        key: key,
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults.filter(Boolean))
  }

  return results
}

// Оптимизированное обогащение данными о продуктах
async function enrichWithProductData(files: any[]): Promise<any[]> {
  if (files.length === 0) return files

  await dbSemaphore.acquire()

  try {
    const pool = getPool()
    const urls = files.map(f => f.url)

    // Батчинг для больших массивов
    const BATCH_SIZE_DB = 100
    const enrichmentMap = new Map<string, { product_id: number; product_name: string }>()

    for (let i = 0; i < urls.length; i += BATCH_SIZE_DB) {
      const urlBatch = urls.slice(i, i + BATCH_SIZE_DB)

      const query = `
        SELECT pi.image_url, pi.product_id, p.name AS product_name
        FROM product_images pi
        JOIN products p ON p.id = pi.product_id
        WHERE pi.image_url = ANY($1::text[])
      `

      const result = await pool.query(query, [urlBatch])

      for (const row of result.rows) {
        enrichmentMap.set(row.image_url, {
          product_id: row.product_id,
          product_name: row.product_name,
        })
      }
    }

    // Применяем обогащение
    return files.map(file => {
      const match = enrichmentMap.get(file.url)
      if (match) {
        return {
          ...file,
          productId: match.product_id,
          productName: match.product_name
        }
      }
      return file
    })

  } finally {
    dbSemaphore.release()
  }
}

// Быстрая сортировка с ограничением по времени
function quickSortWithTimeout(arr: any[], timeLimit: number = 100): any[] {
  const startTime = Date.now()

  function quickSort(items: any[]): any[] {
    if (Date.now() - startTime > timeLimit) {
      // Если время истекло, возвращаем частично отсортированный массив

      return items
    }

    if (items.length <= 1) return items

    const pivot = items[Math.floor(items.length / 2)]
    const left: any[] = []
    const right: any[] = []
    const equal: any[] = []

    for (const item of items) {
      const pivotTime = new Date(pivot.uploadedAt).getTime()
      const itemTime = new Date(item.uploadedAt).getTime()

      if (itemTime > pivotTime) left.push(item)
      else if (itemTime < pivotTime) right.push(item)
      else equal.push(item)
    }

    return [...quickSort(left), ...equal, ...quickSort(right)]
  }

  return quickSort(arr)
}

// GET - Получить список медиафайлов с оптимизацией
export async function GET(request: Request) {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substr(2, 9)

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Ограничиваем лимит
    const continuationToken = searchParams.get('continuationToken')
    const fast = searchParams.get('fast') === 'true'

    // Проверяем кэш
    const cacheKey = `media_${limit}_${continuationToken || 'first'}_${fast}`
    const cached = mediaCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
return new NextResponse(JSON.stringify({
        ...cached.data,
        performance: {
          ...cached.data.performance,
          cached: true,
          totalTime: Date.now() - startTime
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          'X-Cache': 'HIT'
        }
      })
    }

    // Быстрый режим
    if (fast) {

      const fastResponse = {
        files: [],
        count: 0,
        hasMore: false,
        nextContinuationToken: null,
        sources: { s3: 0 },
        performance: {
          totalTime: Date.now() - startTime,
          mode: 'fast'
        }
      }

      return new NextResponse(JSON.stringify(fastResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        }
      })
    }

    // Получаем файлы из базы данных медиатеки
    const dbStartTime = Date.now()
    let registeredFiles: any[] = []

    await dbSemaphore.acquire()
    try {
      const pool = getPool()
      const dbQuery = `
        SELECT
          mf.id,
          mf.file_hash,
          mf.original_name,
          mf.file_extension,
          mf.file_size,
          mf.mime_type,
          mf.s3_key,
          mf.s3_url,
          mf.width,
          mf.height,
          mf.upload_count,
          mf.created_at,
          pi.product_id,
          p.name AS product_name
        FROM media_files mf
        LEFT JOIN product_images pi ON pi.image_url = mf.s3_url
        LEFT JOIN products p ON p.id = pi.product_id
        ORDER BY mf.created_at DESC
        LIMIT $1
      `

      const dbResult = await pool.query(dbQuery, [limit])

      registeredFiles = dbResult.rows.map(row => ({
        id: row.id,
        name: row.original_name,
        url: row.s3_url,
        size: row.file_size,
        uploadedAt: row.created_at,
        type: row.file_extension || 'unknown',
        source: 'database' as const,
        key: row.s3_key,
        hash: row.file_hash,
        mimeType: row.mime_type,
        width: row.width,
        height: row.height,
        uploadCount: row.upload_count,
        productId: row.product_id,
        productName: row.product_name
      }))

    } finally {
      dbSemaphore.release()
    }

    const dbTime = Date.now() - dbStartTime

    // Получаем файлы из S3 (для файлов, не зарегистрированных в БД)
    const s3StartTime = Date.now()
    let s3Files: any[] = []
    let s3Time = 0
    let response: any = { IsTruncated: false, NextContinuationToken: null } // Default values

    if (!process.env.S3_ENDPOINT || !process.env.S3_BUCKET) {

      s3Time = Date.now() - s3StartTime
    } else {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: 'products/',
          MaxKeys: limit,
          ContinuationToken: continuationToken || undefined
        })

        response = await s3Client.send(listCommand)
        s3Time = Date.now() - s3StartTime

        if (response.Contents && response.Contents.length > 0) {
          // Параллельная обработка файлов
          const processStartTime = Date.now()

          const [processedFiles] = await Promise.all([
            processFilesInParallel(response.Contents, BATCH_SIZE)
          ])

          const processTime = Date.now() - processStartTime

          // Фильтруем файлы, которые уже есть в БД
          const registeredUrls = new Set(registeredFiles.map(f => f.url))
          s3Files = processedFiles.filter(file => !registeredUrls.has(file.url))

          // Обогащение данными о продуктах для S3 файлов
          if (s3Files.length > 0 && s3Files.length <= 100) {
            try {
              const enrichStartTime = Date.now()
              s3Files = await enrichWithProductData(s3Files)
              const enrichTime = Date.now() - enrichStartTime

            } catch (dbErr) {
              console.error(`⚠️ [${requestId}] Failed to enrich S3 files:`, dbErr)
            }
          }
        }

      } catch (s3Error) {
        console.error(`⚠️ [${requestId}] S3 Error:`, s3Error)
        s3Time = Date.now() - s3StartTime
      }
    }

    // Объединяем файлы из БД и S3
    const allFiles = [...registeredFiles, ...s3Files]

    // Быстрая сортировка с таймаутом
    const sortStartTime = Date.now()
    const sortedFiles = allFiles.length > 0 ? quickSortWithTimeout(allFiles, 100) : allFiles
    const sortTime = Date.now() - sortStartTime

    const totalTime = Date.now() - startTime
const responseData = {
      files: sortedFiles,
      count: sortedFiles.length,
      hasMore: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken || null,
      sources: {
        database: registeredFiles.length,
        s3: s3Files.length,
        total: sortedFiles.length
      },
      performance: {
        totalTime,
        dbTime,
        s3Time,
        sortTime,
        fileCount: sortedFiles.length,
        requestId
      }
    }

    // Кэшируем результат
    mediaCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    })

    // Очищаем старые записи кэша
    if (mediaCache.size > 50) {
      const oldestKey = mediaCache.keys().next().value
      if (oldestKey) {
        mediaCache.delete(oldestKey)
      }
    }

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Response-Time': totalTime.toString(),
        'X-S3-Time': s3Time.toString(),
        'X-Request-ID': requestId,
        'X-Cache': 'MISS'
      }
    })

  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error(`💥 [${requestId}] API Error after ${totalTime}ms:`, error)

    return NextResponse.json(
      {
        error: 'Failed to load media files',
        details: error instanceof Error ? error.message : String(error),
        performance: {
          totalTime,
          error: true,
          requestId
        }
      },
      {
        status: 500,
        headers: {
          'X-Response-Time': totalTime.toString(),
          'X-Request-ID': requestId
        }
      }
    )
  }
}