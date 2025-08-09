import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/secure-auth'
import { getPool } from '@/lib/db-connection'
import { logger } from '@/lib/logger'
import { userDataCache } from '@/lib/cache-manager'

interface Template {
  id: number
  name: string
  description?: string
  template_data: any
  created_at: Date
  updated_at: Date
  created_by: string
}

// GET - получить все шаблоны
export async function GET(request: NextRequest) {
  try {
    const session = requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем кеш
    const cacheKey = `templates:all:${session.username}`
    const cached = await userDataCache.get<Template[]>(cacheKey)
    if (cached) {
      return NextResponse.json({ templates: cached })
    }

    const pool = getPool()
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        template_data,
        created_at,
        updated_at,
        created_by
      FROM form_templates
      ORDER BY updated_at DESC
    `)

    const templates = result.rows

    // Кешируем результат
    await userDataCache.set(cacheKey, templates, 600) // 10 минут

    logger.info('Templates retrieved', {
      count: templates.length,
      user: session.username
    })

    return NextResponse.json({ templates })

  } catch (error) {
    logger.error('Failed to get templates', error)
    return NextResponse.json(
      { error: 'Failed to retrieve templates' },
      { status: 500 }
    )
  }
}

// POST - создать новый шаблон
export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, template_data } = await request.json()

    if (!name || !template_data) {
      return NextResponse.json(
        { error: 'Name and template_data are required' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const result = await pool.query(`
      INSERT INTO form_templates (name, description, template_data, created_by, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, name, description, template_data, created_at, updated_at, created_by
    `, [name, description, JSON.stringify(template_data), session.username])

    const newTemplate = result.rows[0]

    // Инвалидируем кеш
    await userDataCache.delete(`templates:all:${session.username}`)

    logger.info('Template created', {
      templateId: newTemplate.id,
      name,
      user: session.username
    })

    return NextResponse.json({
      template: newTemplate,
      message: 'Template created successfully'
    }, { status: 201 })

  } catch (error) {
    logger.error('Failed to create template', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}

// PUT - обновить шаблон
export async function PUT(request: NextRequest) {
  try {
    const session = requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, name, description, template_data } = await request.json()

    if (!id || !name || !template_data) {
      return NextResponse.json(
        { error: 'ID, name and template_data are required' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const result = await pool.query(`
      UPDATE form_templates
      SET
        name = $1,
        description = $2,
        template_data = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING id, name, description, template_data, created_at, updated_at, created_by
    `, [name, description, JSON.stringify(template_data), id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const updatedTemplate = result.rows[0]

    // Инвалидируем кеш
    await userDataCache.delete(`templates:all:${session.username}`)
    await userDataCache.delete(`template:${id}`)

    logger.info('Template updated', {
      templateId: id,
      name,
      user: session.username
    })

    return NextResponse.json({
      template: updatedTemplate,
      message: 'Template updated successfully'
    })

  } catch (error) {
    logger.error('Failed to update template', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

// DELETE - удалить шаблон
export async function DELETE(request: NextRequest) {
  try {
    const session = requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const result = await pool.query(`
      DELETE FROM form_templates
      WHERE id = $1
      RETURNING name
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const deletedTemplate = result.rows[0]

    // Инвалидируем кеш
    await userDataCache.delete(`templates:all:${session.username}`)
    await userDataCache.delete(`template:${id}`)

    logger.info('Template deleted', {
      templateId: id,
      name: deletedTemplate.name,
      user: session.username
    })

    return NextResponse.json({
      message: 'Template deleted successfully'
    })

  } catch (error) {
    logger.error('Failed to delete template', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}