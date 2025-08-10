"use client"

// Простой клиентский кеш в памяти
const clientApiCache = new Map<string, { data: any; expires: number }>()

// Утилиты для работы с клиентским кешем
const cacheUtils = {
  get: (key: string) => {
    const cached = clientApiCache.get(key)
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }
    if (cached) {
      clientApiCache.delete(key) // Удаляем истекший кеш
    }
    return null
  },

  set: (key: string, _data: any, ttl: number = 300000) => { // 5 минут по умолчанию
    clientApiCache.set(key, {
      data,
      expires: Date.now() + ttl
    })
  },

  delete: (key: string) => {
    clientApiCache.delete(key)
  },

  clear: () => {
    clientApiCache.clear()
  },

  getStats: () => {
    let validEntries = 0
    let expiredEntries = 0
    const now = Date.now()

    for (const [key, value] of clientApiCache.entries()) {
      if (value.expires > now) {
        validEntries++
      } else {
        expiredEntries++
      }
    }

    return {
      total: clientApiCache.size,
      valid: validEntries,
      expired: expiredEntries,
      hitRate: validEntries / (validEntries + expiredEntries) || 0
    }
  }
}

// Интерфейс для кеширования запросов
interface CacheOptions {
  enabled?: boolean
  ttl?: number
  key?: string
  skipCache?: boolean
}

// API client for making requests to backend with advanced caching
export class ApiClient {
  private static instance: ApiClient
  private baseUrl: string
  private pendingRequests = new Map<string, Promise<any>>()

