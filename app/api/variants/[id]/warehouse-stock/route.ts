import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// GET - получить остатки варианта по складам
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const variantId = parseInt(resolvedParams.id)

    const result = await pool.query(`
      SELECT 
        w.id as warehouse_id,
        w.name as warehouse_name,
        w.code as warehouse_code,
        w.city,
        COALESCE(vws.quantity, 0) as quantity,
        COALESCE(vws.reserved_quantity, 0) as reserved_quantity
      FROM warehouses w
      LEFT JOIN variant_warehouse_stock vws 
        ON w.id = vws.warehouse_id 
        AND vws.variant_id = $1
      WHERE w.is_active = true
      ORDER BY w.sort_order, w.name
    `, [variantId])

    return NextResponse.json(result.rows)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch warehouse stock' },
      { status: 500 }
    )
  }
}

// PUT - обновить остатки варианта по складам
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const variantId = parseInt(resolvedParams.id)
    const warehouseStocks = await request.json()

    if (!Array.isArray(warehouseStocks)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      )
    }

    // Начинаем транзакцию
    await pool.query('BEGIN')

    try {
      // Удаляем старые записи
      await pool.query(
        'DELETE FROM variant_warehouse_stock WHERE variant_id = $1',
        [variantId]
      )

      // Вставляем новые записи
      for (const stock of warehouseStocks) {
        if (stock.quantity > 0) {
          await pool.query(
            `INSERT INTO variant_warehouse_stock 
             (variant_id, warehouse_id, quantity, reserved_quantity)
             VALUES ($1, $2, $3, $4)`,
            [variantId, stock.warehouse_id, stock.quantity, stock.reserved_quantity || 0]
          )
        }
      }

      // Обновляем общее количество в таблице product_variants
      const totalResult = await pool.query(
        `SELECT SUM(quantity) as total FROM variant_warehouse_stock WHERE variant_id = $1`,
        [variantId]
      )
      const totalQuantity = totalResult.rows[0]?.total || 0

      await pool.query(
        `UPDATE product_variants SET stock_quantity = $1 WHERE id = $2`,
        [totalQuantity, variantId]
      )

      await pool.query('COMMIT')

      // Возвращаем обновленные данные
      const result = await pool.query(`
        SELECT 
          w.id as warehouse_id,
          w.name as warehouse_name,
          w.code as warehouse_code,
          w.city,
          COALESCE(vws.quantity, 0) as quantity,
          COALESCE(vws.reserved_quantity, 0) as reserved_quantity
        FROM warehouses w
        LEFT JOIN variant_warehouse_stock vws 
          ON w.id = vws.warehouse_id 
          AND vws.variant_id = $1
        WHERE w.is_active = true
        ORDER BY w.sort_order, w.name
      `, [variantId])

      return NextResponse.json({
        success: true,
        data: result.rows,
        totalQuantity
      })
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update warehouse stock' },
      { status: 500 }
    )
  }
}