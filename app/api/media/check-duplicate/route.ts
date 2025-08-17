import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/lib/db-connection"

// POST /api/media/check-duplicate - Проверка дубликата по хешу файла
export async function POST(request: NextRequest) {
  const pool = getPool()

  try {
    const body = await request.json()
    const { hash, originalName: _originalName, fileSize: _fileSize, mimeType: _mimeType } = body

    if (!hash) {
      return NextResponse.json(
        { error: "Хеш файла обязателен" },
        { status: 400 }
      )
    }

// Ищем файл с таким же хешем
    const duplicateResult = await pool.query(
      'SELECT * FROM find_duplicate_by_hash($1)',
      [hash]
    )

    if (duplicateResult.rows.length > 0) {
      const existingFile = duplicateResult.rows[0]

      // Увеличиваем счетчик попыток загрузки
      await pool.query(
        'UPDATE media_files SET upload_count = upload_count + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [existingFile.id]
      )

      return NextResponse.json({
        isDuplicate: true,
        existingFile: {
          id: existingFile.id,
          s3_url: existingFile.s3_url,
          original_name: existingFile.original_name,
          file_size: existingFile.file_size,
          upload_count: existingFile.upload_count + 1,
          first_uploaded_at: existingFile.first_uploaded_at
        }
      })
    }

    return NextResponse.json({
      isDuplicate: false
    })

  } catch (error) {
    return NextResponse.json(
      { error: "Ошибка при проверке дубликата файла" },
      { status: 500 }
    )
  }
}