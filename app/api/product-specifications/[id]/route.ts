import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"
import { getPool } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'

// GET /api/product-specifications/[id] - Get specifications for a specific product
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: "Invalid product ID" },
        { status: 400 }
      )
    }

    const result = await executeQuery(
      `SELECT
        ps.id,
        ps.product_id,
        ps.spec_name,
        ps.spec_value,
        ps.unit,
        ps.sort_order,
        ps.is_primary,
        ps.created_at,
        ps.updated_at,
        p.name as product_name
      FROM product_specifications ps
      JOIN products p ON ps.product_id = p.id
      WHERE ps.product_id = $1
      ORDER BY ps.sort_order ASC, ps.spec_name ASC`,
      [productId]
    )

    return NextResponse.json({
      success: true,
      data: result.rows
    })
  } catch (error: any) {
    const code = error?.code || error?.original?.code
    if (code === '42P01') {
      // Таблица отсутствует — считаем как нет данных
      return NextResponse.json(
        { success: false, error: "Product specifications table not found" },
        { status: 404 }
      )
    }
    console.error("Error fetching product specifications:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch product specifications",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// PUT - Обновить характеристику
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = getPool()

  try {
    const body = await request.json()
    const {
      label,
      valueText,
      characteristicType,
      groupId,
      valueNumeric,
      isActive
    } = body

    const updateFields = []
    const values = [params.id]
    let paramCount = 2

    if (label !== undefined) {
      updateFields.push(`label = $${paramCount}`)
      values.push(label)
      paramCount++
    }

    if (valueText !== undefined) {
      updateFields.push(`value_text = $${paramCount}`)
      values.push(valueText)
      paramCount++
    }

    if (characteristicType !== undefined) {
      updateFields.push(`characteristic_type = $${paramCount}`)
      values.push(characteristicType)
      paramCount++
    }

    if (groupId !== undefined) {
      updateFields.push(`group_id = $${paramCount}`)
      values.push(groupId)
      paramCount++
    }

    if (valueNumeric !== undefined) {
      updateFields.push(`value_numeric = $${paramCount}`)
      values.push(valueNumeric)
      paramCount++
    }

    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount}`)
      values.push(isActive)
      paramCount++
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'Нет полей для обновления' },
        { status: 400 }
      )
    }

    const query = `
      UPDATE product_characteristics_simple
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Характеристика не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Ошибка обновления характеристики:', error)
    return NextResponse.json(
      { error: 'Ошибка обновления характеристики' },
      { status: 500 }
    )
  }
}

// DELETE - Удалить характеристику
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = getPool()

  try {
    const result = await pool.query(
      'DELETE FROM product_characteristics_simple WHERE id = $1 RETURNING *',
      [params.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Характеристика не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Характеристика удалена'
    })
  } catch (error) {
    console.error('Ошибка удаления характеристики:', error)
    return NextResponse.json(
      { error: 'Ошибка удаления характеристики' },
      { status: 500 }
    )
  }
}