import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    
    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный ID продукта'
      }, { status: 400 })
    }
    
    // Получаем варианты продукта
    const result = await pool.query(`
      SELECT 
        pv.id,
        pv.master_id,
        pv.size_name,
        pv.size_value,
        pv.sku,
        pv.price,
        pv.discount_price,
        pv.stock_quantity,
        pv.is_active,
        pv.sort_order,
        pv.created_at,
        pv.updated_at
      FROM product_variants pv
      WHERE pv.master_id = $1
        AND pv.is_deleted = false
      ORDER BY pv.sort_order, pv.size_name
    `, [productId])
    
    // Форматируем данные
    const variants = result.rows.map(row => ({
      id: row.id,
      masterId: row.master_id,
      sizeName: row.size_name,
      sizeValue: row.size_value,
      sku: row.sku,
      price: row.price ? parseFloat(row.price) : null,
      discountPrice: row.discount_price ? parseFloat(row.discount_price) : null,
      stockQuantity: row.stock_quantity,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    
    return NextResponse.json({
      success: true,
      data: variants
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения вариантов продукта'
    }, { status: 500 })
  }
}