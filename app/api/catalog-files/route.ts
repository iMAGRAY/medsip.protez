import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { requireAuth, hasPermission } from '@/lib/database-auth'
import { getCacheManager } from '@/lib/dependency-injection'
import { guardDbOr503Fast } from '@/lib/api-guards'

function isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

// GET - получить список каталогов
export async function GET(request: NextRequest) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'
    const year = searchParams.get('year')

    const tableCheck = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema='public' AND table_name='catalog_files'
      ) as exist
    `)
    if (!tableCheck.rows[0]?.exist) {
      return NextResponse.json({ success: false, error: 'catalog_files schema is not initialized' }, { status: 503 })
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
    const guard = guardDbOr503Fast()
    if (guard) return guard

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!hasPermission(session.user, 'catalog.create') &&
        !hasPermission(session.user, 'catalog.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const tableCheck = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema='public' AND table_name='catalog_files'
      ) as exist
    `)
    if (!tableCheck.rows[0]?.exist) {
      return NextResponse.json({ success: false, error: 'catalog_files schema is not initialized' }, { status: 503 })
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