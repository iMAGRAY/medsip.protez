"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface CartItem {
  id: string
  name: string
  price: number
  image_url: string
  quantity: number
  category?: string
  sku?: string
  article_number?: string
  custom_price?: number
  is_on_request?: boolean
  show_price?: boolean
  variant_id?: number
  variant_name?: string
  configuration?: Record<string, any> // Добавляем поле для конфигурации
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  updateCustomPrice: (id: string, customPrice: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

// Функция для создания уникального ключа товара с учетом конфигурации
function _getItemKey(item: Omit<CartItem, 'quantity'>): string {
  const baseKey = `${item.id}_${item.variant_id || 'no-variant'}`
  
  if (item.configuration && Object.keys(item.configuration).length > 0) {
    // Сортируем ключи конфигурации для консистентности
    const configKey = Object.keys(item.configuration)
      .sort()
      .map(key => `${key}:${item.configuration![key].value_id}`)
      .join('_')
    return `${baseKey}_${configKey}`
  }
  
  return baseKey
}

// Функция для сравнения конфигураций
function areConfigurationsEqual(config1?: Record<string, any>, config2?: Record<string, any>): boolean {
  // Если обе конфигурации пустые или отсутствуют
  if (!config1 && !config2) return true
  if (!config1 || !config2) return false
  
  const keys1 = Object.keys(config1).sort()
  const keys2 = Object.keys(config2).sort()
  
  if (keys1.length !== keys2.length) return false
  
  for (let i = 0; i < keys1.length; i++) {
    if (keys1[i] !== keys2[i]) return false
    if (config1[keys1[i]].value_id !== config2[keys2[i]].value_id) return false
  }
  
  return true
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isClient, setIsClient] = useState(false)

  // Устанавливаем флаг клиента
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Загружаем заявку из localStorage при монтировании
  useEffect(() => {
    if (!isClient) return

    const savedCart = localStorage.getItem('cart')
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart))
      } catch (error) {
        console.error('Ошибка загрузки заявки:', error)
      }
    }
  }, [isClient])

  // Сохраняем заявку в localStorage при изменении
  useEffect(() => {
    if (!isClient) return
    localStorage.setItem('cart', JSON.stringify(items))
  }, [items, isClient])

  const _addItem = (newItem: Omit<CartItem, 'quantity'>) => {
    setItems(current => {
      // Ищем существующий товар с такой же конфигурацией
      const existingItem = current.find(item => 
        item.id === newItem.id && 
        item.variant_id === newItem.variant_id &&
        areConfigurationsEqual(item.configuration, newItem.configuration)
      )
      
      if (existingItem) {
        // Увеличиваем количество существующего товара
        return current.map(item =>
          item === existingItem
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      
      // Добавляем новый товар с уникальной конфигурацией
      return [...current, { ...newItem, quantity: 1 }]
    })
  }

  const removeItem = (id: string) => {
    setItems(current => current.filter(item => item.id !== id))
  }

  const _updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
      return
    }
    setItems(current =>
      current.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    )
  }

  const _updateCustomPrice = (id: string, customPrice: number) => {
    setItems(current =>
      current.map(item =>
        item.id === id ? { ...item, custom_price: customPrice } : item
      )
    )
  }

  const _clearCart = () => {
    setItems([])
  }

  const _totalItems = items.reduce((total, item) => total + item.quantity, 0)
  const _totalPrice = items.reduce((total, item) => {
    // Товары "По запросу" не учитываются в итоговой сумме, цену устанавливает менеджер
    const itemPrice = item.is_on_request ? 0 : item.price
    return total + (itemPrice * item.quantity)
  }, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem: _addItem,
        removeItem,
        updateQuantity: _updateQuantity,
        updateCustomPrice: _updateCustomPrice,
        clearCart: _clearCart,
        totalItems: _totalItems,
        totalPrice: _totalPrice
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}