import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { logger } from '@/lib/logger'

// Функция для глубокой очистки объектов от проблемных данных
function cleanObjectForJson(obj: any, fieldName: string): any {
  if (obj === null || obj === undefined) {
    return ['images', 'videos', 'documents'].includes(fieldName) ? [] : {}
  }
  
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== null && item !== undefined)
      .map(item => {
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
          return item
        }
        if (typeof item === 'object') {
          try {
            JSON.stringify(item)
            return cleanObjectForJson(item, fieldName)
          } catch (_e) {
            return null
          }
        }
        return null
      })
      .filter(item => item !== null)
  }
  
  // Специальная обработка для случая, когда ожидается массив, но получен объект
  if (typeof obj === 'object' && ['images', 'videos', 'documents'].includes(fieldName)) {
    // Если это пустой объект {}, возвращаем пустой массив
    if (Object.keys(obj).length === 0) {
      return []
    }
    // Если объект содержит данные, пытаемся извлечь массив или конвертируем в массив
    if (obj.length !== undefined && typeof obj.length === 'number') {
      // Объект похож на массив
      try {
        return Array.from(obj).filter(item => 
          typeof item === 'string' && item.trim() !== ''
        )
      } catch (_e) {
        return []
      }
    }
    return []
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {}
    
    for (const [key, value] of Object.entries(obj)) {
      // Пропускаем функции, символы и другие непериализуемые типы
      if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
        continue
      }
      
      // Пропускаем DOM элементы и другие сложные объекты
      if (value && typeof value === 'object') {
        // Проверяем на DOM элементы
        if ('nodeType' in value || value.constructor?.name?.includes('HTML')) {
          continue
        }
        
        // Проверяем на циклические ссылки
        try {
          JSON.stringify(value)
          cleaned[key] = cleanObjectForJson(value, fieldName)
        } catch (_e) {
          // Пропускаем объекты с циклическими ссылками
          continue
        }
      } else {
        cleaned[key] = value
      }
    }
    
    return cleaned
  }
  
  // Для всех остальных случаев возвращаем безопасное значение
  return ['images', 'videos', 'documents'].includes(fieldName) ? [] : {}
}

// GET /api/v2/product-variants/[id] - получить конкретный вариант
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  const variantId = params.id
  
  try {
    const { searchParams } = new URL(request.url)
    const includeCharacteristics = searchParams.get('include_characteristics') === 'true'
    const includeImages = searchParams.get('include_images') === 'true'
    const includePriceTiers = searchParams.get('include_price_tiers') === 'true'
    
    // Используем общий API с передачей variant_id
    const url = new URL('/api/v2/product-variants', request.url)
    url.searchParams.set('variant_id', variantId)
    url.searchParams.set('include_characteristics', includeCharacteristics.toString())
    url.searchParams.set('include_images', includeImages.toString())
    
    const response = await fetch(url.toString())
    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }
    
    // Если нужны ценовые уровни, добавляем их
    if (includePriceTiers && data.data) {
      const priceTiers = await pool.query(`
        SELECT 
          id,
          user_group,
          price,
          min_quantity,
          max_quantity
        FROM variant_price_tiers
        WHERE variant_id = $1
        ORDER BY user_group, min_quantity
      `, [variantId])
      
      data.data.price_tiers = priceTiers.rows
    }
    
    return NextResponse.json(data)
    
  } catch (error) {
    const _duration = Date.now() - startTime
    logger.error('Error loading product variant', error, 'API')
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to load product variant',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: _duration
      },
      { status: 500 }
    )
  }
}