  constructor() {
    // Определяем правильный baseUrl в зависимости от окружения
    if (typeof window !== 'undefined') {
      // В браузере - используем текущий origin
      this.baseUrl = `${window.location.origin}/api`
    } else {
      // На сервере - используем относительный путь
      this.baseUrl = "/api"
    }

  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  private async request(endpoint: string, options: RequestInit = {}, cacheOptions: CacheOptions = {}): Promise<any> {
    const {
      enabled = true,
      ttl,
      key,
      skipCache = false
    } = cacheOptions

    // Добавляем логирование для PUT запросов к selection-tables
    if (options.method === 'PUT' && endpoint.includes('selection-tables')) {

      try {
        const _body = JSON.parse(options.body as string)

      } catch (_e) {
        console.log('🌐 PUT request body (not JSON):', options.body)
      }
    }

    const shouldCache = enabled && !skipCache
    const cacheKey = key || `${endpoint}-${JSON.stringify(options)}`

    // Проверяем кеш
    if (shouldCache && !skipCache) {
      const cached = cacheUtils.get(cacheKey)
      if (cached) {

        return cached
      }
    }

    // Проверяем pending запросы (дедупликация)
    if (this.pendingRequests.has(cacheKey)) {

      return this.pendingRequests.get(cacheKey)!
    }

    const requestPromise = this.executeRequestWithRetry(endpoint, options)

    // Сохраняем pending запрос
    this.pendingRequests.set(cacheKey, requestPromise)

    try {
      const response = await requestPromise

      // Кешируем успешный ответ
      if (shouldCache && response) {
        cacheUtils.set(cacheKey, response, ttl)

      }

      return response
    } catch (error) {
      console.error(`❌ API Error: ${endpoint}`, error)
      throw error
    } finally {
      // Убираем из pending
      this.pendingRequests.delete(cacheKey)
    }
  }

  private async executeRequestWithRetry(endpoint: string, options: RequestInit = {}, maxRetries: number = 3): Promise<any> {
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {

        // Для первого запроса добавляем небольшую задержку чтобы дать серверу время
        if (attempt === 1 && endpoint !== '/test') {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        const result = await this.executeRequest(endpoint, options)

        if (attempt > 1) {

        }

        return result
      } catch (error: any) {
        lastError = error

        console.warn(`⚠️ API Request attempt ${attempt}/${maxRetries} failed: ${endpoint}`, {
          error: error.message,
          willRetry: attempt < maxRetries
        })

        // Не ретраим если это HTTP ошибка (404, 500, etc) - только network errors
        if (!error.message.includes('Failed to fetch') && error.name !== 'AbortError') {

          throw error
        }

        if (attempt < maxRetries) {
          // Экспоненциальная задержка: 500ms, 1000ms, 2000ms
          const delay = Math.min(500 * Math.pow(2, attempt - 1), 2000)

          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    console.error(`💥 API Request failed after ${maxRetries} attempts: ${endpoint}`)
    throw lastError
  }

  private async executeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const startTime = Date.now()
    const fullUrl = `${this.baseUrl}${endpoint}`

    try {
      // Создаем AbortController для таймаута вручную для лучшей совместимости
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn(`⏰ Request timeout after 15s: ${fullUrl}`)
        controller.abort()
      }, 15000) // 15 секунд

      const fetchOptions: RequestInit = {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: options.signal || controller.signal,
        ...options,
      }

      // Добавляем mode только для браузера
      if (typeof window !== 'undefined') {
        fetchOptions.mode = 'same-origin'
        fetchOptions.credentials = 'same-origin'
      }

      // Тестируем сначала простой запрос без всех опций для диагностики

      const response = await fetch(fullUrl, fetchOptions)

      clearTimeout(timeoutId) // Очищаем таймаут если запрос успешен

      console.log('📡 API Response Details:', {
        url: fullUrl,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        type: response.type,
        redirected: response.redirected,
        headers: Object.fromEntries(response.headers.entries()),
        bodyUsed: response.bodyUsed
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`🚨 HTTP Error ${response.status} (${responseTime}ms):`, {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          url: fullUrl
        })
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const data = await response.json()

      // Логируем производительность
      if (responseTime > 1000) {
        console.warn(`⚠️ Slow API request: ${endpoint} took ${responseTime}ms`)
      } else {

      }

      return data
    } catch (error: any) {
      const responseTime = Date.now() - startTime

      // Еще более детальная диагностика ошибок
      console.error(`💥 API Request Failed (${responseTime}ms):`, {
        url: fullUrl,
        endpoint: endpoint,
        baseUrl: this.baseUrl,
        error: error.message,
        errorType: error.constructor.name,
        errorName: error.name,
        isAbortError: error.name === 'AbortError',
        isNetworkError: error.message.includes('Failed to fetch'),
        isTypeError: error instanceof TypeError,
        windowLocation: typeof window !== 'undefined' ? window.location.href : 'N/A',
        fetchAvailable: typeof fetch !== 'undefined',
        navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : 'N/A',
        stack: error.stack,
        // Добавляем информацию о браузере
        browserInfo: typeof window !== 'undefined' ? {
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          port: window.location.port,
          origin: window.location.origin
        } : 'N/A'
      })

      // Пробуем fallback подход для диагностики
      if (error.message.includes('Failed to fetch') && typeof window !== 'undefined') {

        try {
          const _simpleFetch = await fetch(fullUrl)

        } catch (fallbackError: any) {
          console.error('❌ Fallback fetch also failed:', {
            error: fallbackError.message,
            type: fallbackError.constructor.name
          })
        }
      }

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout: ${endpoint} took more than 15 seconds`)
      }

      throw error
    }
  }

  // Site Settings
  async getSiteSettings() {
    return this.request("/site-settings", {}, {
      ttl: 10 * 60 * 1000, // кешируем на 10 минут
      key: 'site-settings'
    })
  }

  async updateSiteSettings(settings: any) {
    try {
      // Try PUT first
      const result = await this.request("/site-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      })

      // Очищаем кеш после обновления
      cacheUtils.delete('site-settings')

      return result
    } catch (_error) {

      // If PUT fails, try POST as fallback
      const result = await this.request("/site-settings", {
        method: "POST",
        body: JSON.stringify(settings),
      })

      // Очищаем кеш после обновления
      cacheUtils.delete('site-settings')

      return result
    }
  }

  // Categories
  async getCategories() {
    return this.request("/categories", {}, {
      ttl: 5 * 60 * 1000, // кешируем на 5 минут
      key: 'categories'
    })
  }

  async createCategory(category: any) {
    const result = await this.request("/categories", {
      method: "POST",
      body: JSON.stringify(category),
    })

    // Очищаем кеш категорий после создания
    cacheUtils.delete('categories')

    return result
  }

  async updateCategory(id: string, category: any) {
    const result = await this.request(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(category),
    })

    // Очищаем кеш категорий после обновления
    cacheUtils.delete('categories')

    return result
  }

  async deleteCategory(id: string) {
    const result = await this.request(`/categories/${id}`, {
      method: "DELETE",
    })

    // Очищаем кеш категорий после удаления
    cacheUtils.delete('categories')

    return result
  }

  // Features
  async getFeatures() {
    return this.request("/features")
  }

  async createFeature(feature: any) {
    return this.request("/features", {
      method: "POST",
      body: JSON.stringify(feature),
    })
  }

  async updateFeature(id: string, feature: any) {
    return this.request(`/features/${id}`, {
      method: "PUT",
      body: JSON.stringify(feature),
    })
  }

  async deleteFeature(id: string) {
    return this.request(`/features/${id}`, {
      method: "DELETE",
    })
  }

  // Products
  async getProducts(options: { fast?: boolean; limit?: number; detailed?: boolean } = {}) {
    const { fast = false, limit, detailed = false } = options

    let endpoint = "/products"
    const params = new URLSearchParams()

    if (fast) params.append("fast", "true")
    if (limit) params.append("limit", limit.toString())
    if (detailed) params.append("detailed", "true")

    if (params.toString()) {
      endpoint += `?${params.toString()}`
    }

    return this.request(endpoint, {}, {
      ttl: fast ? 1 * 60 * 1000 : 3 * 60 * 1000, // fast: 1 мин, обычный: 3 мин
      key: `products-${fast ? 'fast' : 'full'}-${limit || 'all'}-${detailed ? 'detailed' : 'basic'}`
    })
  }

  async createProduct(product: any) {
    const result = await this.request("/products", {
      method: "POST",
      body: JSON.stringify(product),
    })

    // Очищаем кеш продуктов после создания
    this.clearProductsCache()

    // Принудительно очищаем все кеши связанные с продуктами
    this.clearCache()

    // Принудительно очищаем Redis кэш
    try {
      const response = await fetch('/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patterns: [
            'medsip:products:*',
            'products:*',
            'product:*',
            'products-fast:*',
            'products-full:*',
            'products-detailed:*',
            'products-basic:*'
          ]
        })
      })

      if (response.ok) {

      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to clear cache via API after creation:', cacheError)
    }

    return result
  }

  async updateProduct(id: string, product: any) {
    const result = await this.request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(product),
    })

    // Очищаем кеш продуктов после обновления
    this.clearProductsCache()

    return result
  }

  async deleteProduct(id: string) {
    try {
      const result = await this.request(`/products/${id}`, {
        method: "DELETE",
      })

      // Очищаем кеш продуктов после удаления
      this.clearProductsCache()

      // Принудительно очищаем все кеши связанные с продуктами
      this.clearCache()

      // Принудительно очищаем Redis кэш
      try {
        const response = await fetch('/api/cache/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patterns: [
              'medsip:products:*',
              'products:*',
              'product:*',
              'products-fast:*',
              'products-full:*',
              'products-detailed:*',
              'products-basic:*'
            ]
          })
        })

        if (response.ok) {

        }
      } catch (cacheError) {
        console.warn('⚠️ Failed to clear cache via API:', cacheError)
      }

      return result
    } catch (error) {
      console.error('❌ Error in deleteProduct:', error)

      // Если продукт уже удален, считаем это успехом
      if (error.message && error.message.includes('Product not found')) {

        return { success: true, message: 'Product was already deleted' }
      }

      throw error
    }
  }

  // Media
  async getMedia(options: { limit?: number; fast?: boolean; continuationToken?: string } = {}) {
    const { limit, fast = false, continuationToken } = options

    let endpoint = "/media"
    const params = new URLSearchParams()

    if (limit) params.append("limit", limit.toString())
    if (fast) params.append("fast", "true")
    if (continuationToken) params.append("continuationToken", continuationToken)

    if (params.toString()) {
      endpoint += `?${params.toString()}`
    }

    return this.request(endpoint, {}, {
      ttl: 2 * 60 * 1000, // кешируем на 2 минуты
      key: `media-${limit || 'all'}-${fast ? 'fast' : 'full'}-${continuationToken || 'first'}`
    })
  }

  // Utility methods
  private clearProductsCache() {
    // Удаляем все ключи кеша связанные с продуктами
    for (const key of clientApiCache.keys()) {
      if (key.includes('products')) {
        cacheUtils.delete(key)
      }
    }
  }

  // Принудительное обновление списка продуктов
  async refreshProducts() {
    try {
      const result = await this.request('/products/refresh', {
        method: 'POST',
      })

      // Очищаем локальный кэш
      this.clearProductsCache()
      this.clearCache()

      return result
    } catch (error) {
      console.error('❌ Error refreshing products:', error)
      throw error
    }
  }

  clearCache() {

    cacheUtils.clear()

  }

  getCacheStats() {
    return cacheUtils.getStats()
  }
}

// Экспортируем singleton instance
export const apiClient = ApiClient.getInstance()
