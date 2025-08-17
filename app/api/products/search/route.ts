import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const categoryId = searchParams.get('category')
    const includeVariants = searchParams.get('includeVariants') === 'true'

    if (!query.trim()) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    let searchQuery = `
      SELECT ${includeVariants ? '' : 'DISTINCT'}
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
        p.show_price,
        p.category_id,
        p.manufacturer_id,
        p.series_id,
        c.name as category_name,
        m.name as manufacturer_name${includeVariants ? `,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pv.id,
                'sizeName', pv.size_name,
                'sizeValue', pv.size_value,
                'sku', pv.sku,
                'price', pv.price,
                'discountPrice', pv.discount_price,
                'stockQuantity', pv.stock_quantity,
                'isAvailable', pv.is_active
              ) ORDER BY pv.sort_order, pv.size_name
            )
            FROM product_variants pv
            WHERE pv.master_id = p.id
              AND pv.is_active = true
              AND pv.is_deleted = false
              AND (
                LOWER(pv.size_name) LIKE LOWER($1)
                OR LOWER(pv.size_value) LIKE LOWER($1)
                OR LOWER(pv.sku) LIKE LOWER($1)
              )
          ),
          '[]'::json
        ) as matching_variants` : ''}
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
        AND (
          LOWER(p.name) LIKE LOWER($1)
          OR LOWER(p.description) LIKE LOWER($1)
          OR LOWER(p.sku) LIKE LOWER($1)
          OR LOWER(p.article_number) LIKE LOWER($1)
          ${includeVariants ? `
            OR EXISTS (
              SELECT 1 
              FROM product_variants pv 
              WHERE pv.master_id = p.id 
                AND pv.is_active = true
                AND pv.is_deleted = false
                AND (
                  LOWER(pv.size_name) LIKE LOWER($1)
                  OR LOWER(pv.size_value) LIKE LOWER($1)
                  OR LOWER(pv.sku) LIKE LOWER($1)
                )
            )
          ` : ''}
        )
    `

    const queryParams = [`%${query}%`]
    let paramIndex = 2

    if (categoryId) {
      searchQuery += ` AND p.category_id = $${paramIndex}`
      queryParams.push(categoryId)
      paramIndex++
    }

    searchQuery += ` ORDER BY p.name LIMIT 50`

    const result = await executeQuery(searchQuery, queryParams)

    // Преобразуем результаты
    const products = result.rows.map(row => ({
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
      showPrice: row.show_price,
      categoryId: row.category_id,
      categoryName: row.category_name,
      manufacturerName: row.manufacturer_name,
      matchingVariants: includeVariants ? (row.matching_variants || []) : undefined
    }))

    return NextResponse.json({
      success: true,
      data: products
    })
  } catch (error) {
    logger.error('Error searching products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search products' },
      { status: 500 }
    )
  }
}