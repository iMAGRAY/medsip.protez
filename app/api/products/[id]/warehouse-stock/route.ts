import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// GET - получить остатки товара по складам
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)

    const result = await pool.query(`
      SELECT 
        w.id as warehouse_id,
        w.name as warehouse_name,
        w.code as warehouse_code,
        w.city,
        COALESCE(pws.quantity, 0) as quantity,
        COALESCE(pws.reserved_quantity, 0) as reserved_quantity
      FROM warehouses w
      LEFT JOIN product_warehouse_stock pws 
        ON w.id = pws.warehouse_id 
        AND pws.product_id = $1
      WHERE w.is_active = true
      ORDER BY w.sort_order, w.name
    `, [productId])

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching product warehouse stock:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouse stock' },
      { status: 500 }
    )
  }
}

// PUT - обновить остатки товара по складам
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)
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
        'DELETE FROM product_warehouse_stock WHERE product_id = $1',
        [productId]
      )

      // Вставляем новые записи
      for (const stock of warehouseStocks) {
        if (stock.quantity > 0) {
          await pool.query(
            `INSERT INTO product_warehouse_stock 
             (product_id, warehouse_id, quantity, reserved_quantity)
             VALUES ($1, $2, $3, $4)`,
            [productId, stock.warehouse_id, stock.quantity, stock.reserved_quantity || 0]
          )
        }
      }

      // Обновляем общее количество в таблице products
      const totalResult = await pool.query(
        `SELECT SUM(quantity) as total FROM product_warehouse_stock WHERE product_id = $1`,
        [productId]
      )
      const totalQuantity = totalResult.rows[0]?.total || 0

      await pool.query(
        `UPDATE products SET stock_quantity = $1 WHERE id = $2`,
        [totalQuantity, productId]
      )

      await pool.query('COMMIT')

      // Возвращаем обновленные данные
      const result = await pool.query(`
        SELECT 
          w.id as warehouse_id,
          w.name as warehouse_name,
          w.code as warehouse_code,
          w.city,
          COALESCE(pws.quantity, 0) as quantity,
          COALESCE(pws.reserved_quantity, 0) as reserved_quantity
        FROM warehouses w
        LEFT JOIN product_warehouse_stock pws 
          ON w.id = pws.warehouse_id 
          AND pws.product_id = $1
        WHERE w.is_active = true
        ORDER BY w.sort_order, w.name
      `, [productId])

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
    console.error('Error updating product warehouse stock:', error)
    return NextResponse.json(
      { error: 'Failed to update warehouse stock' },
      { status: 500 }
    )
  }
}