import { logger } from './logger'

export interface CacheConfig {
  ttl: number // время жизни в секундах
  prefix: string
  enableCompression?: boolean
}

// Серверная версия кеша (для API routes)
export class SecureCacheManager {
  private config: CacheConfig

  constructor(config: CacheConfig) {
    this.config = {
      enableCompression: false,
      ...config
    }
  }

  /**
   * Генерирует ключ кеша с префиксом
   */
  private generateKey(key: string): string {
    return `${this.config.prefix}:${key}`
  }

  /**
   * Сжимает данные если включено
   */
  private async compressData(data: string): Promise<string> {
    if (!this.config.enableCompression) {
      return data
    }

    // Простое сжатие для длинных строк
    if (data.length > 1000) {
      try {
        const compressed = Buffer.from(data).toString('base64')
        return `compressed:${compressed}`
      } catch (error) {
        logger.warn('Compression failed, using raw data', error)
        return data
      }
    }

    return data
  }

  /**
   * Распаковывает данные если нужно
   */
  private async decompressData(data: string): Promise<string> {
    if (data.startsWith('compressed:')) {
      try {
        const compressed = data.replace('compressed:', '')
        return Buffer.from(compressed, 'base64').toString()
      } catch (error) {
        logger.warn('Decompression failed', error)
        return data
      }
    }

    return data
  }

  /**
   * Устанавливает значение в кеш (только на сервере)
   */
  async set<T>(key: string, value: T, customTTL?: number): Promise<boolean> {
    // Проверяем что мы на сервере
    if (typeof window !== 'undefined') {
      logger.warn('Cache set called on client side, using API instead')
      return this.setViaAPI(key, value, customTTL)
    }

    try {
      // Динамический импорт Redis только на сервере
      const { redis } = await import('./redis-client')

      const cacheKey = this.generateKey(key)
      const serialized = JSON.stringify(value)
      const compressed = await this.compressData(serialized)
      const ttl = customTTL || this.config.ttl

      const success = await redis.setJson(cacheKey, { data: compressed }, ttl)

      logger.debug('Cache set', {
        key: cacheKey,
        ttl,
        size: compressed.length
      })

      return success
    } catch (_error) {
      logger.error('Cache set failed', { key, error: _error })
      return false
    }
  }

  /**
   * Получает значение из кеша (только на сервере)
   */
  async get<T>(key: string): Promise<T | null> {
    // Проверяем что мы на сервере
    if (typeof window !== 'undefined') {
      logger.warn('Cache get called on client side, using API instead')
      return this.getViaAPI<T>(key)
    }

    try {
      // Динамический импорт Redis только на сервере
      const { redis } = await import('./redis-client')

      const cacheKey = this.generateKey(key)
      const cached = await redis.getJson<{ data: string }>(cacheKey)

      if (!cached?.data) {
        return null
      }

      const decompressed = await this.decompressData(cached.data)
      const parsed = JSON.parse(decompressed)

      logger.debug('Cache hit', { key: cacheKey })

      return parsed as T
    } catch (_error) {
      logger.error('Cache get failed', { key, error: _error })
      return null
    }
  }

  /**
   * Удаляет значение из кеша (только на сервере)
   */
  async delete(key: string): Promise<boolean> {
    // Проверяем что мы на сервере
    if (typeof window !== 'undefined') {
      logger.warn('Cache delete called on client side, using API instead')
      return this.deleteViaAPI(key)
    }

    try {
      // Динамический импорт Redis только на сервере
      const { redis } = await import('./redis-client')

      const cacheKey = this.generateKey(key)
      const result = await redis.del(cacheKey)

      logger.debug('Cache delete', { key: cacheKey, deleted: result })

      return result
    } catch (_error) {
      logger.error('Cache delete failed', { key, error: _error })
      return false
    }
  }

  /**
   * Проверяет существование ключа (только на сервере)
   */
  async exists(key: string): Promise<boolean> {
    // Проверяем что мы на сервере
    if (typeof window !== 'undefined') {
      return false
    }

    try {
      // Динамический импорт Redis только на сервере
      const { redis } = await import('./redis-client')

      const cacheKey = this.generateKey(key)
      const result = await redis.exists(cacheKey)
      return result
    } catch (_error) {
      logger.error('Cache exists check failed', { key, error: _error })
      return false
    }
  }

  /**
   * Очищает весь кеш с префиксом (только на сервере)
   */
  async clear(): Promise<number> {
    // Проверяем что мы на сервере
    if (typeof window !== 'undefined') {
      return 0
    }

    try {
      // Динамический импорт Redis только на сервере
      const { redis } = await import('./redis-client')

      const pattern = `${this.config.prefix}:*`
      const deleted = await redis.flushPattern(pattern)

      logger.info('Cache cleared', {
        prefix: this.config.prefix,
        deleted
      })

      return deleted
    } catch (_error) {
      logger.error('Cache clear failed', { prefix: this.config.prefix, error: _error })
      return 0
    }
  }

