import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'
import { generateUniqueSlug, generateSizeSlug } from '@/lib/utils/slug-generator'
import {
  mapLegacySizeToVariant,
  mapVariantToLegacySize,
  generateInsertFields,
  generateInsertPlaceholders,
  generateUpdateFields,
  type LegacySizeInput
} from '@/lib/utils/field-mapper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/products/[id]/sizes - создать новый вариант
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const masterProductId = parseInt(resolvedParams.id)
    const body: LegacySizeInput = await request.json()

    if (!body.sizeName) {
      return NextResponse.json(
        { success: false, error: 'Size name is required' },
        { status: 400 }
      )
    }

    // Генерируем уникальный slug для варианта
    const baseName = body.name || body.sizeName
    const slug = await generateUniqueSlug(baseName, masterProductId)

    // Конвертируем legacy данные в формат product_variants
    const variantData = mapLegacySizeToVariant(body, masterProductId, slug)

    const query = `
      INSERT INTO product_variants (
        ${generateInsertFields()}
      ) VALUES (
        ${generateInsertPlaceholders()}
      )
      RETURNING *
    `

    const values = [
      variantData.master_id,
      variantData.name,
      variantData.slug,
      variantData.sku,
      variantData.description,
      variantData.price,
      variantData.discount_price,
      variantData.stock_quantity,
      variantData.reserved_quantity,
      JSON.stringify(variantData.attributes),
      variantData.primary_image_url,
      JSON.stringify(variantData.images),
      variantData.is_active,
      variantData.is_featured,
      variantData.is_new,
      variantData.is_bestseller,
      variantData.sort_order,
      variantData.size_name,
      variantData.size_value,
      JSON.stringify(variantData.dimensions),
      JSON.stringify(variantData.specifications),
      variantData.weight,
      variantData.warranty_months,
      variantData.battery_life_hours,
      variantData.meta_title,
      variantData.meta_description,
      variantData.meta_keywords,
      JSON.stringify(variantData.custom_fields),
      variantData.cost_price
    ]

    const result = await executeQuery(query, values)
    
    // Конвертируем результат обратно в legacy формат для API compatibility
    const legacyResponse = mapVariantToLegacySize(result.rows[0])
    
    return NextResponse.json({
      success: true,
      data: legacyResponse
    })
  } catch (error) {
    logger.error('Error creating product variant:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create product variant' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/products/[id]/sizes - обновить вариант
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const masterProductId = parseInt(resolvedParams.id)
    const body: LegacySizeInput & { variantId: number } = await request.json()
    const { variantId } = body

    if (!variantId) {
      return NextResponse.json(
        { success: false, error: 'Variant ID is required' },
        { status: 400 }
      )
    }

    if (!body.sizeName) {
      return NextResponse.json(
        { success: false, error: 'Size name is required' },
        { status: 400 }
      )
    }

    // Получаем текущий вариант для проверки существования и текущего slug
    const currentVariantQuery = `
      SELECT slug FROM product_variants 
      WHERE id = $1 AND master_id = $2
    `
    const currentVariantResult = await executeQuery(currentVariantQuery, [variantId, masterProductId])
    
    if (currentVariantResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Variant not found' },
        { status: 404 }
      )
    }

    const currentSlug = currentVariantResult.rows[0].slug

    // Генерируем новый slug если name изменился
    const baseName = body.name || body.sizeName
    const newSlug = await generateUniqueSlug(baseName, masterProductId, currentSlug)

    // Конвертируем legacy данные в формат product_variants
    const variantData = mapLegacySizeToVariant(body, masterProductId, newSlug)

    const query = `
      UPDATE product_variants SET
        ${generateUpdateFields()}
      WHERE id = $1
      RETURNING *
    `

    const values = [
      variantId,
      variantData.name,
      variantData.slug,
      variantData.sku,
      variantData.description,
      variantData.price,
      variantData.discount_price,
      variantData.stock_quantity,
      JSON.stringify(variantData.attributes),
      variantData.primary_image_url,
      JSON.stringify(variantData.images),
      variantData.is_active,
      variantData.is_featured,
      variantData.is_new,
      variantData.is_bestseller,
      variantData.sort_order,
      variantData.size_name,
      variantData.size_value,
      JSON.stringify(variantData.dimensions),
      JSON.stringify(variantData.specifications),
      variantData.weight,
      variantData.warranty_months,
      variantData.battery_life_hours,
      variantData.meta_title,
      variantData.meta_description,
      variantData.meta_keywords,
      JSON.stringify(variantData.custom_fields)
    ]

    const result = await executeQuery(query, values)
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Variant not found' },
        { status: 404 }
      )
    }

    // Конвертируем результат обратно в legacy формат для API compatibility
    const legacyResponse = mapVariantToLegacySize(result.rows[0])

    return NextResponse.json({
      success: true,
      data: legacyResponse
    })
  } catch (error) {
    logger.error('Error updating product variant:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update product variant' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/products/[id]/sizes - удалить вариант
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const masterProductId = parseInt(resolvedParams.id)
    const { searchParams } = new URL(request.url)
    const variantId = searchParams.get('variantId')

    if (!variantId) {
      return NextResponse.json(
        { success: false, error: 'Variant ID is required' },
        { status: 400 }
      )
    }

    const query = `
      DELETE FROM product_variants
      WHERE id = $1 AND master_id = $2
      RETURNING id
    `

    const result = await executeQuery(query, [variantId, masterProductId])
    
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
    logger.error('Error deleting product variant:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete product variant' },
      { status: 500 }
    )
  }
}