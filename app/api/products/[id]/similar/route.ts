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
    
    // Сначала получаем информацию о текущем продукте
    const productResult = await pool.query(`
      SELECT 
        category_id,
        manufacturer_id,
        price,
        name
      FROM products
      WHERE id = $1
    `, [productId])
    
    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Продукт не найден'
      }, { status: 404 })
    }
    
    const currentProduct = productResult.rows[0]
    
    // Находим похожие продукты
    // Приоритет: та же категория > тот же производитель > похожая цена
    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.sku,
        p.article_number,
        p.price,
        p.discount_price,
        p.image_url,
        p.in_stock,
        p.stock_quantity,
        p.stock_status,
        p.category_id,
        p.manufacturer_id,
        c.name as category_name,
        m.name as manufacturer_name,
        -- Вычисляем релевантность
        CASE 
          WHEN p.category_id = $2 THEN 10
          ELSE 0
        END +
        CASE 
          WHEN p.manufacturer_id = $3 THEN 5
          ELSE 0
        END +
        CASE 
          WHEN p.price IS NOT NULL AND $4::numeric IS NOT NULL 
            AND ABS(p.price - $4::numeric) / GREATEST(p.price, $4::numeric) < 0.3 THEN 3
          ELSE 0
        END as relevance_score
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE p.id != $1
        AND (p.is_deleted = false OR p.is_deleted IS NULL)
        AND p.in_stock = true
        AND (
          p.category_id = $2
          OR p.manufacturer_id = $3
          OR (p.price IS NOT NULL AND $4::numeric IS NOT NULL 
              AND ABS(p.price - $4::numeric) / GREATEST(p.price, $4::numeric) < 0.5)
        )
      ORDER BY relevance_score DESC, p.created_at DESC
      LIMIT 12
    `, [
      productId,
      currentProduct.category_id,
      currentProduct.manufacturer_id,
      currentProduct.price
    ])
    
    // Форматируем данные
    const similarProducts = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      sku: row.sku,
      articleNumber: row.article_number,
      price: row.price ? parseFloat(row.price) : null,
      discountPrice: row.discount_price ? parseFloat(row.discount_price) : null,
      imageUrl: row.image_url,
      inStock: row.in_stock,
      stockQuantity: row.stock_quantity,
      stockStatus: row.stock_status,
      categoryId: row.category_id,
      categoryName: row.category_name,
      manufacturerId: row.manufacturer_id,
      manufacturerName: row.manufacturer_name,
      relevanceScore: row.relevance_score
    }))
    
    return NextResponse.json({
      success: true,
      data: similarProducts
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения похожих продуктов'
    }, { status: 500 })
  }
}