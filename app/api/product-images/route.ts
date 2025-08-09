import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db-connection'
import { withCache, invalidateApiCache } from '@/lib/cache/cache-middleware'
import { cacheKeys, cacheRemember, CACHE_TTL, invalidateCache, cachePatterns } from '@/lib/cache/cache-utils'

// GET /api/product-images - получить изображения товара
export const GET = withCache(async function GET(request: NextRequest) {
  const pool = getPool()

  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const nocache = searchParams.get('nocache') === 'true'

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const cacheKey = cacheKeys.productImages(parseInt(productId))
    
    const fetchImages = async () => {
      const query = `
        SELECT
          id,
          product_id,
          image_url,
          image_order,
          is_main,
          alt_text,
          created_at
        FROM product_images
        WHERE product_id = $1
        ORDER BY image_order ASC, is_main DESC, created_at ASC
      `

      const result = await pool.query(query, [parseInt(productId)])

      return {
        success: true,
        data: result.rows
      }
    }

    if (nocache) {
      const data = await fetchImages()
      return NextResponse.json(data)
    }

    const responseData = await cacheRemember(
      cacheKey,
      CACHE_TTL.LONG,
      fetchImages,
      'media'
    )

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching product images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product images' },
      { status: 500 }
    )
  }
})

// POST /api/product-images - добавить изображения к товару
export async function POST(request: NextRequest) {
  const pool = getPool()

  try {
    const body = await request.json()
    const { productId, images } = body

    if (!productId || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Product ID and images array are required' },
        { status: 400 }
      )
    }

    // Начинаем транзакцию
    await pool.query('BEGIN')

    try {
      // Получаем текущий максимальный порядок и проверяем, есть ли уже изображения
      const maxOrderResult = await pool.query(
        'SELECT COALESCE(MAX(image_order), 0) as max_order, COUNT(*) as count FROM product_images WHERE product_id = $1',
        [productId]
      )
      let currentOrder = maxOrderResult.rows[0].max_order
      const hasExistingImages = maxOrderResult.rows[0].count > 0

      const insertedImages = []

      for (const imageUrl of images) {
        currentOrder++

        const insertQuery = `
          INSERT INTO product_images (
            product_id,
            image_url,
            image_order,
            is_main,
            alt_text
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `

        // Первое изображение становится главным, если у товара еще нет изображений
        const isMain = !hasExistingImages && currentOrder === 1

        const result = await pool.query(insertQuery, [
          productId,
          imageUrl,
          currentOrder,
          isMain,
          `Изображение товара ${currentOrder}`
        ])

        insertedImages.push(result.rows[0])
      }

      // Перенумеровываем порядок изображений без пропусков
      await pool.query(`
        WITH ordered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY image_order) AS rn
          FROM product_images
          WHERE product_id = $1
        )
        UPDATE product_images AS pi
        SET image_order = o.rn
        FROM ordered o
        WHERE pi.id = o.id;
      `, [productId])

      // Обновляем главное изображение товара
      if (insertedImages.length > 0) {
        const mainImage = insertedImages.find(img => img.is_main) || insertedImages[0]
        await pool.query(
          'UPDATE products SET image_url = $1 WHERE id = $2',
          [mainImage.image_url, productId]
        )
      }

      await pool.query('COMMIT')

      // Очищаем кеш после добавления изображений
      await invalidateCache([
        cachePatterns.product(productId),
        cacheKeys.productImages(productId),
        'api:*product-images*',
        'api:*products*'
      ])
      await invalidateApiCache(['/product-images', '/products'])

      return NextResponse.json({
        success: true,
        data: insertedImages,
        message: `Successfully added ${insertedImages.length} images`
      })

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Error adding product images:', error)
    return NextResponse.json(
      { error: 'Failed to add product images' },
      { status: 500 }
    )
  }
}

