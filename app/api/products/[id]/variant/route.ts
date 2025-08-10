
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  try {
    const productId = parseInt(params.id)

    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    logger.info('Product variant POST request', { productId })

    const productCheck = await executeQuery(
      'SELECT id, name, sku FROM products WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)',
      [productId]
    )

    if (productCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    const product = productCheck.rows[0]

    const existingVariantCheck = await executeQuery(
      'SELECT id, variant_sku FROM product_variants WHERE master_id = $1 AND (is_deleted = false OR is_deleted IS NULL)',
      [productId]
    )

    if (existingVariantCheck.rows.length > 0) {
      const variant = existingVariantCheck.rows[0]

      const _duration = Date.now() - startTime
      logger.info('Existing product variant returned', { productId, variantId: variant.id, duration })

      return NextResponse.json({
        success: true,
        data: {
          id: variant.id,
          productId: productId,
          variantSku: variant.variant_sku,
          productName: product.name,
          productSku: product.sku,
          isExisting: true
        },
        message: 'Existing product variant'
      })
    }

    const variantSku = `${product.sku || productId}-VAR-${Date.now()}`

    const createVariantQuery = `
      INSERT INTO product_variants (
        master_id,
        variant_sku,
        variant_name,
        price_modifier,
        stock_quantity,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, variant_sku, variant_name
    `

    const variantResult = await executeQuery(createVariantQuery, [
      productId,
      variantSku,
      `${product.name} Variant`,
      0,
      0,
      true
    ])

    const newVariant = variantResult.rows[0]

    const _duration = Date.now() - startTime
    logger.info('New product variant created', {
      productId,
      variantId: newVariant.id,
      variantSku: newVariant.variant_sku,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        id: newVariant.id,
        productId: productId,
        variantSku: newVariant.variant_sku,
        variantName: newVariant.variant_name,
        productName: product.name,
        productSku: product.sku,
        isExisting: false
      },
      message: 'Product variant created successfully'
    })

  } catch (error) {
    const _duration = Date.now() - startTime
    logger.error('Product variant POST error', error, 'API')

    let statusCode = 500
    let errorMessage = 'Failed to create product variant'

    if ((error as any).code === '23505') {
      statusCode = 409
      errorMessage = 'Product variant with this SKU already exists'
    } else if ((error as any).code === '23503') {
      statusCode = 400
      errorMessage = 'Invalid product reference'
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      message: 'Database operation failed'
    }, { status: statusCode })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  try {
    const productId = parseInt(params.id)

    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    logger.info('Product variant GET request', { productId })

    const query = `
      SELECT
        pv.*,
        p.name as product_name,
        p.sku as product_sku
      FROM product_variants pv
      LEFT JOIN products p ON pv.master_id = p.id
      WHERE pv.master_id = $1 AND (pv.is_deleted = false OR pv.is_deleted IS NULL)
      ORDER BY pv.created_at DESC
    `

    const result = await executeQuery(query, [productId])

    const _duration = Date.now() - startTime
    logger.info('Product variants loaded', {
      productId,
      variantsCount: result.rows.length,
      duration
    })

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })

  } catch (error) {
    const _duration = Date.now() - startTime
    logger.error('Product variant GET error', error, 'API')

    return NextResponse.json({
      success: false,
      error: 'Failed to load product variants',
      message: 'Database operation failed'
    }, { status: 500 })
  }
}