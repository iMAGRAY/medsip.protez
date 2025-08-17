import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/products/[id]/sizes - получить все размеры для конкретного продукта
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const productId = resolvedParams.id

    const query = `
      SELECT
        ps.id,
        ps.product_id,
        ps.size_name,
        ps.size_value,
        ps.name,
        ps.description,
        ps.sku,
        ps.price,
        ps.discount_price,
        ps.stock_quantity,
        ps.weight,
        ps.dimensions,
        ps.specifications,
        ps.is_available,
        ps.sort_order,
        ps.image_url,
        ps.images,
        ps.warranty,
        ps.battery_life,
        ps.meta_title,
        ps.meta_description,
        ps.meta_keywords,
        ps.is_featured,
        ps.is_new,
        ps.is_bestseller,
        ps.custom_fields,
        ps.characteristics,
        ps.selection_tables,
        ps.created_at,
        ps.updated_at
      FROM product_sizes ps
      WHERE ps.product_id = $1
      ORDER BY ps.sort_order ASC, ps.size_name ASC
    `

    const result = await executeQuery(query, [productId])
    
    // Преобразуем данные для фронтенда
    const sizes = result.rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      sizeName: row.size_name,
      sizeValue: row.size_value,
      name: row.name,
      description: row.description,
      sku: row.sku,
      price: row.price ? parseFloat(row.price) : null,
      discountPrice: row.discount_price ? parseFloat(row.discount_price) : null,
      stockQuantity: row.stock_quantity,
      weight: row.weight ? parseFloat(row.weight) : null,
      dimensions: row.dimensions,
      specifications: row.specifications,
      isAvailable: row.is_available,
      sortOrder: row.sort_order,
      imageUrl: row.image_url,
      images: row.images || [],
      warranty: row.warranty,
      batteryLife: row.battery_life,
      metaTitle: row.meta_title,
      metaDescription: row.meta_description,
      metaKeywords: row.meta_keywords,
      isFeatured: row.is_featured,
      isNew: row.is_new,
      isBestseller: row.is_bestseller,
      customFields: row.custom_fields,
      characteristics: row.characteristics || [],
      selectionTables: row.selection_tables || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: sizes
    })
  } catch (error) {
    logger.error('Error fetching product sizes:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product sizes' },
      { status: 500 }
    )
  }
}