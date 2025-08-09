// Утилиты для HTTP кеширования в API роутах Next.js

export interface CacheSettings {
  maxAge?: number // кеш в секундах
  sMaxAge?: number // кеш в CDN в секундах
  staleWhileRevalidate?: number // время показа устаревшего контента при обновлении
  mustRevalidate?: boolean // принудительная валидация
  noCache?: boolean // отключить кеширование
  noStore?: boolean // не сохранять в кеше
  public?: boolean // разрешить кеширование в публичных кешах
  private?: boolean // кеширование только в приватных кешах
  etag?: string // ETag для валидации
  lastModified?: Date // дата последнего изменения
}

export class ApiCacheHeaders {
  // Генерация Cache-Control заголовка
  static generateCacheControl(settings: CacheSettings): string {
    const parts: string[] = []

    if (settings.noCache) {
      parts.push('no-cache')
    } else if (settings.noStore) {
      parts.push('no-store')
    } else {
      if (settings.public) {
        parts.push('public')
      } else if (settings.private) {
        parts.push('private')
      }

      if (settings.maxAge !== undefined) {
        parts.push(`max-age=${settings.maxAge}`)
      }

      if (settings.sMaxAge !== undefined) {
        parts.push(`s-maxage=${settings.sMaxAge}`)
      }

      if (settings.staleWhileRevalidate !== undefined) {
        parts.push(`stale-while-revalidate=${settings.staleWhileRevalidate}`)
      }

      if (settings.mustRevalidate) {
        parts.push('must-revalidate')
      }
    }

    return parts.join(', ')
  }

  // Заголовки для статических данных (категории, настройки)
  static staticDataHeaders(): HeadersInit {
    return {
      'Cache-Control': this.generateCacheControl({
        public: true,
        maxAge: 300, // 5 минут
        sMaxAge: 600, // 10 минут в CDN
        staleWhileRevalidate: 900 // показываем устаревшее содержимое до 15 минут
      }),
      'Vary': 'Accept-Encoding',
      'X-Cache-Strategy': 'static-data'
    }
  }

  // Заголовки для динамических данных (продукты, медиа)
  static dynamicDataHeaders(): HeadersInit {
    return {
      'Cache-Control': this.generateCacheControl({
        public: true,
        maxAge: 60, // 1 минута
        sMaxAge: 180, // 3 минуты в CDN
        staleWhileRevalidate: 300 // показываем устаревшее содержимое до 5 минут
      }),
      'Vary': 'Accept-Encoding',
      'X-Cache-Strategy': 'dynamic-data'
    }
  }

  // Заголовки для часто изменяемых данных
  static frequentlyUpdatedHeaders(): HeadersInit {
    return {
      'Cache-Control': this.generateCacheControl({
        public: true,
        maxAge: 30, // 30 секунд
        sMaxAge: 60, // 1 минута в CDN
        staleWhileRevalidate: 120 // показываем устаревшее содержимое до 2 минут
      }),
      'Vary': 'Accept-Encoding',
      'X-Cache-Strategy': 'frequent-updates'
    }
  }

  // Заголовки для изображений и медиа
  static mediaHeaders(): HeadersInit {
    return {
      'Cache-Control': this.generateCacheControl({
        public: true,
        maxAge: 3600, // 1 час
        sMaxAge: 86400, // 1 день в CDN
        staleWhileRevalidate: 172800 // показываем устаревшее содержимое до 2 дней
      }),
      'Vary': 'Accept-Encoding',
      'X-Cache-Strategy': 'media-files'
    }
  }

