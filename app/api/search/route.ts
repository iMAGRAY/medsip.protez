import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { withCache } from '@/lib/cache/cache-middleware'
import { cacheKeys, CACHE_TTL, cacheRemember } from '@/lib/cache/cache-utils'
import { logger } from '@/lib/logger'

// GET /api/search - поиск продуктов
export const GET = withCache(async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const nocache = searchParams.get('nocache') === 'true'

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      })
    }

    const cacheKey = cacheKeys.searchResults(query, page)
    const ttl = CACHE_TTL.SHORT // 5 минут для результатов поиска

    const performSearch = async () => {
      const offset = (page - 1) * limit
      const searchPattern = `%${query}%`

      // Основной поисковый запрос
      const searchQuery = `
        WITH search_results AS (
          SELECT
            p.id, p.name, p.short_name, p.description, p.sku, p.article_number,
            p.price, p.discount_price, p.image_url, p.in_stock,
            p.stock_quantity, p.stock_status, p.show_price,
            p.category_id, p.manufacturer_id,
            pc.name as category_name,
            m.name as manufacturer_name,
            -- Расчет релевантности
            CASE
              WHEN LOWER(p.name) = LOWER($1) THEN 100
              WHEN LOWER(p.name) LIKE LOWER($2) THEN 90
              WHEN LOWER(p.short_name) = LOWER($1) THEN 85
              WHEN LOWER(p.short_name) LIKE LOWER($2) THEN 80
              WHEN LOWER(p.sku) = LOWER($1) THEN 75
              WHEN LOWER(p.article_number) = LOWER($1) THEN 70
              WHEN LOWER(p.description) LIKE LOWER($2) THEN 60
              WHEN LOWER(m.name) LIKE LOWER($2) THEN 50
              WHEN LOWER(pc.name) LIKE LOWER($2) THEN 40
              ELSE 30
            END as relevance
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
          WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
            AND (
              LOWER(p.name) LIKE LOWER($2)
              OR LOWER(p.short_name) LIKE LOWER($2)
              OR LOWER(p.sku) LIKE LOWER($2)
              OR LOWER(p.article_number) LIKE LOWER($2)
              OR LOWER(p.description) LIKE LOWER($2)
              OR LOWER(m.name) LIKE LOWER($2)
              OR LOWER(pc.name) LIKE LOWER($2)
            )
        ),
        counted AS (
          SELECT COUNT(*) as total FROM search_results
        )
        SELECT 
          sr.*,
          c.total
        FROM search_results sr
        CROSS JOIN counted c
        ORDER BY sr.relevance DESC, sr.name
        LIMIT $3 OFFSET $4
      `

      const result = await executeQuery(searchQuery, [query, searchPattern, limit, offset])
      
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total) : 0
      const totalPages = Math.ceil(total / limit)

      // Убираем поле total из результатов
      const products = result.rows.map(row => {
        const { total: _total, ...product } = row
        return product
      })

      // Логируем результаты поиска для аналитики
      logger.info('Search performed', {
        query,
        resultsCount: products.length,
        page,
        totalResults: total
      })

      return {
        success: true,
        data: products,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        query
      }
    }

    // Если nocache=true, не используем кеш
    if (nocache) {
      const data = await performSearch()
      return NextResponse.json(data)
    }

    // Получаем данные из кеша или выполняем поиск
    const responseData = await cacheRemember(
      cacheKey,
      ttl,
      performSearch,
      'api'
    )

    return NextResponse.json(responseData)

  } catch (error) {
    logger.error('Search failed:', error)
    return NextResponse.json(
      { 
        error: 'Search failed',
        details: error.message 
      },
      { status: 500 }
    )
  }
})