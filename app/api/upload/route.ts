import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

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

// POST /api/upload - Upload image files to S3
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string || 'products'

    if (!file) {
      console.error("❌ Upload error: No file provided")
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

// Validate file type based on category
    if (category === 'catalog') {
      // For catalogs, allow PDF, DOC, DOCX, XLS, XLSX files
      const allowedCatalogTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]

      if (!allowedCatalogTypes.includes(file.type)) {
        console.error(`❌ Upload error: Invalid catalog file type: ${file.type}`)
        return NextResponse.json(
          { error: `Catalog files must be PDF, DOC, DOCX, XLS, or XLSX. Received: ${file.type}` },
          { status: 400 }
        )
      }
    } else {
      // For other categories (images), keep existing validation
      if (!file.type.startsWith('image/')) {
        console.error(`❌ Upload error: Invalid file type: ${file.type}`)
        return NextResponse.json(
          { error: `File must be an image. Received: ${file.type}` },
          { status: 400 }
        )
      }
    }

    // Validate file size (max 15MB)
    const maxSize = 15 * 1024 * 1024 // 15MB
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0)
      console.error(`❌ Upload error: File too large: ${fileSizeMB}MB > ${maxSizeMB}MB`)
      return NextResponse.json(
        { error: `File size must be less than ${maxSizeMB}MB. Current size: ${fileSizeMB}MB` },
        { status: 400 }
      )
    }

    // Generate unique filename for S3
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop()
    const filename = `${timestamp}_${randomString}.${extension}`

    // Choose folder based on category
    const folder = category === 'catalog' ? 'catalogs' : 'products'
    const s3Key = `${folder}/${filename}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "max-age=31536000", // 1 year cache
      Metadata: {
        originalName: encodeURIComponent(file.name), // Кодируем имя файла для HTTP-заголовков
        uploadedAt: new Date().toISOString(),
      },
    })

    await s3Client.send(uploadCommand)

    // Generate public URL
    const publicUrl = `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${s3Key}`

    return NextResponse.json({
      url: publicUrl,
      key: s3Key,
      filename: filename,
      size: file.size,
      type: file.type
    })

  } catch (error) {
    console.error("❌ Error uploading file to S3:", error)
    return NextResponse.json(
      { error: "Failed to upload file to S3", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}