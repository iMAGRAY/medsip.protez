import { NextRequest, NextResponse } from "next/server"
import { S3Client, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"

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

// GET /api/media/check?key=path/to/file.jpg or ?url=full-url
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const url = searchParams.get('url')
  const search = searchParams.get('search') // Поиск по части имени файла

  if (!key && !url && !search) {
    return NextResponse.json(
      { error: "Either 'key', 'url', or 'search' parameter is required" },
      { status: 400 }
    )
  }

  try {
    // Если есть поисковый запрос, ищем файлы
    if (search) {
      const listCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: '', // Ищем во всем бакете
        MaxKeys: 100
      })

      const result = await s3Client.send(listCommand)
      const matchingFiles = result.Contents?.filter(obj =>
        obj.Key?.includes(search)
      ) || []

      return NextResponse.json({
        success: true,
        type: 'search',
        search: search,
        found: matchingFiles.length,
        files: matchingFiles.map(file => ({
          key: file.Key,
          size: file.Size,
          lastModified: file.LastModified,
          url: `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${file.Key}`
        }))
      })
    }

    // Определяем S3 ключ
    let s3Key = key

    if (!s3Key && url) {
      const urlParts = url.split('/')
      const bucketIndex = urlParts.findIndex(part => part === S3_BUCKET)
      if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
        s3Key = urlParts.slice(bucketIndex + 1).join('/')
      } else {
        // Альтернативные методы извлечения ключа
        const protocolIndex = urlParts.findIndex(part => part.includes('://'))
        if (protocolIndex !== -1 && protocolIndex + 2 < urlParts.length) {
          s3Key = urlParts.slice(protocolIndex + 2).join('/')
        }
      }
    }

    if (!s3Key) {
      return NextResponse.json(
        { error: "Could not determine S3 key" },
        { status: 400 }
      )
    }

    // Проверяем существование файла
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      })

      const result = await s3Client.send(headCommand)

      return NextResponse.json({
        success: true,
        exists: true,
        key: s3Key,
        url: url,
        metadata: {
          contentLength: result.ContentLength,
          contentType: result.ContentType,
          lastModified: result.LastModified,
          etag: result.ETag
        }
      })

    } catch (error: any) {
      if (error.name === 'NotFound') {
        return NextResponse.json({
          success: true,
          exists: false,
          key: s3Key,
          url: url,
          message: "File not found in S3"
        })
      }
      throw error
    }

  } catch (error) {
    console.error("Error checking media file:", error)
    return NextResponse.json(
      { error: "Failed to check media file" },
      { status: 500 }
    )
  }
}