import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db-connection'
import { guardDbOr503Fast, tablesExist } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('group_id')

    const need = await tablesExist(['characteristics_values_simple','characteristics_groups_simple'])
    if (!need.characteristics_values_simple || !need.characteristics_groups_simple) {
      return NextResponse.json({ success: true, data: [] })
    }

    const pool = getPool()

    let query = `
      SELECT
        cv.id,
        cv.group_id,
        cv.value,
        cv.description,
        cv.color_hex,
        cv.sort_order,
        cv.is_active,
        cg.name as group_name
      FROM characteristics_values_simple cv
      LEFT JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
      WHERE cv.is_active = true
    `
    const params: any[] = []

    if (groupId) {
      query += ` AND cv.group_id = $1`
      params.push(parseInt(groupId))
    }

    query += ` ORDER BY cv.sort_order, cv.value LIMIT 500`

    const result = await pool.query(query, params)
    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Error fetching spec enums:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch spec enums' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { group_id, value, display_name, color_hex, ordering } = body

    if (!group_id || !value) {
      return NextResponse.json(
        { success: false, error: "group_id и value обязательны" },
        { status: 400 }
      )
    }

    const pool = getPool()
    const client = await pool.connect()
    const result = await client.query(
      `INSERT INTO characteristic_values (group_id, value, display_name, color_hex, ordering, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [group_id, value, display_name || value, color_hex, ordering || 0]
    )
    client.release()

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error("Ошибка создания enum значения:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка создания enum значения" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: "ID обязателен" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { value, ordering, parent_id, color_value } = body

    const pool = getPool()
    const result = await pool.query(
      `UPDATE characteristic_values
       SET value = $2,
           ordering = $3,
           parent_id = $4,
           color_value = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [parseInt(id), value, ordering, parent_id || null, color_value || null]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Enum не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: "Enum обновлён",
      data: result.rows[0]
    })

  } catch (error) {
    console.error("Ошибка обновления enum:", error)
    return NextResponse.json(
      { error: "Ошибка обновления enum" },
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
        { error: "ID обязателен" },
        { status: 400 }
      )
    }

    const enumId = parseInt(id)

    // удаляем потомков
    const pool = getPool()
    await pool.query('DELETE FROM characteristic_values WHERE parent_id = $1', [enumId])
    const result = await pool.query('DELETE FROM characteristic_values WHERE id = $1 RETURNING *', [enumId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Enum не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: "Enum удалён",
      deleted: result.rows[0]
    })

  } catch (error) {
    console.error("Ошибка удаления enum:", error)
    return NextResponse.json(
      { error: "Ошибка удаления enum" },
      { status: 500 }
    )
  }
}