// PUT /api/product-images - обновить порядок изображений
export async function PUT(request: NextRequest) {
  const pool = getPool()

  try {
    const body = await request.json()
    const { productId, images } = body

    if (!productId || !Array.isArray(images)) {
      return NextResponse.json(
        { error: 'Product ID and images array are required' },
        { status: 400 }
      )
    }

    await pool.query('BEGIN')

    try {
      // Удаляем все старые изображения
      await pool.query(
        'DELETE FROM product_images WHERE product_id = $1',
        [productId]
      )

      // Добавляем новые изображения в правильном порядке
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i]
        const isMain = i === 0 // Первое изображение всегда главное

        await pool.query(`
          INSERT INTO product_images (
            product_id,
            image_url,
            image_order,
            is_main,
            alt_text
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [
          productId,
          imageUrl,
          i + 1,
          isMain,
          `Изображение товара ${i + 1}`
        ])
      }

      // Обновляем главное изображение товара
      if (images.length > 0) {
        await pool.query(
          'UPDATE products SET image_url = $1 WHERE id = $2',
          [images[0], productId]
        )
      }

      await pool.query('COMMIT')

      // Очищаем кеш после обновления изображений
      await invalidateCache([
        cachePatterns.product(productId),
        cacheKeys.productImages(productId),
        'api:*product-images*',
        'api:*products*'
      ])
      await invalidateApiCache(['/product-images', '/products'])

      return NextResponse.json({
        success: true,
        message: 'Images order updated successfully'
      })

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Error updating product images:', error)
    return NextResponse.json(
      { error: 'Failed to update product images' },
      { status: 500 }
    )
  }
}

// DELETE /api/product-images - удалить изображение товара
export async function DELETE(request: NextRequest) {
  const pool = getPool()

  try {
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')
    const productId = searchParams.get('productId')

    if (!imageId && !productId) {
      return NextResponse.json(
        { error: 'Image ID or Product ID is required' },
        { status: 400 }
      )
    }

    await pool.query('BEGIN')

    try {
      let targetProductId: number | null = null

      if (imageId) {
        // Удаляем конкретное изображение
        const deleteResult = await pool.query(
          'DELETE FROM product_images WHERE id = $1 RETURNING product_id, is_main',
          [imageId]
        )

        if (deleteResult.rows.length === 0) {
          await pool.query('ROLLBACK')
          return NextResponse.json(
            { error: 'Image not found' },
            { status: 404 }
          )
        }

        const deletedImage = deleteResult.rows[0]
        targetProductId = deletedImage.product_id

        // Если удалили главное изображение, делаем главным следующее
        if (deletedImage.is_main) {
          const newMainResult = await pool.query(
            'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY image_order ASC LIMIT 1',
            [deletedImage.product_id]
          )

          if (newMainResult.rows.length > 0) {
            await pool.query(
              'UPDATE product_images SET is_main = true WHERE product_id = $1 AND image_url = $2',
              [deletedImage.product_id, newMainResult.rows[0].image_url]
            )

            await pool.query(
              'UPDATE products SET image_url = $1 WHERE id = $2',
              [newMainResult.rows[0].image_url, deletedImage.product_id]
            )
          } else {
            // Если изображений не осталось, очищаем image_url товара
            await pool.query(
              'UPDATE products SET image_url = NULL WHERE id = $1',
              [deletedImage.product_id]
            )
          }
        }

      } else if (productId) {
        // Удаляем все изображения товара
        await pool.query(
          'DELETE FROM product_images WHERE product_id = $1',
          [productId]
        )

        // Очищаем image_url товара
        await pool.query(
          'UPDATE products SET image_url = NULL WHERE id = $1',
          [productId]
        )
        targetProductId = parseInt(productId)
      }

      // После любых удалений упорядочиваем image_order
      if (targetProductId) {
        await pool.query(`
          WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY image_order) AS rn
            FROM product_images
            WHERE product_id = $1
          )
          UPDATE product_images AS pi
          SET image_order = o.rn
          FROM ordered o
          WHERE pi.id = o.id;
        `, [targetProductId])
      }

      await pool.query('COMMIT')

      // Очищаем кеш продуктов после удаления изображений
      if (targetProductId) {
        await invalidateCache([
          cachePatterns.allProducts,
          cacheKeys.productImages(targetProductId),
          'api:*product-images*',
          'api:*products*'
        ])
        await invalidateApiCache(['/product-images', '/products'])
      }

      return NextResponse.json({
        success: true,
        message: 'Image(s) deleted successfully'
      })

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Error deleting product images:', error)
    return NextResponse.json(
      { error: 'Failed to delete product images' },
      { status: 500 }
    )
  }
}