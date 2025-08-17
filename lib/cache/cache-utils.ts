import { apiCache, productCache, categoryCache, pageCache, mediaCache } from '@/lib/redis-client'
import { logger } from '@/lib/logger'

// Время жизни кеша в секундах
export const CACHE_TTL = {
  SHORT: 300,      // 5 минут - для часто меняющихся данных
  MEDIUM: 1800,    // 30 минут - для обычных данных
  LONG: 3600,      // 1 час - для редко меняющихся данных
  DAILY: 86400,    // 24 часа - для статичных данных
  WEEKLY: 604800,  // 7 дней - для очень статичных данных
}

// Версия кеша для инвалидации при изменении структуры
const CACHE_VERSION = 'v5' // Changed to v5 to clear all cached data

// Генерация ключей кеша
export const cacheKeys = {
  // Продукты
  product: (id: number) => `product:${CACHE_VERSION}:${id}`,
  productList: (params: any) => `products:${CACHE_VERSION}:${JSON.stringify(params)}`,
  productVariants: (productId: number) => `product-variants:${CACHE_VERSION}:${productId}`,
  productCharacteristics: (productId: number) => `product-chars:${CACHE_VERSION}:${productId}`,
  productImages: (productId: number) => `product-images:${CACHE_VERSION}:${productId}`,
  
  // Категории
  category: (id: number) => `category:${CACHE_VERSION}:${id}`,
  categoryList: () => `categories:${CACHE_VERSION}:all`,
  categoryTree: () => `categories:${CACHE_VERSION}:tree`,
  categoryProducts: (categoryId: number, page: number = 1) => `category-products:${CACHE_VERSION}:${categoryId}:${page}`,
  
  // Характеристики
  characteristics: () => `characteristics:${CACHE_VERSION}:all`,
  characteristicsByCategory: (categoryId: number) => `characteristics:${CACHE_VERSION}:category:${categoryId}`,
  characteristicGroups: () => `characteristic-groups:${CACHE_VERSION}:all`,
  
  // Страницы
  homePage: () => `page:${CACHE_VERSION}:home`,
  productPage: (id: number) => `page:${CACHE_VERSION}:product:${id}`,
  categoryPage: (id: number, page: number = 1) => `page:${CACHE_VERSION}:category:${id}:${page}`,
  
  // Медиа
  mediaFile: (id: number) => `media:${CACHE_VERSION}:${id}`,
  mediaUrl: (url: string) => `media:${CACHE_VERSION}:url:${Buffer.from(url).toString('base64')}`,
  
  // Поиск
  searchResults: (query: string, page: number = 1) => `search:${CACHE_VERSION}:${query}:${page}`,
  
  // Статистика
  productStats: (id: number) => `stats:${CACHE_VERSION}:product:${id}`,
  categoryStats: (id: number) => `stats:${CACHE_VERSION}:category:${id}`,
}

// Паттерны для инвалидации кеша
export const cachePatterns = {
  allProducts: `product*:${CACHE_VERSION}:*`,
  product: (id: number) => `product*:${CACHE_VERSION}:*${id}*`,
  allCategories: `categor*:${CACHE_VERSION}:*`,
  category: (id: number) => `category*:${CACHE_VERSION}:*${id}*`,
  allCharacteristics: `characteristic*:${CACHE_VERSION}:*`,
  allPages: `page:${CACHE_VERSION}:*`,
  allMedia: `media:${CACHE_VERSION}:*`,
  all: `*:${CACHE_VERSION}:*`
}

// Декоратор для кеширования функций
export function cached<T extends (...args: any[]) => Promise<any>>(
  cacheKeyFn: (...args: Parameters<T>) => string,
  ttl: number = CACHE_TTL.MEDIUM,
  cacheType: 'api' | 'product' | 'category' | 'page' | 'media' = 'api'
) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: Parameters<T>): Promise<ReturnType<T>> {
      const cacheKey = cacheKeyFn(...args)
      
      // Выбираем нужный кеш
      const cache = {
        api: apiCache,
        product: productCache,
        category: categoryCache,
        page: pageCache,
        media: mediaCache
      }[cacheType]

      try {
        // Пробуем получить из кеша
        const cached = await cache.get(cacheKey)
        if (cached !== null) {
          logger.debug(`Cache hit: ${cacheKey}`)
          return cached
        }
      } catch (error) {
        logger.error('Cache get error:', error)
      }

      // Если нет в кеше, выполняем оригинальный метод
      const result = await originalMethod.apply(this, args)
      
      // Сохраняем в кеш
      try {
        await cache.set(cacheKey, result, ttl)
        logger.debug(`Cache set: ${cacheKey}, TTL: ${ttl}s`)
      } catch (error) {
        logger.error('Cache set error:', error)
      }

      return result
    }

    return descriptor
  }
}

// Функция для кеширования с использованием remember паттерна
export async function cacheRemember<T>(
  key: string,
  ttl: number,
  callback: () => Promise<T>,
  cacheType: 'api' | 'product' | 'category' | 'page' | 'media' = 'api'
): Promise<T> {
  const cache = {
    api: apiCache,
    product: productCache,
    category: categoryCache,
    page: pageCache,
    media: mediaCache
  }[cacheType]

  return cache.remember(key, callback, ttl)
}

// Инвалидация кеша
export async function invalidateCache(patterns: string | string[]): Promise<number> {
  const patternsArray = Array.isArray(patterns) ? patterns : [patterns]
  let totalDeleted = 0

  for (const pattern of patternsArray) {
    try {
      // Импортируем redisClient только когда нужно
      const { redisClient } = await import('@/lib/redis-client')
      const deleted = await redisClient.flushPattern(pattern)
      totalDeleted += deleted
      logger.info(`Cache invalidated: ${pattern}, deleted: ${deleted}`)
    } catch (error) {
      logger.error('Cache invalidation error:', error)
    }
  }

  return totalDeleted
}

// Прогрев кеша
export async function warmupCache(items: Array<{ key: string; loader: () => Promise<any>; ttl?: number }>) {
  const results = await Promise.allSettled(
    items.map(async ({ key, loader, ttl = CACHE_TTL.MEDIUM }) => {
      try {
        const data = await loader()
        await apiCache.set(key, data, ttl)
        return { key, status: 'success' }
      } catch (error) {
        logger.error(`Cache warmup failed for ${key}:`, error)
        return { key, status: 'failed', error }
      }
    })
  )

  const success = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length
  const failed = results.length - success

  logger.info(`Cache warmup completed: ${success} success, ${failed} failed`)
  return { success, failed, total: results.length }
}

// Мониторинг кеша
export async function getCacheStats() {
  const { redisClient } = await import('@/lib/redis-client')
  
  const stats = {
    connected: await redisClient.ping(),
    keys: {
      api: (await redisClient.keys('api:*')).length,
      product: (await redisClient.keys('product:*')).length,
      category: (await redisClient.keys('category:*')).length,
      page: (await redisClient.keys('page:*')).length,
      media: (await redisClient.keys('media:*')).length,
      total: 0
    },
    memory: null as any
  }

  stats.keys.total = Object.values(stats.keys).reduce((sum: number, count) => 
    typeof count === 'number' ? sum + count : sum, 0
  )

  try {
    // Получаем информацию о памяти (если доступно)
    // Примечание: метод info может быть недоступен в некоторых конфигурациях Redis
    stats.memory = {
      used: 'N/A' // Заглушка, так как client является private
    }
  } catch (_error) {
    // Игнорируем ошибки получения информации о памяти
  }

  return stats
}