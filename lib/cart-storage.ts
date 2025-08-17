import { v4 as uuidv4 } from 'uuid'
import { redisClient } from '@/lib/clients/redis-client'

export interface CartItem {
  productId: number
  variantId?: number | null
  name: string
  price: number
  quantity: number
  imageUrl?: string
  sku?: string
}

export interface Cart {
  id: string
  items: CartItem[]
  createdAt: Date
  updatedAt: Date
  total: number
}

// Fallback хранилище в памяти для случаев когда Redis недоступен
const memoryFallback = new Map<string, Cart>()

// Конфигурация
const CART_TTL = 7 * 24 * 60 * 60 // 7 дней в секундах
const CART_PREFIX = 'cart:'

// Утилиты для работы с Redis
function getCartKey(cartId: string): string {
  return `${CART_PREFIX}${cartId}`
}

// Сериализация/десериализация
function serializeCart(cart: Cart): string {
  // Убеждаемся что даты существуют
  const now = new Date()
  return JSON.stringify({
    ...cart,
    createdAt: (cart.createdAt || now).toISOString(),
    updatedAt: (cart.updatedAt || now).toISOString()
  })
}

function deserializeCart(data: string): Cart {
  const parsed = JSON.parse(data)
  return {
    ...parsed,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt)
  }
}

// Проверка доступности Redis
async function isRedisAvailable(): Promise<boolean> {
  return await redisClient.ping()
}

// Очистка старых корзин (запускается периодически)
export async function cleanupOldCarts(): Promise<void> {
  try {
    const isRedisUp = await isRedisAvailable()
    
    if (isRedisUp) {
      // Redis автоматически удалит просроченные ключи через TTL
      return
    }
    
    // Очистка memory fallback
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 часа
    
    for (const [id, cart] of memoryFallback.entries()) {
      if (now - cart.createdAt.getTime() > maxAge) {
        memoryFallback.delete(id)
      }
    }
  } catch (error) {
    console.error('Error cleaning up carts:', error)
  }
}

// Получение или создание корзины
export async function getOrCreateCart(cartId?: string): Promise<Cart> {
  try {
    await cleanupOldCarts()
    
    const isRedisUp = await isRedisAvailable()
    
    if (cartId && isRedisUp) {
      // Пытаемся получить из Redis
      const cartData = await redisClient.get(getCartKey(cartId))
      if (cartData) {
        return deserializeCart(cartData)
      }
    } else if (cartId && memoryFallback.has(cartId)) {
      // Fallback к памяти
      return memoryFallback.get(cartId)!
    }
    
    // Создаем новую корзину
    const newCart: Cart = {
      id: uuidv4(),
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      total: 0
    }
    
    // Сохраняем в Redis или память
    await saveCart(newCart)
    return newCart
  } catch (error) {
    console.error('Error in getOrCreateCart:', error)
    // В случае ошибки создаем корзину только в памяти
    const newCart: Cart = {
      id: uuidv4(),
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      total: 0
    }
    memoryFallback.set(newCart.id, newCart)
    return newCart
  }
}

// Получение корзины по ID
export async function getCart(cartId: string): Promise<Cart | undefined> {
  try {
    await cleanupOldCarts()
    
    const isRedisUp = await isRedisAvailable()
    
    if (isRedisUp) {
      const cartData = await redisClient.get(getCartKey(cartId))
      if (cartData) {
        return deserializeCart(cartData)
      }
    }
    
    // Fallback к памяти
    return memoryFallback.get(cartId)
  } catch (error) {
    console.error('Error getting cart:', error)
    return memoryFallback.get(cartId)
  }
}

// Проверка существования корзины
export async function hasCart(cartId: string): Promise<boolean> {
  try {
    const cart = await getCart(cartId)
    return cart !== undefined
  } catch (error) {
    console.error('Error checking cart existence:', error)
    return false
  }
}

// Сохранение корзины
export async function saveCart(cart: Cart): Promise<void> {
  try {
    cart.updatedAt = new Date()
    
    const isRedisUp = await isRedisAvailable()
    
    if (isRedisUp) {
      // Сохраняем в Redis с TTL
      const serialized = serializeCart(cart)
      await redisClient.set(getCartKey(cart.id), serialized, { EX: CART_TTL })
    }
    
    // Всегда дублируем в память как fallback
    memoryFallback.set(cart.id, cart)
  } catch (error) {
    console.error('Error saving cart:', error)
    // В случае ошибки сохраняем только в память
    memoryFallback.set(cart.id, cart)
  }
}

