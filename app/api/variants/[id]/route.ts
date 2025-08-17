import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const variantId = parseInt(id)
    
    if (isNaN(variantId)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный ID варианта'
      }, { status: 400 })
    }
    
    // Получаем детальную информацию о варианте
    const result = await pool.query(`
      SELECT 
        v.id,
        v.master_id,
        v.name,
        v.slug,
        v.sku,
        v.description,
        v.short_description,
        v.price,
        v.price_override,
        v.discount_price,
        v.cost_price,
        v.stock_quantity,
        v.stock_override,
        v.stock_status,
        v.reserved_quantity,
        v.min_stock_level,
        v.max_stock_level,
        v.weight,
        v.length,
        v.width,
        v.height,
        v.primary_image_url,
        v.images,
        v.videos,
        v.documents,
        v.attributes,
        v.attributes_json,
        v.specifications,
        v.dimensions,
        v.size_name,
        v.size_value,
        v.meta_title,
        v.meta_description,
        v.meta_keywords,
        v.is_featured,
        v.is_new,
        v.is_bestseller,
        v.is_recommended,
        v.warranty_months,
        v.battery_life_hours,
        v.custom_fields,
        v.is_active,
        v.show_price,
        v.sort_order,
        v.created_at,
        v.updated_at,
        p.name as master_name,
        p.category_id,
        p.manufacturer_id,
        c.name as category_name,
        m.name as manufacturer_name
      FROM product_variants v
      LEFT JOIN products p ON v.master_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE v.id = $1
        AND (v.is_deleted = false OR v.is_deleted IS NULL)
    `, [variantId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Вариант не найден'
      }, { status: 404 })
    }
    
    const variant = result.rows[0]
    
    // Форматируем данные
    const formattedVariant = {
      id: variant.id,
      master_id: variant.master_id,
      masterName: variant.master_name,
      name: variant.name,
      slug: variant.slug,
      sku: variant.sku,
      description: variant.description,
      shortDescription: variant.short_description,
      price: variant.price_override || variant.price,
      originalPrice: variant.price,
      priceOverride: variant.price_override,
      discountPrice: variant.discount_price,
      costPrice: variant.cost_price,
      stockQuantity: variant.stock_override !== null ? variant.stock_override : variant.stock_quantity,
      stockOverride: variant.stock_override,
      stockStatus: variant.stock_status,
      reservedQuantity: variant.reserved_quantity,
      minStockLevel: variant.min_stock_level,
      maxStockLevel: variant.max_stock_level,
      weight: variant.weight,
      dimensions: {
        length: variant.length,
        width: variant.width,
        height: variant.height
      },
      primaryImageUrl: variant.primary_image_url,
      images: variant.images || [],
      videos: variant.videos || [],
      documents: variant.documents || [],
      attributes: variant.attributes || variant.attributes_json || {},
      specifications: variant.specifications || {},
      sizeName: variant.size_name,
      sizeValue: variant.size_value,
      meta: {
        title: variant.meta_title,
        description: variant.meta_description,
        keywords: variant.meta_keywords
      },
      flags: {
        isFeatured: variant.is_featured,
        isNew: variant.is_new,
        isBestseller: variant.is_bestseller,
        isRecommended: variant.is_recommended,
        isActive: variant.is_active,
        showPrice: variant.show_price
      },
      warrantyMonths: variant.warranty_months,
      batteryLifeHours: variant.battery_life_hours,
      customFields: variant.custom_fields || {},
      sortOrder: variant.sort_order,
      categoryId: variant.category_id,
      categoryName: variant.category_name,
      manufacturerId: variant.manufacturer_id,
      manufacturerName: variant.manufacturer_name,
      createdAt: variant.created_at,
      updatedAt: variant.updated_at
    }
    
    return NextResponse.json({
      success: true,
      data: formattedVariant
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения деталей варианта'
    }, { status: 500 })
  }
}