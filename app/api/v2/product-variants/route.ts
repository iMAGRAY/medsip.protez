import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/v2/product-variants - получить варианты с полной информацией
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const masterId = searchParams.get('master_id')
    const variantId = searchParams.get('variant_id')
    const includeCharacteristics = searchParams.get('include_characteristics') === 'true'
    const includeImages = searchParams.get('include_images') === 'true'
    const onlyActive = searchParams.get('only_active') !== 'false'
    
    // Базовый запрос - выбираем поля напрямую из таблицы product_variants
    let query = `
      SELECT 
        pv.id,
        pv.master_id,
        pv.sku,
        pv.name,
        pv.slug,
        pv.description,
        pv.short_description,
        pv.price,
        pv.discount_price,
        pv.cost_price,
        pv.stock_quantity,
        pv.reserved_quantity,
        COALESCE(pv.stock_quantity - pv.reserved_quantity, 0) as available_stock,
        CASE 
          WHEN pv.stock_quantity > 0 AND pv.is_active THEN true
          ELSE false
        END as in_stock,
        pv.weight,
        pv.length,
        pv.width,
        pv.height,
        pv.primary_image_url,
        pv.images,
        pv.images as variant_images,
        pv.videos,
        pv.documents,
        pv.attributes,
        pv.meta_title,
        pv.meta_description,
        pv.meta_keywords,
        pv.is_featured,
        pv.is_new,
        pv.is_bestseller,
        pv.is_recommended,
        pv.is_active,
        pv.show_price,
        pv.warranty_months,
        pv.battery_life_hours,
        pv.custom_fields,
        pv.sort_order,
        pv.created_at,
        pv.updated_at,
        p.name as master_name,
        p.category_id,
        pc.name as category_name,
        p.manufacturer_id,
        m.name as manufacturer_name,
        p.series_id,
        ms.name as series_name,
        COALESCE(pv.discount_price, pv.price) as effective_price,
        COALESCE(pv.stock_quantity - pv.reserved_quantity, 0) as effective_stock
    `
    
    const conditions: string[] = []
    const params: any[] = []
    
    // Изображения уже включены в основной запрос как variant_images
    // Удаляем дублирующую логику
    
    // Если включены характеристики, добавляем
    if (includeCharacteristics) {
      query += `,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'value_id', vc.value_id,
                'value_name', cv.value,
                'group_id', cg.id,
                'group_name', cg.name,
                'additional_value', vc.additional_value,
                'color_hex', cv.color_hex
              )
            )
            FROM variant_characteristics_simple vc
            JOIN characteristics_values_simple cv ON vc.value_id = cv.id
            JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
            WHERE vc.variant_id = pv.id
          ),
          '[]'::json
        ) as characteristics
      `
    }
    
    query += `
      FROM product_variants pv
      JOIN products p ON pv.master_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      LEFT JOIN model_series ms ON p.series_id = ms.id
    `
    
    // Условия фильтрации
    if (variantId) {
      conditions.push(`pv.id = $${params.length + 1}`)
      params.push(variantId)
    }
    
    if (masterId) {
      conditions.push(`pv.master_id = $${params.length + 1}`)
      params.push(masterId)
    }
    
    if (onlyActive) {
      conditions.push('pv.is_active = true')
    }
    
    // Добавляем условие для неудаленных записей
    conditions.push('(pv.is_deleted = false OR pv.is_deleted IS NULL)')
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
    
    // Сортировка
    query += ' ORDER BY pv.sort_order, pv.id'
    
    const result = await pool.query(query, params)
    
    // Если запрашивается конкретный вариант, возвращаем объект
    if (variantId && result.rows.length > 0) {
      const duration = Date.now() - startTime
      logger.info('Product variant loaded', { variantId, duration })
      
      return NextResponse.json({
        success: true,
        data: result.rows[0],
        duration
      })
    }
    
    // Иначе возвращаем массив
    const duration = Date.now() - startTime
    logger.info('Product variants loaded', { 
      count: result.rows.length, 
      masterId, 
      duration 
    })
    
    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      duration
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Error loading product variants', error, 'API')
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to load product variants',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration
      },
      { status: 500 }
    )
  }
}

