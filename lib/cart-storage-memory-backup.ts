import { v4 as uuidv4 } from 'uuid'

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

// Единое хранилище корзин для всех API endpoints
const carts = new Map<string, Cart>()

// Очистка старых корзин (старше 24 часов)
export function cleanupOldCarts(): void {
  const now = Date.now()
  const maxAge = 24 * 60 * 60 * 1000 // 24 часа
  
  for (const [id, cart] of carts.entries()) {
    if (now - cart.createdAt.getTime() > maxAge) {
      carts.delete(id)
    }
  }
}

// Получение или создание корзины
export function getOrCreateCart(cartId?: string): Cart {
  cleanupOldCarts()
  
  if (cartId && carts.has(cartId)) {
    return carts.get(cartId)!
  }
  
  const newCart: Cart = {
    id: uuidv4(),
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    total: 0
  }
  
  carts.set(newCart.id, newCart)
  return newCart
}

// Получение корзины по ID
export function getCart(cartId: string): Cart | undefined {
  cleanupOldCarts()
  return carts.get(cartId)
}

// Проверка существования корзины
export function hasCart(cartId: string): boolean {
  cleanupOldCarts()
  return carts.has(cartId)
}

// Сохранение корзины
export function saveCart(cart: Cart): void {
  cart.updatedAt = new Date()
  carts.set(cart.id, cart)
}

// Удаление корзины
export function deleteCart(cartId: string): boolean {
  return carts.delete(cartId)
}

// Пересчет итоговой суммы
export function recalculateTotal(cart: Cart): void {
  cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  cart.updatedAt = new Date()
}

// Добавление товара в корзину
export function addItemToCart(cart: Cart, item: CartItem): void {
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
}

// Обновление количества товара в корзине
export function updateCartItemQuantity(cart: Cart, productId: number, variantId: number | null, quantity: number): boolean {
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
  return true
}

// Удаление товара из корзины
export function removeCartItem(cart: Cart, productId: number, variantId?: number | null): boolean {
  const initialLength = cart.items.length
  
  cart.items = cart.items.filter(item => 
    !(item.productId === productId && 
      (!variantId || item.variantId === variantId))
  )
  
  if (cart.items.length !== initialLength) {
    recalculateTotal(cart)
    return true
  }
  
  return false
}

// Очистка корзины
export function clearCart(cart: Cart): void {
  cart.items = []
  recalculateTotal(cart)
}

// Получение статистики корзины
export function getCartStats(cart: Cart): { itemCount: number; total: number } {
  return {
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    total: cart.total
  }
}