import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';

/**
 * API для работы со значениями характеристик в упрощенной системе
 * Использует таблицу characteristics_values_simple
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('group_id')

    let query = `
      SELECT
        cv.*,
        cg.name as group_name
      FROM characteristics_values_simple cv
      LEFT JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
      WHERE cv.is_active = true
    `

    const params = []

    if (groupId) {
      query += ` AND cv.group_id = $1`
      params.push(groupId)
    }

    query += ` ORDER BY cv.sort_order, cv.value`

    const pool = getPool()
    const result = await pool.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching characteristic values:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch characteristic values' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { group_id, value, color_hex, sort_order, description } = body

    if (!group_id || !value) {
      return NextResponse.json(
        { success: false, error: "group_id и value обязательны" },
        { status: 400 }
      )
    }

    const pool = getPool()

    // Валидация: убеждаемся, что group_id указывает на группу, а не на раздел
    const groupCheck = await pool.query(
      'SELECT is_section FROM characteristics_groups_simple WHERE id = $1',
      [group_id]
    );

    if (groupCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Группа характеристик не найдена' },
        { status: 400 }
      );
    }

    if (groupCheck.rows[0].is_section) {
      return NextResponse.json(
        { success: false, error: 'Значения характеристик можно создавать только в группах, а не в разделах' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO characteristics_values_simple (group_id, value, color_hex, sort_order, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [group_id, value.trim(), color_hex || null, sort_order || 0, description || null]
    )

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Значение характеристики создано'
    })
  } catch (error) {
    console.error("❌ Ошибка создания значения характеристики:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка создания значения характеристики" },
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
        { success: false, error: "ID обязателен" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { value, sort_order, color_hex, description } = body

    if (!value) {
      return NextResponse.json(
        { success: false, error: "value обязательно" },
        { status: 400 }
      )
    }

    const pool = getPool()
    const result = await pool.query(
      `UPDATE characteristics_values_simple
       SET value = $2,
           sort_order = $3,
           color_hex = $4,
           description = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [parseInt(id), value.trim(), sort_order || 0, color_hex || null, description || null]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Значение характеристики не найдено" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: "Значение характеристики обновлено"
    })

  } catch (error) {
    console.error("❌ Ошибка обновления значения характеристики:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка обновления значения характеристики" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const force = searchParams.get('force') === 'true'

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID обязателен" },
        { status: 400 }
      )
    }

    const valueId = parseInt(id)

// Проверяем, используется ли значение в товарах
    const pool = getPool()
    const usageCheck = await pool.query(
      'SELECT COUNT(*) as count FROM product_characteristics_simple WHERE value_id = $1',
      [valueId]
    )

    const usageCount = parseInt(usageCheck.rows[0].count)
    if (usageCount > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          error: "Значение используется в товарах",
          details: `Значение используется в ${usageCount} товарах`,
          can_force_delete: true,
          usage_count: usageCount
        },
        { status: 409 }
      )
    }

    if (usageCount > 0 && force) {
      // Удаляем все связи с товарами
      await pool.query(
        'DELETE FROM product_characteristics_simple WHERE value_id = $1',
        [valueId]
      )

    }

    // Удаляем значение характеристики
    const result = await pool.query(
      'DELETE FROM characteristics_values_simple WHERE id = $1 RETURNING *',
      [valueId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Значение характеристики не найдено" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: force ? "Значение характеристики и все связи удалены" : "Значение характеристики удалено"
    })

  } catch (error) {
    console.error("❌ Ошибка удаления значения характеристики:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка удаления значения характеристики" },
      { status: 500 }
    )
  }
}