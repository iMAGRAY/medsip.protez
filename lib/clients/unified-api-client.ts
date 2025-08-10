import { RUNTIME_CONFIG } from '../app-config'

/**
 * UNIFIED API CLIENT - Единый типизированный API клиент
 * Устраняет дублирование fetch вызовов и обеспечивает консистентную обработку ошибок
 */

// ========================================================================================
// TYPES & INTERFACES
// ========================================================================================
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  count?: number
  total?: number
}

export interface RequestConfig extends RequestInit {
  timeout?: number
  retries?: number
  skipAuth?: boolean
  baseUrl?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface FilterParams {
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  [key: string]: any
}

// Типизированные эндпоинты
export interface ApiEndpoints {
  // Products
  products: {
    list: (params?: FilterParams & PaginationParams) => Promise<ApiResponse>
    get: (id: number) => Promise<ApiResponse>
    create: (data: any) => Promise<ApiResponse>
    update: (id: number, data: any) => Promise<ApiResponse>
    delete: (id: number) => Promise<ApiResponse>
    export: () => Promise<ApiResponse>
    images: (id: number) => Promise<ApiResponse>
    characteristics: (id: number) => Promise<ApiResponse>
    selectionTables: (id: number) => Promise<ApiResponse>
  }

  // Categories
  categories: {
    list: (params?: FilterParams) => Promise<ApiResponse>
    flat: () => Promise<ApiResponse>
    get: (id: number) => Promise<ApiResponse>
    create: (data: any) => Promise<ApiResponse>
    update: (id: number, data: any) => Promise<ApiResponse>
    delete: (id: number) => Promise<ApiResponse>
  }

  // Manufacturers
  manufacturers: {
    list: (params?: FilterParams) => Promise<ApiResponse>
    get: (id: number) => Promise<ApiResponse>
    create: (data: any) => Promise<ApiResponse>
    update: (id: number, data: any) => Promise<ApiResponse>
    delete: (id: number) => Promise<ApiResponse>
    modelLines: (id: number) => Promise<ApiResponse>
  }

  // Model Lines
  modelLines: {
    list: (params?: FilterParams) => Promise<ApiResponse>
    get: (id: number) => Promise<ApiResponse>
    create: (data: any) => Promise<ApiResponse>
    update: (id: number, data: any) => Promise<ApiResponse>
    delete: (id: number) => Promise<ApiResponse>
    products: (id: number) => Promise<ApiResponse>
  }

  // Warehouse
  warehouse: {
    regions: () => Promise<ApiResponse>
    cities: () => Promise<ApiResponse>
    warehouses: () => Promise<ApiResponse>
    zones: () => Promise<ApiResponse>
    sections: () => Promise<ApiResponse>
    analytics: () => Promise<ApiResponse>
    inventory: () => Promise<ApiResponse>
    articles: (params?: FilterParams) => Promise<ApiResponse>
    settings: () => Promise<ApiResponse>
    bulkOperations: (data: any) => Promise<ApiResponse>
  }

  // Media
  media: {
    list: (params?: FilterParams & PaginationParams) => Promise<ApiResponse>
    upload: (formData: FormData) => Promise<ApiResponse>
    delete: (key: string) => Promise<ApiResponse>
    checkDuplicate: (hash: string) => Promise<ApiResponse>
    register: (data: any) => Promise<ApiResponse>
    sync: () => Promise<ApiResponse>
  }

  // Characteristics
  characteristics: {
    list: (params?: FilterParams) => Promise<ApiResponse>
    groups: () => Promise<ApiResponse>
    values: () => Promise<ApiResponse>
    templates: () => Promise<ApiResponse>
  }

  // Admin
  admin: {
    auth: {
      login: (credentials: any) => Promise<ApiResponse>
      logout: () => Promise<ApiResponse>
      status: () => Promise<ApiResponse>
    }
    users: {
      list: () => Promise<ApiResponse>
      get: (id: number) => Promise<ApiResponse>
      create: (data: any) => Promise<ApiResponse>
      update: (id: number, data: any) => Promise<ApiResponse>
      delete: (id: number) => Promise<ApiResponse>
    }
    roles: () => Promise<ApiResponse>
    stats: () => Promise<ApiResponse>
  }

