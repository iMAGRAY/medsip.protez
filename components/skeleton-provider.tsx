"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useInstantNavigation } from '@/hooks/use-instant-navigation'
import {
  ProductPageSkeleton,
  CategoryPageSkeleton,
  AdminTableSkeleton,
  ProductFormSkeleton,
  MediaGallerySkeleton,
  DashboardSkeleton
} from '@/components/skeletons/page-skeletons'

interface SkeletonContextType {
  isPageLoading: boolean
  loadingComponents: Set<string>
  registerPageSkeleton: (path: string, component: React.ComponentType) => void
  getPageSkeleton: (path: string) => React.ComponentType | null
  setComponentLoading: (key: string, loading: boolean) => void
  isComponentLoading: (key: string) => boolean
}

const SkeletonContext = createContext<SkeletonContextType | null>(null)

// Карта skeleton компонентов по путям
const defaultSkeletonMap = new Map<string | RegExp, React.ComponentType>([
          // Страницы товаров
  [/^\/products\/\d+$/, ProductPageSkeleton],
  ['/products', CategoryPageSkeleton],

  // Категории
  [/^\/categories/, CategoryPageSkeleton],
  [/^\/manufacturers/, CategoryPageSkeleton],

  // Админ панель
  ['/admin', DashboardSkeleton],
  ['/admin/products', AdminTableSkeleton],
  ['/admin/categories', AdminTableSkeleton],
  ['/admin/manufacturers', AdminTableSkeleton],
  ['/admin/specifications', AdminTableSkeleton],
  ['/admin/media', MediaGallerySkeleton],
  [/^\/admin\/products\/\d+\/edit$/, ProductFormSkeleton],
  ['/admin/products/create', ProductFormSkeleton],

  // Другие страницы
  ['/about', CategoryPageSkeleton],
  ['/contacts', CategoryPageSkeleton],
])

interface SkeletonProviderProps {
  children: React.ReactNode
  enableInstantNavigation?: boolean
  skeletonTimeout?: number
}

export function SkeletonProvider({
  children,
  enableInstantNavigation = true,
  skeletonTimeout = 200
}: SkeletonProviderProps) {
  const pathname = usePathname()
  const [customSkeletonMap, setCustomSkeletonMap] = useState(new Map<string, React.ComponentType>())
  const [loadingComponents, setLoadingComponents] = useState(new Set<string>())
  const [isPageLoading, setIsPageLoading] = useState(false)

  const {
    isNavigating,
    targetPath,
    registerSkeleton: registerNavigationSkeleton
  } = useInstantNavigation({
    enableSkeleton: enableInstantNavigation
  })

  // Регистрация skeleton компонента для пути
  const registerPageSkeleton = (path: string, component: React.ComponentType) => {
    setCustomSkeletonMap(prev => new Map(prev).set(path, component))
    registerNavigationSkeleton(path, component)
  }

  // Получение skeleton компонента для пути
  const getPageSkeleton = (path: string): React.ComponentType | null => {
    // Сначала проверяем кастомные skeleton
    if (customSkeletonMap.has(path)) {
      return customSkeletonMap.get(path)!
    }

    // Затем проверяем дефолтные skeleton
    for (const [pattern, component] of defaultSkeletonMap) {
      if (typeof pattern === 'string') {
        if (pattern === path) {
          return component
        }
      } else {
        if (pattern.test(path)) {
          return component
        }
      }
    }

    return null
  }

  // Управление состоянием загрузки компонентов
  const setComponentLoading = (key: string, loading: boolean) => {
    setLoadingComponents(prev => {
      const newSet = new Set(prev)
      if (loading) {
        newSet.add(key)
      } else {
        newSet.delete(key)
      }
      return newSet
    })
  }

  const isComponentLoading = (key: string) => {
    return loadingComponents.has(key)
  }

  // Управление состоянием загрузки страницы
  useEffect(() => {
    if (isNavigating && targetPath) {
      const timer = setTimeout(() => {
        setIsPageLoading(true)
      }, skeletonTimeout)

      return () => {
        clearTimeout(timer)
        setIsPageLoading(false)
      }
    } else {
      setIsPageLoading(false)
      return () => {} // Пустая функция очистки для консистентности
    }
  }, [isNavigating, targetPath, skeletonTimeout])

  // Сброс состояния при смене пути
  useEffect(() => {
    setIsPageLoading(false)
    setLoadingComponents(new Set())
  }, [pathname])

  const contextValue: SkeletonContextType = {
    isPageLoading,
    loadingComponents,
    registerPageSkeleton,
    getPageSkeleton,
    setComponentLoading,
    isComponentLoading
  }

  return (
    <SkeletonContext.Provider value={contextValue}>
      {children}
    </SkeletonContext.Provider>
  )
}

// Хук для использования skeleton контекста
export function useSkeleton() {
  const context = useContext(SkeletonContext)
  if (!context) {
    throw new Error('useSkeleton must be used within a SkeletonProvider')
  }
  return context
}

// Компонент для отображения skeleton содержимого
interface SkeletonContentProps {
  isLoading?: boolean
  skeleton?: React.ComponentType
  children: React.ReactNode
  fallback?: React.ReactNode
  minHeight?: string
  className?: string
}

export function SkeletonContent({
  isLoading = false,
  skeleton: SkeletonComponent,
  children,
  fallback,
  minHeight = 'auto',
  className = ''
}: SkeletonContentProps): React.ReactNode {
  if (isLoading) {
    if (SkeletonComponent) {
      return (
        <div className={className} style={{ minHeight }}>
          <SkeletonComponent />
        </div>
      )
    }

    if (fallback) {
      return (
        <div className={className} style={{ minHeight }}>
          {fallback}
        </div>
      )
    }

    // Если нет ни skeleton компонента ни fallback, показываем детей
    return <>{children}</>
  }

  return <>{children}</>
}

// Компонент для автоматического skeleton на основе пути
interface AutoSkeletonProps {
  path?: string
  isLoading?: boolean
  children: React.ReactNode
  className?: string
}

export function AutoSkeleton({
  path,
  isLoading = false,
  children,
  className = ''
}: AutoSkeletonProps) {
  const { getPageSkeleton } = useSkeleton()
  const pathname = usePathname()
  const targetPath = path || pathname

  const SkeletonComponent = targetPath ? getPageSkeleton(targetPath) : null

  if (isLoading && SkeletonComponent) {
    return (
      <div className={className}>
        <SkeletonComponent />
      </div>
    )
  }

  return <>{children}</>
}

// HOC для обертывания компонентов с автоматическим skeleton
export function withSkeleton<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  skeletonComponent?: React.ComponentType,
  options?: {
    loadingProp?: keyof P
    minHeight?: string
  }
) {
  const { loadingProp = 'isLoading' as keyof P, minHeight } = options || {}

  return function SkeletonWrappedComponent(props: P) {
    const isLoading = Boolean(props[loadingProp])

    return (
      <SkeletonContent
        isLoading={isLoading}
        skeleton={skeletonComponent}
        minHeight={minHeight}
      >
        <WrappedComponent {...props} />
      </SkeletonContent>
    )
  }
}