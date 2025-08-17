import { NextRequest, NextResponse } from 'next/server'
import { redisClient, apiCache, pageCache, mediaCache, productCache, categoryCache } from '@/lib/redis-client'

// GET /api/redis-status - Получить статус Redis и информацию о кешах
export async function GET(_request: NextRequest) {
  try {
    const startTime = Date.now()

    // Проверяем подключение к Redis
    const connectionStatus = redisClient.getConnectionStatus()
    const isConnected = await redisClient.ping()

    // Получаем информацию о всех кешах
    const cacheInfo = {
      api: {
        keys: await redisClient.keys('api:*'),
        count: (await redisClient.keys('api:*')).length
      },
      page: {
        keys: await redisClient.keys('page:*'),
        count: (await redisClient.keys('page:*')).length
      },
      media: {
        keys: await redisClient.keys('media:*'),
        count: (await redisClient.keys('media:*')).length
      },
      product: {
        keys: await redisClient.keys('product:*'),
        count: (await redisClient.keys('product:*')).length
      },
      category: {
        keys: await redisClient.keys('category:*'),
        count: (await redisClient.keys('category:*')).length
      }
    }

    // Общая статистика
    const totalKeys = Object.values(cacheInfo).reduce((sum, cache) => sum + cache.count, 0)

    // Получаем примеры TTL для каждого типа кеша
    const ttlInfo = {
      api: cacheInfo.api.keys.length > 0 ? await redisClient.ttl(cacheInfo.api.keys[0]) : -1,
      page: cacheInfo.page.keys.length > 0 ? await redisClient.ttl(cacheInfo.page.keys[0]) : -1,
      media: cacheInfo.media.keys.length > 0 ? await redisClient.ttl(cacheInfo.media.keys[0]) : -1,
      product: cacheInfo.product.keys.length > 0 ? await redisClient.ttl(cacheInfo.product.keys[0]) : -1,
      category: cacheInfo.category.keys.length > 0 ? await redisClient.ttl(cacheInfo.category.keys[0]) : -1
    }

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      redis: {
        connected: isConnected,
        connection_status: connectionStatus,
        response_time_ms: responseTime
      },
      cache_stats: {
        total_keys: totalKeys,
        by_prefix: cacheInfo,
        ttl_samples: ttlInfo
      },
      operations: [
        'GET /api/redis-status - Получить статус',
        'POST /api/redis-status - Управление кешем',
        'DELETE /api/redis-status - Очистить кеш'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения статуса Redis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/redis-status - Управление кешированием
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, cache_type, key, data, ttl } = body

    switch (action) {
      case 'set':
        if (!cache_type || !key || data === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Требуются параметры: cache_type, key, data'
          }, { status: 400 })
        }

        let cache
        switch (cache_type) {
          case 'api': cache = apiCache; break
          case 'page': cache = pageCache; break
          case 'media': cache = mediaCache; break
          case 'product': cache = productCache; break
          case 'category': cache = categoryCache; break
          default:
            return NextResponse.json({
              success: false,
              error: 'Неизвестный тип кеша'
            }, { status: 400 })
        }

        const setResult = await cache.set(key, data, ttl || 300)
        return NextResponse.json({
          success: true,
          action: 'set',
          cache_type,
          key,
          ttl: ttl || 300,
          result: setResult
        })

      case 'get':
        if (!cache_type || !key) {
          return NextResponse.json({
            success: false,
            error: 'Требуются параметры: cache_type, key'
          }, { status: 400 })
        }

        let getCache
        switch (cache_type) {
          case 'api': getCache = apiCache; break
          case 'page': getCache = pageCache; break
          case 'media': getCache = mediaCache; break
          case 'product': getCache = productCache; break
          case 'category': getCache = categoryCache; break
          default:
            return NextResponse.json({
              success: false,
              error: 'Неизвестный тип кеша'
            }, { status: 400 })
        }

        const cachedData = await getCache.get(key)
        return NextResponse.json({
          success: true,
          action: 'get',
          cache_type,
          key,
          exists: cachedData !== null,
          data: cachedData
        })

      case 'ping':
        const pingResult = await redisClient.ping()
        return NextResponse.json({
          success: true,
          action: 'ping',
          result: pingResult
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Неизвестное действие. Доступные: set, get, ping'
        }, { status: 400 })
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка выполнения операции Redis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE /api/redis-status - Очистить кеш
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cacheType = searchParams.get('cache_type')
    const pattern = searchParams.get('pattern')

    if (cacheType === 'all') {
      // Очищаем все кеши
      const results = await Promise.all([
        apiCache.flush(),
        pageCache.flush(),
        mediaCache.flush(),
        productCache.flush(),
        categoryCache.flush()
      ])

      const totalDeleted = results.reduce((sum, count) => sum + count, 0)

      return NextResponse.json({
        success: true,
        action: 'flush_all',
        deleted_keys: totalDeleted,
        caches_cleared: ['api', 'page', 'media', 'product', 'category']
      })
    }

    if (pattern) {
      // Очищаем по паттерну
      const deleted = await redisClient.flushPattern(pattern)
      return NextResponse.json({
        success: true,
        action: 'flush_pattern',
        pattern,
        deleted_keys: deleted
      })
    }

    if (cacheType) {
      // Очищаем конкретный тип кеша
      let cache
      switch (cacheType) {
        case 'api': cache = apiCache; break
        case 'page': cache = pageCache; break
        case 'media': cache = mediaCache; break
        case 'product': cache = productCache; break
        case 'category': cache = categoryCache; break
        default:
          return NextResponse.json({
            success: false,
            error: 'Неизвестный тип кеша'
          }, { status: 400 })
      }

      const deleted = await cache.flush()
      return NextResponse.json({
        success: true,
        action: 'flush_cache_type',
        cache_type: cacheType,
        deleted_keys: deleted
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Требуется параметр cache_type, pattern или cache_type=all'
    }, { status: 400 })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка очистки кеша Redis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