  // Cache
  cache: {
    clear: () => Promise<ApiResponse>
    status: () => Promise<ApiResponse>
  }
}

// ========================================================================================
// API CLIENT CLASS
// ========================================================================================
class UnifiedApiClient {
  private baseUrl: string
  private defaultConfig: RequestConfig
  private requestQueue: Map<string, Promise<any>> = new Map()
  private rateLimiter: Map<string, number> = new Map()
  private burstTracker: Map<string, { count: number; resetTime: number }> = new Map()

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
    this.defaultConfig = {
      timeout: RUNTIME_CONFIG.NETWORK.TIMEOUTS.DEFAULT_FETCH,
      retries: RUNTIME_CONFIG.NETWORK.RETRY.MAX_ATTEMPTS,
      headers: {
        'Content-Type': 'application/json',
      }
    }
  }

  // ========================================================================================
  // CORE HTTP METHODS
  // ========================================================================================
  private async makeRequest<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const fullConfig = { ...this.defaultConfig, ...config }
    const url = `${config.baseUrl || this.baseUrl}${endpoint}`

    // Rate limiting check
    if (!this.checkRateLimit(url)) {
      throw new Error('Rate limit exceeded')
    }

    // Deduplicate identical requests
    const requestKey = `${config.method || 'GET'}-${url}-${JSON.stringify(config.body || {})}`
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey)!
    }

    const requestPromise = this.executeRequest<T>(url, fullConfig)
    this.requestQueue.set(requestKey, requestPromise)

    // Cleanup after request
    requestPromise.finally(() => {
      this.requestQueue.delete(requestKey)
    })

    return requestPromise
  }

  private async executeRequest<T>(url: string, config: RequestConfig): Promise<ApiResponse<T>> {
    const timeout = config.timeout || RUNTIME_CONFIG.NETWORK.TIMEOUTS.DEFAULT_FETCH
    const maxRetries = config.retries || 1

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeout)

      try {
        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const requestMethod = config.method || 'GET'
          console.error(`❌ API Request failed (attempt ${attempt}/${maxRetries}):`, {
            url,
            method: requestMethod,
            status: response.status,
            statusText: response.statusText,
            requestBody: config.body,
            headers: config.headers
          })

          // Попытаемся получить тело ответа для debugging
          try {
            const errorBody = await response.clone().json()
            console.error(`❌ Error response body:`, errorBody)

            if (response.status >= 500 && attempt < maxRetries) {
              await this.delay(RUNTIME_CONFIG.NETWORK.RETRY.BACKOFF_BASE * Math.pow(2, attempt - 1))
              continue
            }

            // Включаем сообщение об ошибке из API в исключение
            const errorMessage = errorBody?.error || `HTTP ${response.status}: ${response.statusText}`;
            const error = new Error(errorMessage) as any;
            error.response = errorBody;
            error.status = response.status;
            error.statusText = response.statusText;
            error.suggestion = errorBody?.suggestion;
            error.existingProduct = errorBody?.existingProduct;

            throw error;
          } catch (e) {
            console.error(`❌ Could not read error response body:`, e)

            if (response.status >= 500 && attempt < maxRetries) {
              await this.delay(RUNTIME_CONFIG.NETWORK.RETRY.BACKOFF_BASE * Math.pow(2, attempt - 1))
              continue
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
        }

        const data = await response.json()
        return data
      } catch (error) {
        clearTimeout(timeoutId)

        // Если это AbortError и у нас есть еще попытки, продолжаем
        if (error.name === 'AbortError' && attempt < maxRetries) {
          console.warn(`⏱️ Request timeout (attempt ${attempt}/${maxRetries}), retrying...`)
          await this.delay(RUNTIME_CONFIG.NETWORK.RETRY.BACKOFF_BASE * Math.pow(2, attempt - 1))
          continue
        }

        // Если это последняя попытка или не AbortError, выбрасываем ошибку
        if (attempt === maxRetries) {
          throw error
        }

        // Для других ошибок делаем retry
        await this.delay(RUNTIME_CONFIG.NETWORK.RETRY.BACKOFF_BASE * Math.pow(2, attempt - 1))
      }
    }

    throw new Error('Max retries exceeded')
  }

  // ========================================================================================
  // HELPER METHODS
  // ========================================================================================
  private checkRateLimit(url: string): boolean {
    const now = Date.now()

    // Extract pathname from URL, handling both absolute and relative URLs
    let pathname: string
    try {
      // Try to create URL directly (for absolute URLs)
      pathname = new URL(url).pathname
    } catch {
      // If it fails (relative URL), create with a dummy base
      try {
        pathname = new URL(url, 'http://localhost').pathname
      } catch {
        // Fallback: use the URL as-is for rate limiting key
        pathname = url
      }
    }

    const key = pathname
    const burstKey = `burst_${key}`

    // Check burst limit (allows multiple requests within a short window)
    const burstData = this.burstTracker.get(burstKey) || { count: 0, resetTime: now + 60000 } // 1 minute window

    // Reset burst counter if window expired
    if (now > burstData.resetTime) {
      burstData.count = 0
      burstData.resetTime = now + 60000
    }

    // Allow burst requests up to burst limit
    if (burstData.count < RUNTIME_CONFIG.NETWORK.RATE_LIMITS.BURST_LIMIT) {
      burstData.count++
      this.burstTracker.set(burstKey, burstData)
      this.rateLimiter.set(key, now)
      return true
    }

    // Fall back to regular rate limiting
    const lastRequest = this.rateLimiter.get(key) || 0
    const minInterval = 60000 / RUNTIME_CONFIG.NETWORK.RATE_LIMITS.REQUESTS_PER_MINUTE

    if (now - lastRequest < minInterval) {
      return false
    }

    this.rateLimiter.set(key, now)
    return true
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    return searchParams.toString()
  }

  // ========================================================================================
  // HTTP METHODS
  // ========================================================================================
  async get<T = any>(endpoint: string, params?: Record<string, any>, config?: RequestConfig): Promise<ApiResponse<T>> {
    const queryString = params ? `?${this.buildQueryString(params)}` : ''
    return this.makeRequest<T>(`${endpoint}${queryString}`, {
      ...config,
      method: 'GET',
    })
  }

  async post<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...config,
      method: 'DELETE',
    })
  }

  // ========================================================================================
  // TYPED API ENDPOINTS
  // ========================================================================================
  readonly api: ApiEndpoints = {
    // Products API
    products: {
      list: (params) => this.get('/products', params),
      get: (id) => this.get(`/products/${id}`),
      create: (data) => this.post('/products', data),
      update: (id, data) => this.put(`/products/${id}`, data),
      delete: (id) => this.delete(`/products/${id}`),
      export: () => this.get('/products/export'),
      images: (id) => this.get(`/products/${id}/images`),
      characteristics: (id) => this.get(`/products/${id}/characteristics`),
      selectionTables: (id) => this.get(`/products/${id}/selection-tables`),
    },

    // Categories API
    categories: {
      list: (params) => this.get('/categories', params),
      flat: () => this.get('/categories-flat'),
      get: (id) => this.get(`/categories/${id}`),
      create: (data) => this.post('/categories', data),
      update: (id, data) => this.put(`/categories/${id}`, data),
      delete: (id) => this.delete(`/categories/${id}`),
    },

    // Manufacturers API
    manufacturers: {
      list: (params) => this.get('/manufacturers', params),
      get: (id) => this.get(`/manufacturers/${id}`),
      create: (data) => this.post('/manufacturers', data),
      update: (id, data) => this.put(`/manufacturers/${id}`, data),
      delete: (id) => this.delete(`/manufacturers/${id}`),
      modelLines: (id) => this.get(`/manufacturers/${id}/model-lines`),
    },

    // Model Lines API
    modelLines: {
      list: (params) => this.get('/model-lines', params),
      get: (id) => this.get(`/model-lines/${id}`),
      create: (data) => this.post('/model-lines', data),
      update: (id, data) => this.put(`/model-lines/${id}`, data),
      delete: (id) => this.delete(`/model-lines/${id}`),
      products: (id) => this.get(`/model-lines/${id}/products`),
    },

    // Warehouse API
    warehouse: {
      regions: () => this.get('/warehouse/regions'),
      cities: () => this.get('/warehouse/cities'),
      warehouses: () => this.get('/warehouse/warehouses'),
      zones: () => this.get('/warehouse/zones'),
      sections: () => this.get('/warehouse/sections'),
      analytics: () => this.get('/warehouse/analytics'),
      inventory: () => this.get('/warehouse/inventory'),
      articles: (params) => this.get('/warehouse/articles', params),
      settings: () => this.get('/warehouse/settings'),
      bulkOperations: (data) => this.post('/warehouse/bulk-operations', data),
    },

    // Media API
    media: {
      list: (params) => this.get('/media', params),
      upload: (formData) => this.makeRequest('/upload', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set Content-Type for FormData
      }),
      delete: (_key) => this.post('/media/delete', { key: _key }),
      checkDuplicate: (_hash) => this.post('/media/check-duplicate', { hash: _hash }),
      register: (data) => this.post('/media/register', data),
      sync: () => this.post('/media/sync'),
    },

    // Characteristics API
    characteristics: {
      list: (params) => this.get('/characteristics', params),
      groups: () => this.get('/spec-groups-optimized'),
      values: () => this.get('/spec-values'),
      templates: () => this.get('/admin/templates'),
    },

    // Admin API
    admin: {
      auth: {
        login: (credentials) => this.post('/admin/auth/login', credentials),
        logout: () => this.post('/admin/auth/logout'),
        status: () => this.get('/admin/auth/status'),
      },
      users: {
        list: () => this.get('/admin/users'),
        get: (id) => this.get(`/admin/users/${id}`),
        create: (data) => this.post('/admin/users', data),
        update: (id, data) => this.put(`/admin/users/${id}`, data),
        delete: (id) => this.delete(`/admin/users/${id}`),
      },
      roles: () => this.get('/admin/roles'),
      stats: () => this.get('/admin/dashboard-stats'),
    },

    // Cache API
    cache: {
      clear: () => this.post('/cache/clear'),
      status: () => this.get('/cache'),
    }
  }

  // ========================================================================================
  // BATCH OPERATIONS
  // ========================================================================================
  async batch<T = any>(requests: Array<() => Promise<ApiResponse<T>>>): Promise<ApiResponse<T>[]> {
    try {
      const results = await Promise.allSettled(requests.map(req => req()))
      return results.map(result => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          return {
            success: false,
            error: result.reason.message || 'Batch request failed'
          }
        }
      })
    } catch (error) {
      throw new Error(`Batch operation failed: ${error}`)
    }
  }

  // ========================================================================================
  // CACHE MANAGEMENT
  // ========================================================================================
  clearRequestQueue(): void {
    this.requestQueue.clear()
  }

  clearRateLimiter(): void {
    this.rateLimiter.clear()
    this.burstTracker.clear()
  }
}

// ========================================================================================
// SINGLETON INSTANCE
// ========================================================================================
export const apiClient = new UnifiedApiClient()

// ========================================================================================
// CONVENIENCE EXPORTS
// ========================================================================================
export const {
  api,
  get,
  post,
  put,
  patch,
  delete: deleteRequest,
  batch
} = apiClient

export default apiClient

// ========================================================================================
// LEGACY COMPATIBILITY
// ========================================================================================
export const legacyFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  console.warn('Using legacy fetch - consider migrating to unified API client')
  return fetch(url, options)
}

// Types already exported above with interfaces