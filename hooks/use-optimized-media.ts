import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { RUNTIME_CONFIG } from '@/lib/app-config'

interface MediaFile {
  name: string
  url: string
  size: number
  uploadedAt: Date
  productName?: string
  productId?: string
  type?: 'upload' | 'product' | 's3'
  source?: 'product' | 's3'
  key?: string
}

interface PerformanceData {
  totalTime: number
  s3Time?: number
  sortTime?: number
  fileCount?: number
  clientTime?: number
  error?: boolean
  cached?: boolean
  requestId?: string
}

interface UseOptimizedMediaOptions {
  pageSize?: number
  enableCaching?: boolean
  maxConcurrentRequests?: number
  throttleMs?: number
  enableVirtualization?: boolean
}

interface UseOptimizedMediaReturn {
  mediaFiles: MediaFile[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  performance: PerformanceData | null
  error: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  clearCache: () => void
}

// Глобальные настройки производительности
const MAX_CONCURRENT_REQUESTS = 2
const REQUEST_THROTTLE_MS = 100
const CACHE_SIZE_LIMIT = RUNTIME_CONFIG.CACHE.LIMITS.CACHE_SIZE_LIMIT
const MAX_RETRIES = RUNTIME_CONFIG.NETWORK.RETRY.MAX_ATTEMPTS

// Кэш запросов
const requestCache = new Map<string, {
  data: any
  timestamp: number
  promise?: Promise<any>
}>()

// Семафор для ограничения параллельных запросов
class RequestSemaphore {
  private count: number
  private waiting: Array<() => void> = []

  constructor(maxCount: number) {
    this.count = maxCount
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.count > 0) {
        this.count--
        resolve()
      } else {
        this.waiting.push(resolve)
      }
    })
  }

  release(): void {
    this.count++
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!
      this.count--
      resolve()
    }
  }
}

const requestSemaphore = new RequestSemaphore(MAX_CONCURRENT_REQUESTS)

// Throttling функция
function throttle<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout | null = null
  let lastExecTime = 0

  return ((...args: any[]) => {
    const currentTime = Date.now()

    if (currentTime - lastExecTime > delay) {
      lastExecTime = currentTime
      return func(...args)
    } else {
      if (timeoutId) clearTimeout(timeoutId)

      timeoutId = setTimeout(() => {
        lastExecTime = Date.now()
        func(...args)
      }, delay - (currentTime - lastExecTime))
    }
  }) as T
}

// Оптимизированный запрос с кэшированием и retry
async function optimizedFetch(url: string, options: RequestInit = {}): Promise<any> {
  const cacheKey = `${url}_${JSON.stringify(options)}`

  // Проверяем кэш
  const cached = requestCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < RUNTIME_CONFIG.CACHE.TTL.SHORT * 1000) { // TTL из конфигурации
    if (cached.promise) {
      return cached.promise
    }
    return cached.data
  }

  // Ограничиваем параллельные запросы
  await requestSemaphore.acquire()

  try {
    let lastError: any

    // Retry логика
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), RUNTIME_CONFIG.NETWORK.TIMEOUTS.DEFAULT_FETCH) // timeout из конфигурации

        const promise = fetch(url, {
          ...options,
          signal: controller.signal
        }).then(response => {
          clearTimeout(timeoutId)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          return response.json()
        })

        // Кэшируем promise для избежания дублирования запросов
        requestCache.set(cacheKey, {
          data: null,
          timestamp: Date.now(),
          promise
        })

        const data = await promise

        // Сохраняем результат в кэш
        requestCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        })

        // Очищаем старые записи кэша
        if (requestCache.size > CACHE_SIZE_LIMIT) {
          const oldestKey = Array.from(requestCache.keys())[0]
          requestCache.delete(oldestKey)
        }

        return data

      } catch (error) {
        lastError = error
        console.warn(`Request attempt ${attempt} failed:`, error)

        if (attempt < MAX_RETRIES) {
          // Экспоненциальная задержка между попытками
          await new Promise(resolve => setTimeout(resolve, Math.pow(RUNTIME_CONFIG.NETWORK.RETRY.EXPONENTIAL_MULTIPLIER, attempt) * RUNTIME_CONFIG.NETWORK.RETRY.BACKOFF_BASE))
        }
      }
    }

    throw lastError

  } finally {
    requestSemaphore.release()
  }
}

export function useOptimizedMedia(options: UseOptimizedMediaOptions = {}): UseOptimizedMediaReturn {
  const {
    pageSize = 20,
    enableCaching = true,
    maxConcurrentRequests = MAX_CONCURRENT_REQUESTS,
    throttleMs = REQUEST_THROTTLE_MS,
    enableVirtualization = true
  } = options

  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [performance, setPerformance] = useState<PerformanceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const requestCountRef = useRef(0)

  // Мемоизированный throttled запрос
  const throttledLoadMedia = useMemo(() => {
    return throttle(async (isLoadMore = false) => {
      const startTime = Date.now()

      try {
        // Отменяем предыдущие запросы
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }

        abortControllerRef.current = new AbortController()

        if (isLoadMore) {
          setLoadingMore(true)
        } else {
          setLoading(true)
          setError(null)
        }

        const params = new URLSearchParams({
          limit: pageSize.toString()
        })

        if (isLoadMore && nextToken) {
          params.append('continuationToken', nextToken)
        }

        const data = await optimizedFetch(`/api/media?${params}`, {
          signal: abortControllerRef.current.signal
        })

        const _clientTime = Date.now() - startTime

        // Обновляем состояние
        if (isLoadMore) {
          setMediaFiles(prev => [...prev, ...(data.files || [])])
        } else {
          setMediaFiles(data.files || [])
        }

        setHasMore(data.hasMore || false)
        setNextToken(data.nextContinuationToken)
        setPerformance({
          ...data.performance,
          clientTime: _clientTime
        })

        requestCountRef.current++

      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Media loading error:', err)
          setError(err.message || 'Failed to load media files')
          setPerformance({
            totalTime: Date.now() - startTime,
            error: true,
            clientTime: Date.now() - startTime
          })
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    }, throttleMs)
  }, [pageSize, nextToken, throttleMs])

  // Оптимизированные функции
  const _loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    await throttledLoadMedia(true)
  }, [loadingMore, hasMore, throttledLoadMedia])

  const _refresh = useCallback(async () => {
    // Очищаем кэш перед обновлением для получения актуальных данных
    requestCache.clear()
    setNextToken(null)
    await throttledLoadMedia(false)
  }, [throttledLoadMedia])

  const _clearCache = useCallback(() => {
    requestCache.clear()
  }, [])

  // Начальная загрузка
  useEffect(() => {
    throttledLoadMedia(false)

    // Cleanup при размонтировании
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [throttledLoadMedia]) // Только при монтировании

  // Мониторинг производительности
  useEffect(() => {
    if (performance && !performance.error) {
      // Логируем только медленные запросы
      if (performance.totalTime > 2000) {
        console.warn(`🐌 Slow media request: ${performance.totalTime}ms`, {
          requestId: performance.requestId,
          fileCount: performance.fileCount,
          cached: performance.cached
        })
      }

      // Предупреждаем о большом количестве запросов
      if (requestCountRef.current > 10) {
        console.warn(`📊 High request count: ${requestCountRef.current} requests`)
      }
    }
  }, [performance])

  return {
    mediaFiles,
    loading,
    loadingMore,
    hasMore,
    performance,
    error,
    loadMore: _loadMore,
    refresh: _refresh,
    clearCache: _clearCache
  }
}