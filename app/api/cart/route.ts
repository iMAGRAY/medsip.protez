import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { 
  getOrCreateCart, 
  getCart, 
  hasCart, 
  addItemToCart, 
  updateCartItemQuantity, 
  removeCartItem, 
  clearCart, 
  getCartStats,
  type Cart,
  type CartItem 
} from '@/lib/cart-storage'

// GET - получить корзину
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const cartId = cookieStore.get('cartId')?.value
    
    if (!cartId || !(await hasCart(cartId))) {
      return NextResponse.json({
        success: true,
        data: {
          id: null,
          items: [],
          total: 0,
          itemCount: 0
        }
      })
    }
    
    const cart = await getCart(cartId)
    if (!cart) {
      return NextResponse.json({
        success: true,
        data: {
          id: null,
          items: [],
          total: 0,
          itemCount: 0
        }
      })
    }
    const stats = getCartStats(cart)
    
    return NextResponse.json({
      success: true,
      data: {
        id: cart.id,
        items: cart.items,
        total: cart.total,
        itemCount: stats.itemCount
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения корзины'
    }, { status: 500 })
  }
}

// POST - добавить товар в корзину
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, variantId, name, price, quantity = 1, imageUrl, sku } = body
    
    // Валидация
    if (!productId || !name || price === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Недостаточно данных о продукте'
      }, { status: 400 })
    }
    
    if (quantity < 1) {
      return NextResponse.json({
        success: false,
        error: 'Количество должно быть больше 0'
      }, { status: 400 })
    }
    
    const cookieStore = await cookies()
    const cartId = cookieStore.get('cartId')?.value
    const cart = await getOrCreateCart(cartId)
    
    // Добавляем товар через общую функцию
    await addItemToCart(cart, {
      productId,
      variantId,
      name,
      price,
      quantity,
      imageUrl,
      sku
    })
    
    const stats = getCartStats(cart)
    
    // Устанавливаем cookie с ID корзины
    const response = NextResponse.json({
      success: true,
      data: {
        id: cart.id,
        items: cart.items,
        total: cart.total,
        itemCount: stats.itemCount
      }
    })
    
    response.cookies.set('cartId', cart.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 дней
    })
    
    return response
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка добавления в корзину'
    }, { status: 500 })
  }
}

// PUT - обновить количество товара
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, variantId, quantity } = body
    
    if (!productId || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Недостаточно данных'
      }, { status: 400 })
    }
    
    const cookieStore = await cookies()
    const cartId = cookieStore.get('cartId')?.value
    
    if (!cartId || !(await hasCart(cartId))) {
      return NextResponse.json({
        success: false,
        error: 'Корзина не найдена'
      }, { status: 404 })
    }
    
    const cart = await getCart(cartId)
    if (!cart) {
      return NextResponse.json({
        success: false,
        error: 'Корзина не найдена'
      }, { status: 404 })
    }
    
    const success = await updateCartItemQuantity(cart, productId, variantId, quantity)
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Товар не найден в корзине'
      }, { status: 404 })
    }
    
    const stats = getCartStats(cart)
    
    return NextResponse.json({
      success: true,
      data: {
        id: cart.id,
        items: cart.items,
        total: cart.total,
        itemCount: stats.itemCount
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка обновления корзины'
    }, { status: 500 })
  }
}

// DELETE - очистить корзину или удалить товар
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const productId = url.searchParams.get('productId')
    const variantId = url.searchParams.get('variantId')
    
    const cookieStore = await cookies()
    const cartId = cookieStore.get('cartId')?.value
    
    if (!cartId || !(await hasCart(cartId))) {
      return NextResponse.json({
        success: false,
        error: 'Корзина не найдена'
      }, { status: 404 })
    }
    
    const cart = await getCart(cartId)
    if (!cart) {
      return NextResponse.json({
        success: false,
        error: 'Корзина не найдена'
      }, { status: 404 })
    }
    
    if (productId) {
      // Удаляем конкретный товар
      await removeCartItem(cart, parseInt(productId), variantId ? parseInt(variantId) : null)
    } else {
      // Очищаем всю корзину
      await clearCart(cart)
    }
    
    const stats = getCartStats(cart)
    
    return NextResponse.json({
      success: true,
      data: {
        id: cart.id,
        items: cart.items,
        total: cart.total,
        itemCount: stats.itemCount
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка очистки корзины'
    }, { status: 500 })
  }
}