// PUT /api/v2/product-variants/[id] - обновить вариант
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  const variantId = params.id
  
  try {
    const body = await request.json()
    
    logger.info(`Updating product variant ${variantId}`, { body }, 'API')
    
    // Подготавливаем данные для обновления
    const {
      name,
      sku,
      slug,
      description,
      short_description,
      price,
      discount_price,
      cost_price,
      stock_quantity,
      stock_status,
      show_price,
      weight,
      length,
      width,
      height,
      primary_image_url,
      images,
      videos,
      documents,
      attributes,
      meta_title,
      meta_description,
      meta_keywords,
      is_featured,
      is_new,
      is_bestseller,
      is_recommended,
      is_active,
      warranty_months,
      battery_life_hours,
      custom_fields,
      sort_order
    } = body
    
    // Очищаем JSON поля
    const cleanedImages = cleanObjectForJson(images, 'images')
    const cleanedVideos = cleanObjectForJson(videos, 'videos')
    const cleanedDocuments = cleanObjectForJson(documents, 'documents')
    const cleanedAttributes = cleanObjectForJson(attributes, 'attributes')
    const cleanedCustomFields = cleanObjectForJson(custom_fields, 'custom_fields')
    
    // Обновляем вариант
    const updateQuery = `
      UPDATE product_variants
      SET
        name = COALESCE($1, name),
        sku = COALESCE($2, sku),
        slug = COALESCE($3, slug),
        description = COALESCE($4, description),
        short_description = COALESCE($5, short_description),
        price = COALESCE($6, price),
        discount_price = $7,
        cost_price = $8,
        stock_quantity = COALESCE($9, stock_quantity),
        stock_status = COALESCE($10, stock_status),
        show_price = COALESCE($11, show_price),
        weight = $12,
        length = $13,
        width = $14,
        height = $15,
        primary_image_url = COALESCE($16, primary_image_url),
        images = COALESCE($17::jsonb, images),
        videos = COALESCE($18::jsonb, videos),
        documents = COALESCE($19::jsonb, documents),
        attributes = COALESCE($20::jsonb, attributes),
        meta_title = $21,
        meta_description = $22,
        meta_keywords = $23,
        is_featured = COALESCE($24, is_featured),
        is_new = COALESCE($25, is_new),
        is_bestseller = COALESCE($26, is_bestseller),
        is_recommended = COALESCE($27, is_recommended),
        is_active = COALESCE($28, is_active),
        warranty_months = $29,
        battery_life_hours = $30,
        custom_fields = COALESCE($31::jsonb, custom_fields),
        sort_order = COALESCE($32, sort_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $33
      RETURNING *
    `
    
    const result = await pool.query(updateQuery, [
      name,
      sku,
      slug,
      description,
      short_description,
      price,
      discount_price,
      cost_price,
      stock_quantity,
      stock_status,
      show_price,
      weight,
      length,
      width,
      height,
      primary_image_url,
      JSON.stringify(cleanedImages),
      JSON.stringify(cleanedVideos),
      JSON.stringify(cleanedDocuments),
      JSON.stringify(cleanedAttributes),
      meta_title,
      meta_description,
      meta_keywords,
      is_featured,
      is_new,
      is_bestseller,
      is_recommended,
      is_active,
      warranty_months,
      battery_life_hours,
      JSON.stringify(cleanedCustomFields),
      sort_order,
      variantId
    ])
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Product variant not found'
        },
        { status: 404 }
      )
    }
    
    const _duration = Date.now() - startTime
    logger.info(`Product variant ${variantId} updated successfully`, { duration: _duration }, 'API')
    
    return NextResponse.json({
      success: true,
      data: result.rows[0],
      duration: _duration
    })
    
  } catch (error) {
    const _duration = Date.now() - startTime
    logger.error(`Error updating product variant ${variantId}`, error, 'API')
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update product variant',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: _duration
      },
      { status: 500 }
    )
  }
}

// DELETE /api/v2/product-variants/[id] - удалить вариант
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  const variantId = params.id
  
  try {
    // Hard delete: сначала удаляем зависимые записи, затем сам вариант
    await pool.query('BEGIN')

    // Удаляем упрощённые характеристики варианта, если есть
    await pool.query('DELETE FROM variant_characteristics_simple WHERE variant_id = $1', [variantId])

    // Удаляем изображения варианта
    await pool.query('DELETE FROM variant_images WHERE variant_id = $1', [variantId])

    // Удаляем ценовые уровни варианта
    await pool.query('DELETE FROM variant_price_tiers WHERE variant_id = $1', [variantId])

    // Удаляем сам вариант
    const _result = await pool.query('DELETE FROM product_variants WHERE id = $1 RETURNING id', [variantId])

    await pool.query('COMMIT')
    
    const _duration = Date.now() - startTime
    logger.info('Product variant deleted', { variantId, duration: _duration })
    
    return NextResponse.json({
      success: true,
      message: 'Product variant deleted successfully',
      duration: _duration
    })
    
  } catch (error) {
    const _duration = Date.now() - startTime
    logger.error('Error deleting product variant', error, 'API')
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete product variant',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: _duration
      },
      { status: 500 }
    )
  }
}