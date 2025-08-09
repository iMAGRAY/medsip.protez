import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db-connection'

// Конфигурация для статической генерации
export const dynamic = 'force-dynamic'

// PUT /api/variant-images - обновить изображения варианта товара
export async function PUT(request: NextRequest) {
  const pool = getPool()

  try {
    const body = await request.json()
    const { variantId, images } = body

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(images)) {
      return NextResponse.json(
        { error: 'Images must be an array' },
        { status: 400 }
      )
    }

    // Начинаем транзакцию
    await pool.query('BEGIN')

    try {
      // Обновляем изображения варианта
      const updateQuery = `
        UPDATE product_variants
        SET 
          images = $1,
          primary_image_url = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, images, primary_image_url
      `

      // Первое изображение становится основным
      const primaryImageUrl = images.length > 0 ? images[0] : null

      const result = await pool.query(updateQuery, [
        JSON.stringify(images),
        primaryImageUrl,
        parseInt(variantId)
      ])

      if (result.rows.length === 0) {
        await pool.query('ROLLBACK')
        return NextResponse.json(
          { error: 'Variant not found' },
          { status: 404 }
        )
      }

      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: result.rows[0]
      })
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error updating variant images:', error)
    return NextResponse.json(
      { error: 'Failed to update variant images' },
      { status: 500 }
    )
  }
}

// GET /api/variant-images - получить изображения варианта
export async function GET(request: NextRequest) {
  const pool = getPool()

  try {
    const { searchParams } = new URL(request.url)
    const variantId = searchParams.get('variantId')

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      )
    }

    const query = `
      SELECT
        id,
        images,
        primary_image_url
      FROM product_variants
      WHERE id = $1
    `

    const result = await pool.query(query, [parseInt(variantId)])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      )
    }

    const variant = result.rows[0]
    const images = variant.images || []

    return NextResponse.json({
      success: true,
      data: {
        variantId: variant.id,
        images: images,
        primaryImageUrl: variant.primary_image_url
      }
    })
  } catch (error) {
    console.error('Error fetching variant images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch variant images' },
      { status: 500 }
    )
  }
}