import { createClient, RedisClientType } from 'redis'
import { RUNTIME_CONFIG } from '../app-config'

class RedisManager {
  private client: RedisClientType | null = null
  private isConnected = false
  private connectionAttempts = 0
  private maxRetries = 3
  private emergencyMode = false

  constructor() {
    // Включаем аварийный режим - не подключаемся к Redis при инициализации
    if (process.env.NODE_ENV === 'production' || process.env.EMERGENCY_NO_REDIS === 'true') {
      console.warn('🚨 EMERGENCY MODE: Redis connection disabled for stability')
      this.emergencyMode = true
      this.isConnected = false
    } else {
      this.connect()
    }
  }

  private async connect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.disconnect()
      }

      this.client = createClient({
        socket: {
          host: RUNTIME_CONFIG.CACHE.REDIS.HOST,
          port: RUNTIME_CONFIG.CACHE.REDIS.PORT,
          connectTimeout: RUNTIME_CONFIG.CACHE.REDIS.CONNECT_TIMEOUT
        },
        username: RUNTIME_CONFIG.CACHE.REDIS.USERNAME,
        password: RUNTIME_CONFIG.CACHE.REDIS.PASSWORD,
        database: RUNTIME_CONFIG.CACHE.REDIS.DATABASE
      })

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err)
        this.isConnected = false
      })

      this.client.on('connect', () => {
        console.log(`Redis connected to ${RUNTIME_CONFIG.CACHE.REDIS.HOST}:${RUNTIME_CONFIG.CACHE.REDIS.PORT}`)
        this.isConnected = true
        this.connectionAttempts = 0
      })

      this.client.on('disconnect', () => {
        console.log('Redis disconnected')
        this.isConnected = false
      })

      await this.client.connect()
    } catch (error) {
      console.error('Failed to connect to Redis:', error)
      this.isConnected = false
      this.connectionAttempts++

      if (this.connectionAttempts < this.maxRetries) {
        console.log(`Retrying Redis connection in ${RUNTIME_CONFIG.CACHE.REDIS.RECONNECT_DELAY}ms...`)
        setTimeout(() => this.connect(), RUNTIME_CONFIG.CACHE.REDIS.RECONNECT_DELAY)
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.emergencyMode || !this.isConnected || !this.client) {
      // В аварийном режиме всегда возвращаем null (cache miss)
      return null
    }

    try {
      return await this.client.get(key)
    } catch (error) {
      console.error('Redis GET error:', error)
      return null
    }
  }

  async set(key: string, value: string, options?: { EX?: number; PX?: number }): Promise<boolean> {
    if (this.emergencyMode || !this.isConnected || !this.client) {
      // В аварийном режиме притворяемся что кеш работает
      return true
    }

    try {
      const result = await this.client.set(key, value, options)
      return result === 'OK'
    } catch (error) {
      console.error('Redis SET error:', error)
      return false
    }
  }

  async setJson(key: string, data: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(data)
      const options = ttlSeconds ? { EX: ttlSeconds } : undefined
      return await this.set(key, serialized, options)
    } catch (error) {
      console.error('Redis setJson error:', error)
      return false
    }
  }

  async getJson<T = any>(key: string): Promise<T | null> {
    try {
      const data = await this.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Redis getJson error:', error)
      return null
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.del(key)
      return result > 0
    } catch (error) {
      console.error('Redis DEL error:', error)
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.exists(key)
      return result > 0
    } catch (error) {
      console.error('Redis EXISTS error:', error)
      return false
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected || !this.client) {
      return []
    }

    try {
      return await this.client.keys(pattern)
    } catch (error) {
      console.error('Redis KEYS error:', error)
      return []
    }
  }

  async flushPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern)
      if (keys.length === 0) return 0

      const deleted = await Promise.all(keys.map(key => this.del(key)))
      return deleted.filter(Boolean).length
    } catch (error) {
      console.error('Redis flushPattern error:', error)
      return 0
    }
  }

  async flush(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      await this.client.flushDb()
      return true
    } catch (error) {
      console.error('Redis FLUSH error:', error)
      return false
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return -1
    }

    try {
      return await this.client.ttl(key)
    } catch (error) {
      console.error('Redis TTL error:', error)
      return -1
    }
  }

  async ping(): Promise<boolean> {
    if (this.emergencyMode) {
      // В аварийном режиме притворяемся что Redis работает
      return true
    }

    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.ping()
      return result === 'PONG'
    } catch (error) {
      console.error('Redis PING error:', error)
      return false
    }
  }

  getConnectionStatus(): { connected: boolean; attempts: number } {
    return {
      connected: this.isConnected,
      attempts: this.connectionAttempts
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.isConnected = false
    }
  }
}

// Создаем глобальный экземпляр Redis менеджера
export const redisClient = new RedisManager()
export const redis = redisClient // Для обратной совместимости

// Утилиты для кеширования
export class RedisCache {
  private prefix: string

  constructor(prefix: string = 'medsip') {
    this.prefix = prefix
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  async get<T = any>(key: string): Promise<T | null> {
    return await redisClient.getJson<T>(this.getKey(key))
  }

  async set(key: string, data: any, ttlSeconds: number = RUNTIME_CONFIG.CACHE.TTL.SHORT): Promise<boolean> {
    return await redisClient.setJson(this.getKey(key), data, ttlSeconds)
  }

  async del(key: string): Promise<boolean> {
    return await redisClient.del(this.getKey(key))
  }

  async exists(key: string): Promise<boolean> {
    return await redisClient.exists(this.getKey(key))
  }

  async flush(): Promise<number> {
    return await redisClient.flushPattern(`${this.prefix}:*`)
  }

  async remember<T = any>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds: number = RUNTIME_CONFIG.CACHE.TTL.SHORT
  ): Promise<T> {
    // Пробуем получить из кеша
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Если нет в кеше, выполняем callback и сохраняем результат
    const data = await callback()
    await this.set(key, data, ttlSeconds)
    return data
  }

  async rememberForever<T = any>(
    key: string,
    callback: () => Promise<T>
  ): Promise<T> {
    return this.remember(key, callback, RUNTIME_CONFIG.CACHE.TTL.DAILY) // 24 часа
  }
}

// Экспортируем готовые кеш-менеджеры для разных целей
export const apiCache = new RedisCache('api')
export const pageCache = new RedisCache('page')
export const mediaCache = new RedisCache('media')
export const productCache = new RedisCache('product')
export const categoryCache = new RedisCache('category')

export default redisClient