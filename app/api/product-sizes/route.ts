import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db-connection'
import { executeQuery } from "@/lib/db-connection"

// GET /api/product-sizes - получить все размеры или размеры для конкретного продукта
export async function GET() {
  try {

    const query = `
      SELECT
        ps.id,
        ps.size_name,
        ps.size_value,
        ps.sku,
        ps.is_available,
        p.name as product_name
      FROM product_sizes ps
      LEFT JOIN products p ON ps.product_id = p.id
      ORDER BY ps.size_name ASC
    `

    const result = await executeQuery(query)
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Database error in product-sizes GET:", error)
    return NextResponse.json({ error: "Failed to fetch product sizes" }, { status: 500 })
  }
}

// POST /api/product-sizes - создать новый размер продукта
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      productId,
      sizeName,
      sizeValue,
      name,
      description,
      sku,
      price,
      discountPrice,
      stockQuantity = 0,
      weight,
      dimensions,
      specifications,
      isAvailable = true,
      sortOrder = 0,
      imageUrl,
      images,
      warranty,
      batteryLife,
      metaTitle,
      metaDescription,
      metaKeywords,
      isFeatured = false,
      isNew = false,
      isBestseller = false,
      customFields,
      characteristics,
      selectionTables
    } = body

    if (!productId || !sizeName) {
      return NextResponse.json(
        { error: 'Product ID and size name are required' },
        { status: 400 }
      )
    }

    const insertQuery = `
      INSERT INTO product_sizes (
        product_id, size_name, size_value, name, description, sku, price, discount_price,
        stock_quantity, weight, dimensions, specifications,
        is_available, sort_order, image_url, images, warranty, battery_life,
        meta_title, meta_description, meta_keywords,
        is_featured, is_new, is_bestseller, custom_fields, characteristics, selection_tables
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING *
    `

    const values = [
      productId,
      sizeName,
      sizeValue,
      name,
      description,
      sku,
      price,
      discountPrice,
      stockQuantity,
      weight,
      dimensions ? JSON.stringify(dimensions) : null,
      specifications ? JSON.stringify(specifications) : null,
      isAvailable,
      sortOrder,
      imageUrl,
      images ? JSON.stringify(images) : null,
      warranty,
      batteryLife,
      metaTitle,
      metaDescription,
      metaKeywords,
      isFeatured,
      isNew,
      isBestseller,
      customFields ? JSON.stringify(customFields) : null,
      characteristics ? JSON.stringify(characteristics) : null,
      selectionTables ? JSON.stringify(selectionTables) : null
    ]

    const pool = getPool()
    const result = await pool.query(insertQuery, values)
    const newSize = result.rows[0]

    // Трансформируем ответ
    const response = {
      id: newSize.id,
      productId: newSize.product_id,
      sizeName: newSize.size_name,
      sizeValue: newSize.size_value,
      sku: newSize.sku,
      price: newSize.price ? parseFloat(newSize.price) : null,
      stockQuantity: newSize.stock_quantity,
      weight: newSize.weight ? parseFloat(newSize.weight) : null,
      dimensions: newSize.dimensions,
      specifications: newSize.specifications,
      isAvailable: newSize.is_available,
      sortOrder: newSize.sort_order,
      createdAt: newSize.created_at,
      updatedAt: newSize.updated_at
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error: any) {
    console.error('Error creating product size:', error)

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
      { error: 'Failed to create product size' },
      { status: 500 }
    )
  }
}