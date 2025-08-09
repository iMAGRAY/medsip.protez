import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"

export const dynamic = 'force-dynamic'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// GET /api/form-templates - Get all form templates
export async function GET() {
  try {

    // Сначала проверяем, существует ли таблица
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'form_templates'
      ) AS exists;
    `)

    if (!tableCheck.rows[0].exists) {
      return NextResponse.json({ success: false, error: 'Form templates schema is not initialized' }, { status: 503 })
    }

    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        characteristics,
        created_at,
        is_favorite
      FROM form_templates
      ORDER BY created_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('❌ Error loading templates:', error)
    return NextResponse.json({
      error: 'Failed to load templates',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST /api/form-templates - Create new form template
export async function POST(request: NextRequest) {
  try {
    const { name, description, characteristics, is_favorite = false } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }

    if (!characteristics || !Array.isArray(characteristics)) {
      return NextResponse.json({ error: 'Characteristics are required' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO form_templates (name, description, characteristics, is_favorite, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, name, description, characteristics, created_at, is_favorite
    `, [name.trim(), description?.trim() || '', JSON.stringify(characteristics), is_favorite])

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('❌ Error saving template:', error)
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 })
  }
}

// PUT /api/form-templates - Update default template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, characteristics, is_favorite } = body

    if (!id || !name) {
      return NextResponse.json(
        { error: 'ID and name are required' },
        { status: 400 }
      )
    }

    const templateData = {
      characteristics: characteristics || [],
      version: '1.0'
    }

    const query = `
      UPDATE form_templates
      SET name = $1, description = $2, template_data = $3, is_favorite = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, name, description, template_data, is_favorite, created_at, updated_at
    `

    const result = await pool.query(query, [
      name,
      description || '',
      JSON.stringify(templateData),
      is_favorite || false,
      id
    ])

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const updatedTemplate = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      characteristics: result.rows[0].template_data?.characteristics || [],
      is_favorite: result.rows[0].is_favorite,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    }

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error('Error updating form template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const query = 'DELETE FROM form_templates WHERE id = $1 RETURNING id'
    const result = await pool.query(query, [id])

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting form template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}