// POST /api/v2/product-variants - создать новый вариант
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()

    const {
      master_id,
      name,
      sku,
      article_number,
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
      attributes,
      warranty_months,
      battery_life_hours,
      custom_fields,
      is_featured,
      is_new,
      is_bestseller,
      is_recommended,
      sort_order,
      images
    } = body
    
    // Проверяем обязательные поля
    if (!master_id || !name) {
      return NextResponse.json(
        { 
          success: false,
          error: 'master_id and name are required' 
        },
        { status: 400 }
      )
    }

    // Требуем наличия SKU или сохраняем article_number в attributes
    if (!sku && !article_number) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either sku or article_number must be provided'
        },
        { status: 400 }
      )
    }

    // Если передан article_number, но не SKU, сохраняем article_number в attributes
    const finalAttributes = { ...attributes }
    if (article_number) {
      finalAttributes.article_number = article_number
    }
    
    // Если SKU не указан, генерируем уникальный
    let finalSku = sku
    if (!finalSku && article_number) {
      finalSku = `VAR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    }
    

    
    // Проверяем существование мастер-товара
    const masterCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND is_deleted = FALSE',
      [master_id]
    )
    
    if (masterCheck.rows.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Product not found' 
        },
        { status: 404 }
      )
    }
    
    // Генерируем slug
    const slug = await generateUniqueSlug(name)

    
    // Создаем вариант

    const result = await pool.query(`
      INSERT INTO product_variants (
        master_id, name, slug, sku, description, short_description,
        price, discount_price, cost_price, stock_quantity, stock_status, show_price,
        weight, length, width, height, attributes,
        warranty_months, battery_life_hours, custom_fields,
        is_featured, is_new, is_bestseller, is_recommended, sort_order, images
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12,
        $13, $14, $15, $16, $17::jsonb,
        $18, $19, $20::jsonb,
        $21, $22, $23, $24, $25, $26::jsonb
      ) RETURNING *, images as variant_images
    `, [
      master_id, name, slug, finalSku, description, short_description,
      price, discount_price, cost_price, stock_quantity || 0,
      stock_status || 'out_of_stock',
      show_price !== undefined ? show_price : true,
      weight, length, width, height,
      JSON.stringify(sanitizeForJson(finalAttributes && typeof finalAttributes === 'object' ? finalAttributes : {})),
      warranty_months, battery_life_hours,
      JSON.stringify(sanitizeForJson(custom_fields && typeof custom_fields === 'object' ? custom_fields : {})),
      is_featured || false, is_new || false, is_bestseller || false,
      is_recommended || false, sort_order || 0,
      JSON.stringify(Array.isArray(images) ? images : [])
    ])

    // Получаем ID только что созданного варианта
    const newVariantId = result.rows[0].id

    try {
      // Копируем все характеристики мастер-товара в таблицу упрощённых характеристик варианта
      await pool.query(
        `INSERT INTO variant_characteristics_simple (variant_id, value_id, additional_value)
         SELECT $1, value_id, additional_value
         FROM product_characteristics_simple
         WHERE product_id = $2`,
        [newVariantId, master_id]
      )
    } catch (copyError) {
      logger.error('Error copying product characteristics to variant', copyError, 'API')
      // Продолжаем выполнение, так как отсутствие характеристик не является критичной ошибкой
    }
    
    const duration = Date.now() - startTime
    logger.info('Product variant created', { 
      variantId: result.rows[0].id,
      masterId: master_id,
      duration 
    })
    
    return NextResponse.json({
      success: true,
      data: result.rows[0],
      duration
    }, { status: 201 })
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('Error creating product variant:', error)
    logger.error('Error creating product variant', error, 'API')
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create product variant',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration
      },
      { status: 500 }
    )
  }
}

// Вспомогательная функция для генерации уникального slug
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/g, '-')
    .replace(/^-+|-+$/g, '')
  
  let slug = baseSlug
  let counter = 0
  
  while (true) {
    const existing = await pool.query(
      'SELECT id FROM product_variants WHERE slug = $1',
      [slug]
    )
    
    if (existing.rows.length === 0) {
      return slug
    }
    
    counter++
    slug = `${baseSlug}-${counter}`
  }
}

// Рекурсивная функция для очистки объектов от BigInt/Function/undefined
function sanitizeForJson(input: any): any {
  if (input === null || input === undefined) return input

  if (typeof input === 'bigint') {
    return Number(input)
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeForJson)
  }

  if (typeof input === 'object') {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'function' || typeof value === 'symbol') continue
      cleaned[key] = sanitizeForJson(value)
    }
    return cleaned
  }

  return input
}