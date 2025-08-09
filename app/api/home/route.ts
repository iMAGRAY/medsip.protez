import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { withCache } from '@/lib/cache/cache-middleware'
import { cacheKeys, CACHE_TTL, cacheRemember } from '@/lib/cache/cache-utils'
import { logger } from '@/lib/logger'

// GET /api/home - получить данные для главной страницы
export const GET = withCache(async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nocache = searchParams.get('nocache') === 'true'

    const cacheKey = cacheKeys.homePage()
    const ttl = CACHE_TTL.MEDIUM // 30 минут для главной страницы

    const fetchHomeData = async () => {
      // Получаем популярные продукты
      const productsQuery = `
        SELECT
          p.id, p.name, p.short_name, p.description, p.sku, p.article_number, 
          p.price, p.discount_price, p.image_url, p.in_stock, 
          p.stock_quantity, p.stock_status, p.show_price,
          p.category_id, p.manufacturer_id,
          pc.name as category_name,
          m.name as manufacturer_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
        WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
          AND p.in_stock = true
        ORDER BY p.created_at DESC
        LIMIT 12
      `

      // Получаем активные категории
      const categoriesQuery = `
        SELECT
          c.id,
          c.name,
          c.description,
          c.parent_id,
          c.is_active,
          c.sort_order as display_order,
          COUNT(DISTINCT p.id) as products_count
        FROM product_categories c
        LEFT JOIN products p ON c.id = p.category_id 
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.description, c.parent_id, c.is_active, c.sort_order
        ORDER BY c.sort_order, c.name
      `

      // Получаем производителей с количеством товаров
      const manufacturersQuery = `
        SELECT
          m.id,
          m.name,
          m.logo_url,
          COUNT(DISTINCT p.id) as products_count
        FROM manufacturers m
        LEFT JOIN products p ON m.id = p.manufacturer_id 
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
        GROUP BY m.id, m.name, m.logo_url
        HAVING COUNT(DISTINCT p.id) > 0
        ORDER BY m.name
      `

      // Получаем настройки сайта
      const settingsQuery = `
        SELECT 
          site_name,
          site_description,
          hero_title,
          hero_subtitle,
          contact_email,
          contact_phone,
          address,
          social_media,
          additional_contacts
        FROM site_settings
        LIMIT 1
      `

      // Выполняем все запросы параллельно
      const [productsResult, categoriesResult, manufacturersResult, settingsResult] = await Promise.all([
        executeQuery(productsQuery),
        executeQuery(categoriesQuery),
        executeQuery(manufacturersQuery),
        executeQuery(settingsQuery)
      ])

      // Форматируем настройки сайта
      const settings = settingsResult.rows[0] || {
        site_name: 'MedSIP Prosthetics',
        site_description: null,
        hero_title: null,
        hero_subtitle: null,
        contact_email: null,
        contact_phone: null,
        address: null,
        social_media: {},
        additional_contacts: []
      }

      // Строим дерево категорий
      const categoriesMap = new Map<number, any>()
      categoriesResult.rows.forEach(cat => {
        categoriesMap.set(cat.id, { ...cat, children: [] })
      })

      const categoryTree: any[] = []
      categoriesResult.rows.forEach(cat => {
        if (cat.parent_id) {
          const parent = categoriesMap.get(cat.parent_id)
          if (parent) {
            parent.children.push(categoriesMap.get(cat.id))
          }
        } else {
          categoryTree.push(categoriesMap.get(cat.id))
        }
      })

      return {
        success: true,
        data: {
          featuredProducts: productsResult.rows,
          categories: categoryTree,
          manufacturers: manufacturersResult.rows,
          siteSettings: settings,
          stats: {
            totalProducts: productsResult.rows.length,
            totalCategories: categoriesResult.rows.length,
            totalManufacturers: manufacturersResult.rows.length
          }
        },
        cached: false
      }
    }

    // Если nocache=true, не используем кеш
    if (nocache) {
      const data = await fetchHomeData()
      return NextResponse.json(data)
    }

    // Получаем данные из кеша или выполняем запрос
    const responseData = await cacheRemember(
      cacheKey,
      ttl,
      fetchHomeData,
      'page'
    )

    // Добавляем флаг, что данные из кеша
    if (responseData && !responseData.cached) {
      responseData.cached = true
    }

    return NextResponse.json(responseData)

  } catch (error) {
    logger.error('Failed to fetch home page data:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch home page data',
        details: error.message 
      },
      { status: 500 }
    )
  }
})