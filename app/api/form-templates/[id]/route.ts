import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// DELETE /api/form-templates/[id] - Delete form template
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const templateId = resolvedParams.id

    const result = await pool.query(`
      DELETE FROM form_templates
      WHERE id = $1
      RETURNING id, name
    `, [templateId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Template deleted successfully',
      deleted: result.rows[0]
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const templateId = resolvedParams.id

    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        characteristics,
        created_at,
        is_favorite
      FROM form_templates
      WHERE id = $1
    `, [templateId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load template' }, { status: 500 })
  }
}