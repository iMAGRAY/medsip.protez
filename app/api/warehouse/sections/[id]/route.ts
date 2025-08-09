import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRESQL_HOST,
  port: parseInt(process.env.POSTGRESQL_PORT || '5432'),
  database: process.env.POSTGRESQL_DBNAME,
  user: process.env.POSTGRESQL_USER,
  password: process.env.POSTGRESQL_PASSWORD,
  ssl: process.env.DATABASE_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
})

// PUT - обновить секцию
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, description, capacity, row_number, shelf_number, zone_id } = body

    // Валидация
    if (!name || !capacity || !row_number || !shelf_number || !zone_id) {
      return NextResponse.json(
        { success: false, error: 'Все поля обязательны' },
        { status: 400 }
      )
    }

    const client = await pool.connect()

    try {
      // Проверяем, существует ли зона
      const zoneCheck = await client.query(`
        SELECT id FROM warehouse_zones
        WHERE id = $1 AND is_active = true
      `, [zone_id])

      if (zoneCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Зона не найдена' },
          { status: 404 }
        )
      }

      const result = await client.query(`
        UPDATE warehouse_sections
        SET
          name = $2,
          description = $3,
          capacity = $4,
          row_number = $5,
          shelf_number = $6,
          zone_id = $7,
          updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
      `, [id, name, description || '', capacity, row_number, shelf_number, zone_id])

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Секция не найдена' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: result.rows[0]
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Ошибка обновления секции:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления секции' },
      { status: 500 }
    )
  }
}

// DELETE - удалить секцию (мягкое удаление)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const client = await pool.connect()

    try {
      // Проверяем, есть ли товары в секции
      const inventoryCheck = await client.query(`
        SELECT COUNT(*) as count
        FROM warehouse_inventory
        WHERE section_id = $1 AND status != 'discontinued'
      `, [id])

      if (parseInt(inventoryCheck.rows[0].count) > 0) {
        return NextResponse.json(
          { success: false, error: 'Нельзя удалить секцию с товарами' },
          { status: 400 }
        )
      }

      const result = await client.query(`
        UPDATE warehouse_sections
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
      `, [id])

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Секция не найдена' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Секция успешно удалена'
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Ошибка удаления секции:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления секции' },
      { status: 500 }
    )
  }
}