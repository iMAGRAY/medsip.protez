"use client"

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
// Простой кеш для клиентской стороны (только в памяти)
const clientPageCache = new Map<string, { data: any; expires: number }>()

interface NavigationState {
  isNavigating: boolean
  targetPath: string | null
  loadingStates: Set<string>
  skeletonComponents: Map<string, React.ComponentType>
}

interface InstantNavigationOptions {
  prefetchDelay?: number
  cacheTimeout?: number
  enableSkeleton?: boolean
  trackHistory?: boolean
}

// Хук для мгновенной навигации
export function useInstantNavigation(options: InstantNavigationOptions = {}) {
  const {
    prefetchDelay = 100,
    cacheTimeout = 5 * 60 * 1000, // 5 минут
    enableSkeleton = true,
    trackHistory = true
  } = options

  const router = useRouter()
  const pathname = usePathname()

  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    targetPath: null,
    loadingStates: new Set(),
    skeletonComponents: new Map()
  })

  const prefetchTimeoutRef = useRef<NodeJS.Timeout>()
  const navigationTimeoutRef = useRef<NodeJS.Timeout>()
  const abortControllerRef = useRef<AbortController>()

  // Очистка таймеров
  const clearTimeouts = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current)
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  // Предзагрузка данных для пути
  const prefetchRoute = useCallback(async (path: string) => {
    try {
      // Проверяем кеш
      const cacheKey = `route:${path}`
      const cached = clientPageCache.get(cacheKey)

      if (cached && cached.expires > Date.now()) {
        return cached.data
      }

      // Создаем новый AbortController
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()
      // Имитируем prefetch через fetch для получения данных страницы
      const response = await fetch(path, {
        signal: abortControllerRef.current.signal
      })

      if (response.ok) {
        const data = await response.text()
        clientPageCache.set(cacheKey, { data, expires: Date.now() + cacheTimeout })
        return data
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
      } else {
        console.warn(`❌ Prefetch failed: ${path}`, error)
      }
    }
  }, [cacheTimeout])

  // Мгновенная навигация
  const navigateInstantly = useCallback((path: string, options?: { replace?: boolean }) => {
    clearTimeouts()
    setNavigationState(prev => ({
      ...prev,
      isNavigating: true,
      targetPath: path,
      loadingStates: new Set([path])
    }))

    // Мгновенный переход
    if (options?.replace) {
      router.replace(path)
    } else {
      router.push(path)
    }

    // Сброс состояния навигации
    navigationTimeoutRef.current = setTimeout(() => {
      setNavigationState(prev => ({
        ...prev,
        isNavigating: false,
        targetPath: null,
        loadingStates: new Set()
      }))
    }, 100)
  }, [router, clearTimeouts])

  // Prefetch при hover
  const handlePrefetch = useCallback((path: string) => {
    if (path === pathname) return // Не prefetch текущий путь

    clearTimeouts()

    prefetchTimeoutRef.current = setTimeout(() => {
      prefetchRoute(path)
    }, prefetchDelay)
  }, [pathname, prefetchRoute, prefetchDelay, clearTimeouts])

  // Отмена prefetch
  const cancelPrefetch = useCallback(() => {
    clearTimeouts()
  }, [clearTimeouts])

  // Проверка загружается ли путь
  const isLoading = useCallback((path: string) => {
    return navigationState.loadingStates.has(path)
  }, [navigationState.loadingStates])

  // Регистрация skeleton компонента для пути
  const registerSkeleton = useCallback((path: string, component: React.ComponentType) => {
    setNavigationState(prev => ({
      ...prev,
      skeletonComponents: new Map(prev.skeletonComponents).set(path, component)
    }))
  }, [])

  // Получение skeleton компонента для пути
  const getSkeleton = useCallback((path: string) => {
    return navigationState.skeletonComponents.get(path)
  }, [navigationState.skeletonComponents])

  // Добавление состояния загрузки
  const addLoadingState = useCallback((key: string) => {
    setNavigationState(prev => ({
      ...prev,
      loadingStates: new Set([...prev.loadingStates, key])
    }))
  }, [])

  // Удаление состояния загрузки
  const removeLoadingState = useCallback((key: string) => {
    setNavigationState(prev => {
      const newLoadingStates = new Set(prev.loadingStates)
      newLoadingStates.delete(key)
      return {
        ...prev,
        loadingStates: newLoadingStates
      }
    })
  }, [])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      clearTimeouts()
    }
  }, [clearTimeouts])

  // Отслеживание изменений пути
  useEffect(() => {
    if (trackHistory) {
      // Удаляем состояние загрузки для текущего пути
      setNavigationState(prev => ({
        ...prev,
        isNavigating: false,
        targetPath: null,
        loadingStates: new Set([...prev.loadingStates].filter(path => path !== pathname))
      }))
    }
  }, [pathname, trackHistory])

  return {
    // Основные функции
    navigateInstantly,
    handlePrefetch,
    cancelPrefetch,

    // Состояние
    isNavigating: navigationState.isNavigating,
    targetPath: navigationState.targetPath,
    isLoading,

    // Skeleton управление
    registerSkeleton,
    getSkeleton,

    // Состояния загрузки
    addLoadingState,
    removeLoadingState,
    loadingStates: navigationState.loadingStates,

    // Утилиты
    currentPath: pathname,
    clearTimeouts
  }
}

// Хук для компонентов ссылок
export function useInstantLink(href: string, options?: { prefetch?: boolean; replace?: boolean }) {
  const { navigateInstantly, handlePrefetch, cancelPrefetch, isLoading } = useInstantNavigation()

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    navigateInstantly(href, { replace: options?.replace })
  }, [href, navigateInstantly, options?.replace])

  const handleMouseEnter = useCallback(() => {
    if (options?.prefetch !== false) {
      handlePrefetch(href)
    }
  }, [href, handlePrefetch, options?.prefetch])

  const handleMouseLeave = useCallback(() => {
    cancelPrefetch()
  }, [cancelPrefetch])

  return {
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    isLoading: isLoading(href),
    href
  }
}

// Хук для skeleton контента
export function useSkeletonContent<T>(
  key: string,
  fetcher: () => Promise<T>,
  skeletonComponent?: React.ComponentType,
  options?: { ttl?: number; autoLoad?: boolean }
) {
  const { addLoadingState, removeLoadingState, isLoading } = useInstantNavigation()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { ttl = 5 * 60 * 1000, autoLoad = true } = options || {}

  const loadData = useCallback(async () => {
    addLoadingState(key)
    setError(null)

    try {
      // Проверяем кеш
      const cached = clientPageCache.get(key)
      if (cached && cached.expires > Date.now()) {
        setData(cached.data)
        removeLoadingState(key)
        return cached.data
      }

      // Загружаем данные
      const result = await fetcher()

      // Сохраняем в кеш
      clientPageCache.set(key, { data: result, expires: Date.now() + ttl })
      setData(result)

      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
      console.error(`❌ Failed to load content: ${key}`, err)
    } finally {
      removeLoadingState(key)
    }
  }, [key, fetcher, ttl, addLoadingState, removeLoadingState])

  useEffect(() => {
    if (autoLoad) {
      loadData()
    }
  }, [autoLoad, loadData])

  return {
    data,
    error,
    isLoading: isLoading(key),
    reload: loadData,
    SkeletonComponent: skeletonComponent
  }
}