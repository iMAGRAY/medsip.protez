import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db-connection'

// GET /api/product-sizes/[id] - получить размер по ID
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid size ID' },
        { status: 400 }
      )
    }

    const query = `
      SELECT
        ps.*,
        p.name as product_name,
        'Без категории' as category_name
      FROM product_sizes ps
      LEFT JOIN products p ON ps.product_id = p.id
      WHERE ps.id = $1
    `

    const pool = getPool()
    const result = await pool.query(query, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Size not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]
    const size = {
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      categoryName: row.category_name,
      sizeName: row.size_name,
      sizeValue: row.size_value,
      sku: row.sku,
      price: row.price ? parseFloat(row.price) : null,
      stockQuantity: row.stock_quantity,
      weight: row.weight ? parseFloat(row.weight) : null,
      dimensions: row.dimensions,
      specifications: row.specifications,
      isAvailable: row.is_available,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }

    return NextResponse.json(size)
  } catch (error) {
    console.error('Error fetching product size:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product size' },
      { status: 500 }
    )
  }
}

// PUT /api/product-sizes/[id] - обновить размер
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid size ID' },
        { status: 400 }
      )
    }

    const body = await request.json()

    const {
      sizeName,
      sizeValue,
      name,
      description,
      sku,
      price,
      discountPrice,
      stockQuantity,
      weight,
      dimensions,
      specifications,
      isAvailable,
      sortOrder,
      imageUrl,
      images,
      warranty,
      batteryLife,
      metaTitle,
      metaDescription,
      metaKeywords,
      isFeatured,
      isNew,
      isBestseller,
      customFields,
      characteristics,
      selectionTables
    } = body

    const updateQuery = `
      UPDATE product_sizes SET
        size_name = COALESCE($1, size_name),
        size_value = COALESCE($2, size_value),
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        sku = COALESCE($5, sku),
        price = COALESCE($6, price),
        discount_price = COALESCE($7, discount_price),
        stock_quantity = COALESCE($8, stock_quantity),
        weight = COALESCE($9, weight),
        dimensions = COALESCE($10, dimensions),
        specifications = COALESCE($11, specifications),
        is_available = COALESCE($12, is_available),
        sort_order = COALESCE($13, sort_order),
        image_url = COALESCE($14, image_url),
        images = COALESCE($15, images),
        warranty = COALESCE($16, warranty),
        battery_life = COALESCE($17, battery_life),
        meta_title = COALESCE($18, meta_title),
        meta_description = COALESCE($19, meta_description),
        meta_keywords = COALESCE($20, meta_keywords),
        is_featured = COALESCE($21, is_featured),
        is_new = COALESCE($22, is_new),
        is_bestseller = COALESCE($23, is_bestseller),
        custom_fields = COALESCE($24, custom_fields),
        characteristics = COALESCE($25, characteristics),
        selection_tables = COALESCE($26, selection_tables),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $27
      RETURNING *
    `

    const values = [
      sizeName,
      sizeValue,
      name,
      description,
      sku,
      price,
      discountPrice,
      stockQuantity,
      weight,
      dimensions ? JSON.stringify(dimensions) : undefined,
      specifications ? JSON.stringify(specifications) : undefined,
      isAvailable,
      sortOrder,
      imageUrl,
      images ? JSON.stringify(images) : undefined,
      warranty,
      batteryLife,
      metaTitle,
      metaDescription,
      metaKeywords,
      isFeatured,
      isNew,
      isBestseller,
      customFields ? JSON.stringify(customFields) : undefined,
      characteristics ? JSON.stringify(characteristics) : undefined,
      selectionTables ? JSON.stringify(selectionTables) : undefined,
      id
    ]

    const pool = getPool()
    const result = await pool.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Size not found' },
        { status: 404 }
      )
    }

    const updatedSize = result.rows[0]

    const response = {
      id: updatedSize.id,
      productId: updatedSize.product_id,
      sizeName: updatedSize.size_name,
      sizeValue: updatedSize.size_value,
      sku: updatedSize.sku,
      price: updatedSize.price ? parseFloat(updatedSize.price) : null,
      stockQuantity: updatedSize.stock_quantity,
      weight: updatedSize.weight ? parseFloat(updatedSize.weight) : null,
      dimensions: updatedSize.dimensions,
      specifications: updatedSize.specifications,
      isAvailable: updatedSize.is_available,
      sortOrder: updatedSize.sort_order,
      createdAt: updatedSize.created_at,
      updatedAt: updatedSize.updated_at
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error updating product size:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { // Unique constraint violation
      if (error.constraint === 'unique_product_size') {
        return NextResponse.json(
          { error: 'Size already exists for this product' },
          { status: 409 }
        )
      }
      if (error.constraint === 'unique_sku') {
        return NextResponse.json(
          { error: 'SKU already exists' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to update product size' },
      { status: 500 }
    )
  }
}

// DELETE /api/product-sizes/[id] - удалить размер
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid size ID' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const result = await pool.query(
      'DELETE FROM product_sizes WHERE id = $1 RETURNING *',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Size not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Product size deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting product size:', error)
    return NextResponse.json(
      { error: 'Failed to delete product size' },
      { status: 500 }
    )
  }
}