  // Заголовки для отключения кеширования
  static noCache(): HeadersInit {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache-Strategy': 'no-cache'
    }
  }

  // Условное кеширование с ETag
  static conditionalCache(etag: string, lastModified?: Date): HeadersInit {
    const headers: HeadersInit = {
      'ETag': `"${etag}"`,
      'Cache-Control': this.generateCacheControl({
        public: true,
        maxAge: 300,
        mustRevalidate: true
      }),
      'X-Cache-Strategy': 'conditional'
    }

    if (lastModified) {
      headers['Last-Modified'] = lastModified.toUTCString()
    }

    return headers
  }

  // Проверка условных запросов
  static checkConditionalRequest(
    request: Request,
    etag: string,
    lastModified?: Date
  ): { notModified: boolean; headers: HeadersInit } {
    const ifNoneMatch = request.headers.get('If-None-Match')
    const ifModifiedSince = request.headers.get('If-Modified-Since')

    let notModified = false

    // Проверяем ETag
    if (ifNoneMatch && ifNoneMatch === `"${etag}"`) {
      notModified = true
    }

    // Проверяем Last-Modified
    if (!notModified && ifModifiedSince && lastModified) {
      const ifModifiedSinceDate = new Date(ifModifiedSince)
      if (lastModified <= ifModifiedSinceDate) {
        notModified = true
      }
    }

    const headers = this.conditionalCache(etag, lastModified)

    return { notModified, headers }
  }

  // Кеширование с компрессией
  static compressedCacheHeaders(compressionType: 'gzip' | 'br' | 'deflate'): HeadersInit {
    return {
      ...this.dynamicDataHeaders(),
      'Content-Encoding': compressionType,
      'Vary': 'Accept-Encoding, Accept'
    }
  }

  // Заголовки для API с пагинацией
  static paginatedApiHeaders(hasMore: boolean): HeadersInit {
    return {
      'Cache-Control': this.generateCacheControl({
        public: true,
        maxAge: hasMore ? 60 : 300, // если есть еще данные - кешируем меньше
        sMaxAge: hasMore ? 120 : 600
      }),
      'X-Has-More': hasMore.toString(),
      'X-Cache-Strategy': 'paginated-api'
    }
  }

  // Заголовки для поиска и фильтрации
  static searchResultsHeaders(query: string): HeadersInit {
    const isEmptyQuery = !query || query.trim().length === 0

    return {
      'Cache-Control': this.generateCacheControl({
        public: true,
        maxAge: isEmptyQuery ? 300 : 120, // пустые запросы кешируем дольше
        sMaxAge: isEmptyQuery ? 600 : 300,
        staleWhileRevalidate: 180
      }),
      'Vary': 'Accept-Encoding',
      'X-Search-Query': query ? 'yes' : 'no',
      'X-Cache-Strategy': 'search-results'
    }
  }

  // Производительность - добавляем метрики времени
  static addPerformanceHeaders(
    headers: HeadersInit,
    startTime: number,
    additionalMetrics?: Record<string, string | number>
  ): HeadersInit {
    const responseTime = Date.now() - startTime

    const performanceHeaders: Record<string, string> = {
      ...headers as Record<string, string>,
      'X-Response-Time': `${responseTime}ms`,
      'X-Timestamp': new Date().toISOString()
    }

    if (additionalMetrics) {
      Object.entries(additionalMetrics).forEach(([key, value]) => {
        performanceHeaders[`X-${key}`] = value.toString()
      })
    }

    return performanceHeaders
  }

  // Безопасные заголовки кеширования
  static secureHeaders(): HeadersInit {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  }

  // Комбинированные заголовки для API с полной поддержкой
  static apiResponseHeaders(
    cacheStrategy: 'static' | 'dynamic' | 'frequent' | 'media' | 'no-cache',
    startTime: number,
    options?: {
      etag?: string
      lastModified?: Date
      hasMore?: boolean
      searchQuery?: string
      additionalMetrics?: Record<string, string | number>
    }
  ): HeadersInit {
    let baseHeaders: HeadersInit = {}

    // Выбираем базовые заголовки кеширования
    switch (cacheStrategy) {
      case 'static':
        baseHeaders = this.staticDataHeaders()
        break
      case 'dynamic':
        baseHeaders = this.dynamicDataHeaders()
        break
      case 'frequent':
        baseHeaders = this.frequentlyUpdatedHeaders()
        break
      case 'media':
        baseHeaders = this.mediaHeaders()
        break
      case 'no-cache':
        baseHeaders = this.noCache()
        break
    }

    // Добавляем условное кеширование
    if (options?.etag) {
      const conditionalHeaders = this.conditionalCache(options.etag, options.lastModified)
      baseHeaders = { ...baseHeaders, ...conditionalHeaders }
    }

    // Добавляем заголовки пагинации
    if (options?.hasMore !== undefined) {
      const paginatedHeaders = this.paginatedApiHeaders(options.hasMore)
      baseHeaders = { ...baseHeaders, ...paginatedHeaders }
    }

    // Добавляем заголовки поиска
    if (options?.searchQuery !== undefined) {
      const searchHeaders = this.searchResultsHeaders(options.searchQuery)
      baseHeaders = { ...baseHeaders, ...searchHeaders }
    }

    // Добавляем безопасные заголовки
    const secureHeaders = this.secureHeaders()
    baseHeaders = { ...baseHeaders, ...secureHeaders }

    // Добавляем метрики производительности
    return this.addPerformanceHeaders(baseHeaders, startTime, options?.additionalMetrics)
  }
}

export default ApiCacheHeaders