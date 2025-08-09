import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/products/[id]/sizes - создать новый вариант
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id
    const body = await request.json()

    const query = `
      INSERT INTO product_sizes (
        product_id, size_name, size_value, name, description,
        sku, price, discount_price, stock_quantity, weight,
        dimensions, specifications, is_available, sort_order,
        image_url, images, warranty, battery_life,
        meta_title, meta_description, meta_keywords,
        is_featured, is_new, is_bestseller,
        custom_fields, characteristics, selection_tables
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      RETURNING *
    `

    const values = [
      productId,
      body.sizeName,
      body.sizeValue || null,
      body.name || null,
      body.description || null,
      body.sku || null,
      body.price || null,
      body.discountPrice || null,
      body.stockQuantity || null,
      body.weight || null,
      body.dimensions || null,
      body.specifications || null,
      body.isAvailable !== false,
      body.sortOrder || 0,
      body.imageUrl || null,
      JSON.stringify(body.images || []),
      body.warranty || null,
      body.batteryLife || null,
      body.metaTitle || null,
      body.metaDescription || null,
      body.metaKeywords || null,
      body.isFeatured || false,
      body.isNew || false,
      body.isBestseller || false,
      JSON.stringify(body.customFields || {}),
      JSON.stringify(body.characteristics || []),
      JSON.stringify(body.selectionTables || [])
    ]

    const result = await executeQuery(query, values)
    
    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    logger.error('Error creating product size:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create product size' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/products/[id]/sizes - обновить вариант
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { variantId } = body

    if (!variantId) {
      return NextResponse.json(
        { success: false, error: 'Variant ID is required' },
        { status: 400 }
      )
    }

    const query = `
      UPDATE product_sizes SET
        size_name = $2,
        size_value = $3,
        name = $4,
        description = $5,
        sku = $6,
        price = $7,
        discount_price = $8,
        stock_quantity = $9,
        weight = $10,
        dimensions = $11,
        specifications = $12,
        is_available = $13,
        sort_order = $14,
        image_url = $15,
        images = $16,
        warranty = $17,
        battery_life = $18,
        meta_title = $19,
        meta_description = $20,
        meta_keywords = $21,
        is_featured = $22,
        is_new = $23,
        is_bestseller = $24,
        custom_fields = $25,
        characteristics = $26,
        selection_tables = $27,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `

    const values = [
      variantId,
      body.sizeName,
      body.sizeValue || null,
      body.name || null,
      body.description || null,
      body.sku || null,
      body.price || null,
      body.discountPrice || null,
      body.stockQuantity || null,
      body.weight || null,
      body.dimensions || null,
      body.specifications || null,
      body.isAvailable !== false,
      body.sortOrder || 0,
      body.imageUrl || null,
      JSON.stringify(body.images || []),
      body.warranty || null,
      body.batteryLife || null,
      body.metaTitle || null,
      body.metaDescription || null,
      body.metaKeywords || null,
      body.isFeatured || false,
      body.isNew || false,
      body.isBestseller || false,
      JSON.stringify(body.customFields || {}),
      JSON.stringify(body.characteristics || []),
      JSON.stringify(body.selectionTables || [])
    ]

    const result = await executeQuery(query, values)
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Variant not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    logger.error('Error updating product size:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update product size' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/products/[id]/sizes - удалить вариант
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const variantId = searchParams.get('variantId')

    if (!variantId) {
      return NextResponse.json(
        { success: false, error: 'Variant ID is required' },
        { status: 400 }
      )
    }

    const query = `
      DELETE FROM product_sizes
      WHERE id = $1 AND product_id = $2
      RETURNING id
    `

    const result = await executeQuery(query, [variantId, params.id])
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Variant not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Variant deleted successfully'
    })
  } catch (error) {
    logger.error('Error deleting product size:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete product size' },
      { status: 500 }
    )
  }
}