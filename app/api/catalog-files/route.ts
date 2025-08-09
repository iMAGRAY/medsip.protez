import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { requireAuth, hasPermission } from '@/lib/database-auth'
import { getCacheManager } from '@/lib/dependency-injection'

// GET - получить список каталогов
export async function GET(request: NextRequest) {
  const cacheManager = getCacheManager()

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'
    const year = searchParams.get('year')

    const cacheKey = `catalog-files:${activeOnly}:${year || 'all'}`
    const cached = cacheManager.get(cacheKey)

    if (cached && !searchParams.get('nocache')) {
      return NextResponse.json(cached)
    }

    let query = `
      SELECT
        cf.*,
        u.email as created_by_email
      FROM catalog_files cf
      LEFT JOIN users u ON cf.created_by = u.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (activeOnly) {
      query += ` AND cf.is_active = $${paramIndex}`
      params.push(true)
      paramIndex++
    }

    if (year) {
      query += ` AND cf.year = $${paramIndex}`
      params.push(parseInt(year))
      paramIndex++
    }

    query += ` ORDER BY cf.year DESC, cf.created_at DESC`

    const result = await executeQuery(query, params)

    const responseData = {
      success: true,
      count: result.rows.length,
      data: result.rows
    }

    // Кешируем на 5 минут
    cacheManager.set(cacheKey, responseData, 5 * 60 * 1000)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching catalog files:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки файлов каталогов' },
      { status: 500 }
    )
  }
}

// POST - создать новый каталог
export async function POST(request: NextRequest) {
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
    if (!hasPermission(session.user, 'catalog.create') &&
        !hasPermission(session.user, 'catalog.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, file_url, file_name, file_size, file_type, year } = body

    if (!title || !file_url || !file_name) {
      return NextResponse.json(
        { success: false, error: 'Обязательные поля: title, file_url, file_name' },
        { status: 400 }
      )
    }

    const query = `
      INSERT INTO catalog_files (
        title, description, file_url, file_name, file_size, file_type, year, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `

    const values = [
      title,
      description || null,
      file_url,
      file_name,
      file_size || null,
      file_type || null,
      year || new Date().getFullYear(),
      session.user.id
    ]

    const result = await executeQuery(query, values)

    // Очищаем кэш
    cacheManager.clear()

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Каталог успешно добавлен'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating catalog file:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка создания каталога' },
      { status: 500 }
    )
  }
}