// Удаление корзины
export async function deleteCart(cartId: string): Promise<boolean> {
  try {
    const isRedisUp = await isRedisAvailable()
    let redisDeleted = false
    
    if (isRedisUp) {
      redisDeleted = await redisClient.del(getCartKey(cartId))
    }
    
    const memoryDeleted = memoryFallback.delete(cartId)
    
    return redisDeleted || memoryDeleted
  } catch (error) {
    console.error('Error deleting cart:', error)
    return memoryFallback.delete(cartId)
  }
}

// Пересчет итоговой суммы
export function recalculateTotal(cart: Cart): void {
  // Убеждаемся что items массив
  if (!Array.isArray(cart.items)) {
    cart.items = []
  }
  
  cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  cart.updatedAt = new Date()
}

// Добавление товара в корзину
export async function addItemToCart(cart: Cart, item: CartItem): Promise<void> {
  // Убеждаемся что items массив
  if (!Array.isArray(cart.items)) {
    cart.items = []
  }
  
  // Проверяем, есть ли уже этот товар в корзине
  const existingItem = cart.items.find(existing => 
    existing.productId === item.productId && existing.variantId === item.variantId
  )
  
  if (existingItem) {
    // Увеличиваем количество
    existingItem.quantity += item.quantity
  } else {
    // Добавляем новый товар
    cart.items.push(item)
  }
  
  recalculateTotal(cart)
  await saveCart(cart)
}

// Обновление количества товара в корзине
export async function updateCartItemQuantity(cart: Cart, productId: number, variantId: number | null, quantity: number): Promise<boolean> {
  const item = cart.items.find(item => 
    item.productId === productId && item.variantId === variantId
  )
  
  if (!item) {
    return false
  }
  
  if (quantity <= 0) {
    // Удаляем товар из корзины
    cart.items = cart.items.filter(item => 
      !(item.productId === productId && item.variantId === variantId)
    )
  } else {
    // Обновляем количество
    item.quantity = quantity
  }
  
  recalculateTotal(cart)
  await saveCart(cart)
  return true
}

// Удаление товара из корзины
export async function removeCartItem(cart: Cart, productId: number, variantId?: number | null): Promise<boolean> {
  const initialLength = cart.items.length
  
  cart.items = cart.items.filter(item => 
    !(item.productId === productId && 
      (!variantId || item.variantId === variantId))
  )
  
  if (cart.items.length !== initialLength) {
    recalculateTotal(cart)
    await saveCart(cart)
    return true
  }
  
  return false
}

// Очистка корзины
export async function clearCart(cart: Cart): Promise<void> {
  cart.items = []
  recalculateTotal(cart)
  await saveCart(cart)
}

// Получение статистики корзины
export function getCartStats(cart: Cart): { itemCount: number; total: number } {
  // Убеждаемся что items массив
  const items = Array.isArray(cart.items) ? cart.items : []
  
  return {
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: cart.total || 0
  }
}

// Получение всех корзин для администрирования
export async function getAllCarts(): Promise<Cart[]> {
  try {
    const isRedisUp = await isRedisAvailable()
    const carts: Cart[] = []
    
    if (isRedisUp) {
      // Получаем все ключи корзин из Redis
      const keys = await redisClient.keys(`${CART_PREFIX}*`)
      
      for (const key of keys) {
        const cartData = await redisClient.get(key)
        if (cartData) {
          carts.push(deserializeCart(cartData))
        }
      }
    }
    
    // Добавляем корзины из памяти (если есть уникальные)
    for (const cart of memoryFallback.values()) {
      if (!carts.find(c => c.id === cart.id)) {
        carts.push(cart)
      }
    }
    
    return carts
  } catch (error) {
    console.error('Error getting all carts:', error)
    return Array.from(memoryFallback.values())
  }
}

// Статистика хранилища корзин
export async function getCartStorageStats(): Promise<{
  redisAvailable: boolean
  redisCartCount: number
  memoryCartCount: number
  totalCarts: number
}> {
  try {
    const isRedisUp = await isRedisAvailable()
    let redisCartCount = 0
    
    if (isRedisUp) {
      const keys = await redisClient.keys(`${CART_PREFIX}*`)
      redisCartCount = keys.length
    }
    
    const memoryCartCount = memoryFallback.size
    
    return {
      redisAvailable: isRedisUp,
      redisCartCount,
      memoryCartCount,
      totalCarts: Math.max(redisCartCount, memoryCartCount) // Учитываем дублирование
    }
  } catch (error) {
    console.error('Error getting cart storage stats:', error)
    return {
      redisAvailable: false,
      redisCartCount: 0,
      memoryCartCount: memoryFallback.size,
      totalCarts: memoryFallback.size
    }
  }
}