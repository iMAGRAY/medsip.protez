import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { pool } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { getCart, hasCart, clearCart } from '@/lib/cart-storage'

// Временное хранилище заказов
const orders = new Map<string, any>()

interface OrderCustomer {
  name: string
  email: string
  phone: string
  address?: string
}

interface OrderDelivery {
  type: 'pickup' | 'delivery'
  address?: string
  date?: string
  time?: string
  comment?: string
}

interface OrderPayment {
  method?: 'cash' | 'card' | 'online'
  status?: 'pending' | 'paid' | 'failed'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      cartId: providedCartId,
      customer,
      delivery,
      payment = { method: 'cash', status: 'pending' },
      comment
    } = body
    
    // Валидация данных клиента
    if (!customer || !customer.name || !customer.email || !customer.phone) {
      return NextResponse.json({
        success: false,
        error: 'Необходимо указать имя, email и телефон'
      }, { status: 400 })
    }
    
    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customer.email)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный формат email'
      }, { status: 400 })
    }
    
    // Валидация телефона
    const phoneRegex = /^[\d\s\-\+\(\)]+$/
    if (!phoneRegex.test(customer.phone)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный формат телефона'
      }, { status: 400 })
    }
    
    // Валидация доставки
    if (!delivery || !delivery.type) {
      return NextResponse.json({
        success: false,
        error: 'Необходимо указать способ доставки'
      }, { status: 400 })
    }
    
    if (delivery.type === 'delivery' && !delivery.address) {
      return NextResponse.json({
        success: false,
        error: 'Для доставки необходимо указать адрес'
      }, { status: 400 })
    }
    
    // Получаем корзину
    const cookieStore = await cookies()
    const cookieCartId = cookieStore.get('cartId')?.value
    const cartId = providedCartId || cookieCartId
    
    if (!cartId || !(await hasCart(cartId))) {
      return NextResponse.json({
        success: false,
        error: 'Корзина не найдена или пуста'
      }, { status: 404 })
    }
    
    const cart = await getCart(cartId)
    if (!cart) {
      return NextResponse.json({
        success: false,
        error: 'Корзина не найдена'
      }, { status: 404 })
    }
    
    if (!cart.items || cart.items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Корзина пуста'
      }, { status: 400 })
    }
    
    // Создаем заказ
    const orderId = uuidv4()
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    
    const order = {
      id: orderId,
      orderNumber,
      status: 'pending',
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address || delivery.address
      },
      delivery: {
        type: delivery.type,
        address: delivery.address,
        date: delivery.date,
        time: delivery.time,
        comment: delivery.comment
      },
      payment: {
        method: payment.method || 'cash',
        status: payment.status || 'pending',
        amount: cart.total
      },
      items: cart.items.map((item: any) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        sku: item.sku
      })),
      subtotal: cart.total,
      deliveryFee: delivery.type === 'delivery' ? 500 : 0, // Фиксированная стоимость доставки
      discount: 0,
      total: cart.total + (delivery.type === 'delivery' ? 500 : 0),
      comment,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Сохраняем заказ
    orders.set(orderId, order)
    
    // Очищаем корзину после создания заказа
    await clearCart(cart)
    
    // Отправляем подтверждение (в реальном приложении отправить email)
    
    // Формируем ответ
    const response = NextResponse.json({
      success: true,
      message: 'Заказ успешно создан',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        estimatedDelivery: delivery.date || 'В течение 3-5 рабочих дней',
        customer: {
          name: customer.name,
          email: customer.email
        }
      }
    })
    
    // Очищаем cookie корзины
    response.cookies.delete('cartId')
    
    return response
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка создания заказа'
    }, { status: 500 })
  }
}

// GET - получить информацию о заказе
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const orderId = url.searchParams.get('orderId')
    const orderNumber = url.searchParams.get('orderNumber')
    
    if (!orderId && !orderNumber) {
      return NextResponse.json({
        success: false,
        error: 'Необходимо указать ID или номер заказа'
      }, { status: 400 })
    }
    
    let order
    
    if (orderId) {
      order = orders.get(orderId)
    } else if (orderNumber) {
      // Поиск по номеру заказа
      for (const [id, o] of orders.entries()) {
        if (o.orderNumber === orderNumber) {
          order = o
          break
        }
      }
    }
    
    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Заказ не найден'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        customer: order.customer,
        delivery: order.delivery,
        payment: order.payment,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        total: order.total,
        comment: order.comment,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения заказа'
    }, { status: 500 })
  }
}