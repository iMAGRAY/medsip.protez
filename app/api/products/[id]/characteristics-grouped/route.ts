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
    
    // Получаем характеристики продукта, группированные по группам
    const result = await pool.query(`
      SELECT 
        cg.id as group_id,
        cg.name as group_name,
        cg.sort_order as group_sort_order,
        json_agg(
          json_build_object(
            'id', cv.id,
            'value', cv.value,
            'description', cv.description,
            'sort_order', cv.sort_order
          ) ORDER BY cv.sort_order, cv.value
        ) as characteristics
      FROM product_characteristics_simple pcs
      INNER JOIN characteristics_values_simple cv ON pcs.value_id = cv.id
      INNER JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
      WHERE pcs.product_id = $1
        AND cv.is_active = true
        AND cg.is_active = true
      GROUP BY cg.id, cg.name, cg.sort_order
      ORDER BY COALESCE(cg.sort_order, 0), cg.name
    `, [productId])
    
    // Форматируем результат как объект с группами
    const groupedCharacteristics: Record<string, any> = {}
    
    result.rows.forEach(row => {
      groupedCharacteristics[row.group_name] = {
        id: row.group_id,
        name: row.group_name,
        sortOrder: row.group_sort_order,
        characteristics: row.characteristics
      }
    })
    
    // Если нет характеристик, проверяем существует ли продукт
    if (Object.keys(groupedCharacteristics).length === 0) {
      const productCheck = await pool.query(
        'SELECT id FROM products WHERE id = $1',
        [productId]
      )
      
      if (productCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Продукт не найден'
        }, { status: 404 })
      }
    }
    
    return NextResponse.json({
      success: true,
      data: groupedCharacteristics
    })
    
  } catch (error) {
    // Если таблицы характеристик не существуют, возвращаем пустой результат
    if (error.message && error.message.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        data: {}
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения характеристик'
    }, { status: 500 })
  }
}