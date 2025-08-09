"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface OrdersContextType {
  ordersCount: number | undefined
  refreshOrdersCount: () => Promise<void>
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [ordersCount, setOrdersCount] = useState<number | undefined>(undefined)

  const refreshOrdersCount = async () => {
    // Проверяем что мы на клиентской стороне
    if (typeof window === 'undefined') {

      return
    }

    try {

      // Проверяем доступность fetch
      if (typeof fetch === 'undefined') {
        throw new Error('Fetch API недоступен в этом браузере')
      }

      // Создаем AbortController для таймаута вручную для лучшей совместимости
      const controller = typeof AbortController !== 'undefined'
        ? new AbortController()
        : null
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), 10000) // 10 секунд
        : null

      const response = await fetch('/api/orders/count', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller?.signal,
      })

      if (timeoutId) {
        clearTimeout(timeoutId) // Очищаем таймаут если запрос успешен
      }

      console.log('📡 Ответ получен:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        setOrdersCount(data.data.total)

      } else {
        console.warn('⚠️ API вернул success: false:', data.error)
        setOrdersCount(0)
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки количества заказов:', {
        message: error.message,
        type: error.constructor.name,
        name: error.name,
        stack: error.stack,
        url: '/api/orders/count',
        timestamp: new Date().toISOString()
      })
      setOrdersCount(0)
    }
  }

  useEffect(() => {
    // Задержка для завершения гидрации
    const timer = setTimeout(() => {
      refreshOrdersCount()
    }, 100)

    const interval = setInterval(refreshOrdersCount, 30000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])

  return (
    <OrdersContext.Provider value={{ ordersCount, refreshOrdersCount }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider')
  }
  return context
}