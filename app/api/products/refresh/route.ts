import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'
import { getCacheManager } from '@/lib/dependency-injection'
import { invalidateRelated } from '@/lib/cache-manager'

export async function POST(request: NextRequest) {
  const cacheManager = getCacheManager();

  try {
    logger.info('Forcing products cache refresh')

    // Принудительно очищаем все кэши продуктов
    try {
      // Очищаем кэш продуктов через Redis
      await invalidateRelated([
        'medsip:products:*',
        'products:*',
        'product:*',
        'products-fast:*',
        'products-full:*',
        'products-detailed:*',
        'products-basic:*'
      ])

      // Очищаем кэш через cache manager
      await cacheManager.clear()

      // Принудительно очищаем Redis кэш продуктов
      try {
        const { redisClient } = await import('@/lib/redis-client')
        await redisClient.flushPattern('products-*')
        await redisClient.flushPattern('product-*')
        await redisClient.flushPattern('medsip:products-*')
        logger.info('Redis cache cleared for products')
      } catch (redisError) {
        logger.warn('Failed to clear Redis cache', { error: redisError.message })
      }

      logger.info('Cache cleared successfully')
    } catch (cacheError) {
      logger.warn('Failed to clear cache', { error: cacheError.message })
    }

    // Получаем актуальный список продуктов
    const query = `
      SELECT
        p.*,
        ms.name as model_line_name,
        m.name as manufacturer_name,
        pc.name as category_name
      FROM products p
      LEFT JOIN model_series ms ON p.series_id = ms.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
      ORDER BY p.created_at DESC
    `;

    const result = await executeQuery(query);

    const responseData = {
      success: true,
      count: result.rows.length,
      data: result.rows,
      cache_refreshed: true
    };

    // Кэшируем обновленные данные
    const cacheKey = 'products:refresh:latest';
    cacheManager.set(cacheKey, responseData, 5 * 60 * 1000); // 5 минут

    logger.info('Products refreshed successfully', { count: result.rows.length });

    return NextResponse.json(responseData);

  } catch (error) {
    logger.error('Failed to refresh products:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh products',
        message: error.message
      },
      { status: 500 }
    );
  }
}