  // Методы для работы через API (клиентская сторона)
  private async setViaAPI<T>(key: string, _value: T, ttl?: number): Promise<boolean> {
    try {
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set',
          key: this.generateKey(key),
          value: _value,
          ttl: ttl || this.config.ttl
        })
      })

      const result = await response.json()
      return result.success
    } catch (_error) {
      logger.error('Cache API set failed', { key, error: _error })
      return false
    }
  }

  private async getViaAPI<T>(key: string): Promise<T | null> {
    try {
      const response = await fetch(`/api/cache?key=${encodeURIComponent(this.generateKey(key))}`)

      if (!response.ok) {
        return null
      }

      const result = await response.json()
      return result.data || null
    } catch (_error) {
      logger.error('Cache API get failed', { key, error: _error })
      return null
    }
  }

  private async deleteViaAPI(key: string): Promise<boolean> {
    try {
      const response = await fetch('/api/cache', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: this.generateKey(key)
        })
      })

      const result = await response.json()
      return result.success
    } catch (_error) {
      logger.error('Cache API delete failed', { key, error: _error })
      return false
    }
  }

  /**
   * Получает статистику кеша (только на сервере)
   */
  async getStats(): Promise<{
    totalKeys: number
    memoryUsage: string
    hitRate?: number
  }> {
    if (typeof window !== 'undefined') {
      return { totalKeys: 0, memoryUsage: '0B' }
    }

    try {
      // Динамический импорт Redis только на сервере
      const { redis } = await import('./redis-client')

      const pattern = `${this.config.prefix}:*`
      const keys = await redis.keys(pattern)

      // Получаем упрощенную статистику без info команды
      const _memoryUsage = '0B' // Заглушка, так как info недоступна

      const _hitRate: number | undefined = undefined // Заглушка, так как info недоступна

      return {
        totalKeys: keys.length,
        memoryUsage: _memoryUsage,
        hitRate: _hitRate
      }
    } catch (_error) {
      logger.error('Cache stats failed', { prefix: this.config.prefix, error: _error })
      return { totalKeys: 0, memoryUsage: '0B' }
    }
  }
}

// Утилитарные функции для кеширования
export async function cacheWithRefresh<T>(
  key: string,
  fetcher: () => Promise<T>,
  cacheManager: SecureCacheManager,
  ttl?: number
): Promise<T> {
  try {
    // Пытаемся получить из кеша
    const cached = await cacheManager.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Если нет в кеше, получаем данные
    const data = await fetcher()

    // Сохраняем в кеш
    await cacheManager.set(key, data, ttl)

    return data
  } catch (_error) {
    logger.error('Cache with refresh failed', { key, error: _error })
    // В случае ошибки кеша возвращаем данные напрямую
    return await fetcher()
  }
}

export async function invalidateRelated(patterns: string[]): Promise<void> {
  if (typeof window !== 'undefined') {
    return
  }

  try {
    // Динамический импорт Redis только на сервере
    const { redis } = await import('./redis-client')

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        // Удаляем ключи по одному, так как spread оператор не поддерживается
        for (const key of keys) {
          await redis.del(key)
        }
        logger.info('Invalidated cache pattern', { pattern, keys: keys.length })
      }
    }
  } catch (_error) {
    logger.error('Cache invalidation failed', { patterns, error: _error })
  }
}

export async function warmupCache(
  warmupTasks: Array<{
    key: string
    fetcher: () => Promise<any>
    cacheManager: SecureCacheManager
    ttl?: number
  }>
): Promise<void> {
  if (typeof window !== 'undefined') {
    return
  }

  try {
    await Promise.all(
      warmupTasks.map(async ({ key, fetcher, cacheManager, ttl }) => {
        try {
          const data = await fetcher()
          await cacheManager.set(key, data, ttl)
          logger.debug('Cache warmed up', { key })
        } catch (_error) {
          logger.error('Cache warmup failed for key', { key, error: _error })
        }
      })
    )
  } catch (error) {
    logger.error('Cache warmup failed', error)
  }
}

// Предустановленные кеш-менеджеры
export const userDataCache = new SecureCacheManager({
  prefix: 'user_data',
  ttl: 3600, // 1 час
  enableCompression: true
})

export const apiCache = new SecureCacheManager({
  prefix: 'api_cache',
  ttl: 300, // 5 минут
  enableCompression: false
})

export const mediaCache = new SecureCacheManager({
  prefix: 'media_cache',
  ttl: 1800, // 30 минут
  enableCompression: true
})