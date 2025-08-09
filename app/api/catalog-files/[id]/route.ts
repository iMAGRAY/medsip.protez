import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { requireAuth, hasPermission } from '@/lib/database-auth'
import { getCacheManager } from '@/lib/dependency-injection'

// GET - получить информацию о каталоге
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const catalogId = parseInt(params.id)

    if (isNaN(catalogId)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный ID каталога' },
        { status: 400 }
      )
    }

    const query = `
      SELECT
        cf.*,
        u.email as created_by_email
      FROM catalog_files cf
      LEFT JOIN users u ON cf.created_by = u.id
      WHERE cf.id = $1
    `

    const result = await executeQuery(query, [catalogId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Каталог не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error fetching catalog file:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки каталога' },
      { status: 500 }
    )
  }
}

// PUT - обновить каталог
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cacheManager = getCacheManager()

  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'catalog.update') &&
        !hasPermission(session.user, 'catalog.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const catalogId = parseInt(params.id)

    if (isNaN(catalogId)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный ID каталога' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, description, file_url, file_name, file_size, file_type, year, is_active } = body

    const query = `
      UPDATE catalog_files
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        file_url = COALESCE($3, file_url),
        file_name = COALESCE($4, file_name),
        file_size = COALESCE($5, file_size),
        file_type = COALESCE($6, file_type),
        year = COALESCE($7, year),
        is_active = COALESCE($8, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `

    const values = [
      title,
      description,
      file_url,
      file_name,
      file_size,
      file_type,
      year,
      is_active,
      catalogId
    ]

    const result = await executeQuery(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Каталог не найден' },
        { status: 404 }
      )
    }

    // Очищаем кэш
    cacheManager.clear()

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Каталог успешно обновлен'
    })

  } catch (error) {
    console.error('Error updating catalog file:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления каталога' },
      { status: 500 }
    )
  }
}

// DELETE - удалить каталог
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cacheManager = getCacheManager()

  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'catalog.delete') &&
        !hasPermission(session.user, 'catalog.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const catalogId = parseInt(params.id)

    if (isNaN(catalogId)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный ID каталога' },
        { status: 400 }
      )
    }

    const query = `DELETE FROM catalog_files WHERE id = $1 RETURNING *`
    const result = await executeQuery(query, [catalogId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Каталог не найден' },
        { status: 404 }
      )
    }

    // Очищаем кэш
    cacheManager.clear()

    return NextResponse.json({
      success: true,
      message: 'Каталог успешно удален'
    })

  } catch (error) {
    console.error('Error deleting catalog file:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления каталога' },
      { status: 500 }
    )
  }
}