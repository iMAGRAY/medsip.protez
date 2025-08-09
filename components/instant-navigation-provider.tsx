"use client"

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface InstantNavigationContextType {
  navigate: (path: string, options?: { replace?: boolean }) => void
  isNavigating: boolean
  targetPath: string | null
}

const InstantNavigationContext = createContext<InstantNavigationContextType | null>(null)

interface InstantNavigationProviderProps {
  children: React.ReactNode
}

export function InstantNavigationProvider({ children }: InstantNavigationProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const [targetPath, setTargetPath] = useState<string | null>(null)

  // Мгновенная навигация без моргания
  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    if (path === pathname) return

    setIsNavigating(true)
    setTargetPath(path)

    // Мгновенный переход
    if (options?.replace) {
      router.replace(path)
    } else {
      router.push(path)
    }
  }, [router, pathname])

  // Сброс состояния при завершении навигации
  useEffect(() => {
    setIsNavigating(false)
    setTargetPath(null)
  }, [pathname])

  const value: InstantNavigationContextType = {
    navigate,
    isNavigating,
    targetPath
  }

  return (
    <InstantNavigationContext.Provider value={value}>
      {children}

      {/* Глобальный индикатор загрузки */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
          <div className="h-full bg-gray-600 animate-pulse" style={{ width: '30%' }}>
            <div className="h-full bg-gradient-to-r from-transparent to-gray-800 animate-[loading_1s_ease-in-out_infinite]"></div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </InstantNavigationContext.Provider>
  )
}

export function useInstantNavigation() {
  const context = useContext(InstantNavigationContext)
  if (!context) {
    throw new Error('useInstantNavigation must be used within InstantNavigationProvider')
  }
  return context
}