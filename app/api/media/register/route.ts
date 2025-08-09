import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/lib/db-connection"

// POST /api/media/register - Регистрация нового медиафайла в системе дедупликации
export async function POST(request: NextRequest) {
  const pool = getPool()

  try {
    const body = await request.json()
    const {
      hash,
      originalName,
      extension,
      fileSize,
      mimeType,
      s3Key,
      s3Url,
      width,
      height,
      metadata
    } = body

    // Валидация обязательных полей
    if (!hash || !originalName || !s3Key || !s3Url || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: "Все обязательные поля должны быть заполнены" },
        { status: 400 }
      )
    }

// Проверяем, что файл с таким хешем еще не существует
    const existingResult = await pool.query(
      'SELECT id, file_hash, s3_url, created_at FROM media_files WHERE file_hash = $1',
      [hash]
    )

    if (existingResult.rows.length > 0) {
      const existingFile = existingResult.rows[0]

      // Возвращаем информацию о существующем файле вместо ошибки
      return NextResponse.json({
        success: true,
        file: {
          id: existingFile.id,
          hash: existingFile.file_hash,
          s3_url: existingFile.s3_url,
          created_at: existingFile.created_at
        },
        isDuplicate: true,
        message: "Файл уже зарегистрирован, используется существующий"
      })
    }

    // Регистрируем новый файл
    const insertResult = await pool.query(`
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
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, file_hash, s3_url, created_at
    `, [
      hash,
      originalName,
      extension || '',
      fileSize,
      mimeType,
      s3Key,
      s3Url,
      width || null,
      height || null,
      metadata ? JSON.stringify(metadata) : null
    ])

    const newFile = insertResult.rows[0]

return NextResponse.json({
      success: true,
      file: {
        id: newFile.id,
        hash: newFile.file_hash,
        s3_url: newFile.s3_url,
        created_at: newFile.created_at
      }
    })

  } catch (error) {
    console.error('❌ Ошибка при регистрации медиафайла:', error)
    return NextResponse.json(
      { error: "Ошибка при регистрации медиафайла" },
      { status: 500 }
    )
  }
}

// GET /api/media/register/[hash] - Получение информации о зарегистрированном файле
export async function GET(request: NextRequest) {
  const pool = getPool()
  const url = new URL(request.url)
  const hash = url.pathname.split('/').pop()

  try {
    if (!hash) {
      return NextResponse.json(
        { error: "Хеш файла обязателен" },
        { status: 400 }
      )
    }

    const result = await pool.query(
      'SELECT * FROM media_files WHERE file_hash = $1',
      [hash]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Файл не найден" },
        { status: 404 }
      )
    }

    const file = result.rows[0]

    return NextResponse.json({
      file: {
        id: file.id,
        hash: file.file_hash,
        original_name: file.original_name,
        extension: file.file_extension,
        size: file.file_size,
        mime_type: file.mime_type,
        s3_key: file.s3_key,
        s3_url: file.s3_url,
        width: file.width,
        height: file.height,
        upload_count: file.upload_count,
        first_uploaded_at: file.first_uploaded_at,
        last_accessed_at: file.last_accessed_at,
        metadata: file.metadata,
        created_at: file.created_at,
        updated_at: file.updated_at
      }
    })

  } catch (error) {
    console.error('❌ Ошибка при получении информации о файле:', error)
    return NextResponse.json(
      { error: "Ошибка при получении информации о файле" },
      { status: 500 }
    )
  }
}