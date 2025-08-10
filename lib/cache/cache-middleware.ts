import { NextRequest, NextResponse } from 'next/server'
import { apiCache } from '@/lib/redis-client'
import { CACHE_TTL } from './cache-utils'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

// Конфигурация кеширования для разных роутов
const CACHE_CONFIG: Record<string, { ttl: number; methods: string[] }> = {
  // Продукты - кешируем GET запросы
  '/api/products': { ttl: CACHE_TTL.MEDIUM, methods: ['GET'] },
  '/api/products/[id]': { ttl: CACHE_TTL.LONG, methods: ['GET'] },
  '/api/products/[id]/characteristics': { ttl: CACHE_TTL.LONG, methods: ['GET'] },
  '/api/products/[id]/variants': { ttl: CACHE_TTL.LONG, methods: ['GET'] },
  
  // Категории - кешируем надолго
  '/api/categories': { ttl: CACHE_TTL.DAILY, methods: ['GET'] },
  '/api/categories/[id]': { ttl: CACHE_TTL.DAILY, methods: ['GET'] },
  '/api/categories/tree': { ttl: CACHE_TTL.DAILY, methods: ['GET'] },
  
  // Характеристики
  '/api/characteristics': { ttl: CACHE_TTL.LONG, methods: ['GET'] },
  '/api/characteristics/by-category': { ttl: CACHE_TTL.LONG, methods: ['GET'] },
  '/api/characteristic-groups': { ttl: CACHE_TTL.DAILY, methods: ['GET'] },
  
  // Медиа
  '/api/media/[id]': { ttl: CACHE_TTL.WEEKLY, methods: ['GET'] },
  '/api/product-images': { ttl: CACHE_TTL.LONG, methods: ['GET'] },
  
  // Поиск - короткий кеш
  '/api/search': { ttl: CACHE_TTL.SHORT, methods: ['GET'] },
  
  // Статистика
  '/api/stats/products': { ttl: CACHE_TTL.MEDIUM, methods: ['GET'] },
  '/api/stats/categories': { ttl: CACHE_TTL.MEDIUM, methods: ['GET'] },
}

// Роуты, которые не нужно кешировать
const SKIP_CACHE_ROUTES = [
  '/api/auth',
  '/api/admin',
  '/api/cart',
  '/api/orders',
  '/api/user',
  '/api/redis-status',
  '/api/cleanup',
]

// Генерация ключа кеша из запроса
function generateCacheKey(request: NextRequest): string {
  const url = new URL(request.url)
  const pathname = url.pathname
  const searchParams = url.searchParams.toString()
  const method = request.method
  
  // Создаем уникальный ключ на основе URL и параметров
  const keyData = `${method}:${pathname}:${searchParams}`
  const hash = crypto.createHash('md5').update(keyData).digest('hex')
  
  return `api:${hash}`
}

// Проверка, нужно ли кешировать этот роут
function shouldCache(pathname: string, method: string): { cache: boolean; config?: typeof CACHE_CONFIG[string] } {
  // Проверяем skip-список
  if (SKIP_CACHE_ROUTES.some(route => pathname.startsWith(route))) {
    return { cache: false }
  }
  
  // Проверяем конфигурацию кеша
  for (const [route, config] of Object.entries(CACHE_CONFIG)) {
    // Простое сопоставление роутов (можно улучшить с помощью path-to-regexp)
    const routePattern = route.replace(/\[([^\]]+)\]/g, '([^/]+)')
    const regex = new RegExp(`^${routePattern}$`)
    
    if (regex.test(pathname) && config.methods.includes(method)) {
      return { cache: true, config }
    }
  }
  
  return { cache: false }
}

// Middleware для кеширования API
export async function cacheMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const pathname = new URL(request.url).pathname
  const method = request.method
  
  // Проверяем, нужно ли кешировать
  const { cache, config } = shouldCache(pathname, method)
  
  if (!cache || !config) {
    // Не кешируем, выполняем обычный обработчик
    return handler()
  }
  
  const cacheKey = generateCacheKey(request)
  
  try {
    // Пробуем получить из кеша
    const cached = await apiCache.get<{ data: any; headers: Record<string, string> }>(cacheKey)
    
    if (cached) {
      logger.debug(`API Cache hit: ${pathname}`)
      
      // Возвращаем закешированный ответ
      const response = NextResponse.json(cached.data)
      
      // Восстанавливаем заголовки
      Object.entries(cached.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      // Добавляем заголовок, что это из кеша
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Cache-TTL', config.ttl.toString())
      
      return response
    }
  } catch (error) {
    logger.error('Cache middleware get error:', error)
  }
  
  // Выполняем обработчик
  const response = await handler()
  
  // Кешируем только успешные ответы
  if (response.status === 200) {
    try {
      // Клонируем ответ для чтения
      const responseClone = response.clone()
      const _data = await responseClone.json()
      
      // Сохраняем важные заголовки
      const headers: Record<string, string> = {}
      const headersToCache = ['content-type', 'cache-control', 'etag']
      headersToCache.forEach(header => {
        const value = response.headers.get(header)
        if (value) headers[header] = value
      })
      
      // Сохраняем в кеш
      await apiCache.set(cacheKey, { data, headers }, config.ttl)
      logger.debug(`API Cache set: ${pathname}, TTL: ${config.ttl}s`)
      
      // Добавляем заголовок
      response.headers.set('X-Cache', 'MISS')
      response.headers.set('X-Cache-TTL', config.ttl.toString())
    } catch (error) {
      logger.error('Cache middleware set error:', error)
    }
  }
  
  return response
}

// Функция для обертывания API handlers
export function withCache<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  ttl?: number
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as NextRequest
    
    // Если указан кастомный TTL, используем его
    if (ttl) {
      const pathname = new URL(request.url).pathname
      CACHE_CONFIG[pathname] = { ttl, methods: ['GET'] }
    }
    
    return cacheMiddleware(request, () => handler(...args))
  }) as T
}

// Hook для инвалидации кеша при мутациях
export async function invalidateApiCache(patterns: string[]) {
  const { redisClient } = await import('@/lib/redis-client')
  let totalInvalidated = 0
  
  for (const pattern of patterns) {
    try {
      const invalidated = await redisClient.flushPattern(`api:*${pattern}*`)
      totalInvalidated += invalidated
      logger.info(`API cache invalidated: ${pattern}, count: ${invalidated}`)
    } catch (error) {
      logger.error('API cache invalidation error:', error)
    }
  }
  
  return totalInvalidated
}