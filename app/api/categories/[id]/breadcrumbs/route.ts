import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const categoryId = parseInt(id)
    
    if (isNaN(categoryId)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный ID категории'
      }, { status: 400 })
    }
    
    // Рекурсивный запрос для получения пути категории
    const result = await pool.query(`
      WITH RECURSIVE category_path AS (
        -- Начальная категория
        SELECT 
          id,
          name,
          parent_id,
          1 as level
        FROM product_categories
        WHERE id = $1
        
        UNION ALL
        
        -- Рекурсивно поднимаемся к родителям
        SELECT 
          pc.id,
          pc.name,
          pc.parent_id,
          cp.level + 1
        FROM product_categories pc
        INNER JOIN category_path cp ON pc.id = cp.parent_id
      )
      SELECT 
        id,
        name,
        parent_id,
        level
      FROM category_path
      ORDER BY level DESC
    `, [categoryId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Категория не найдена'
      }, { status: 404 })
    }
    
    // Форматируем хлебные крошки
    const breadcrumbs = result.rows.map((row, index) => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      isActive: index === result.rows.length - 1, // Последний элемент - активная категория
      level: result.rows.length - index // Уровень от корня
    }))
    
    return NextResponse.json({
      success: true,
      data: breadcrumbs
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения хлебных крошек'
    }, { status: 500 })
  }
}