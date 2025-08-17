import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { pool } from '@/lib/db'
import { 
  getOrCreateCart, 
  addItemToCart, 
  getCartStats,
  type CartItem 
} from '@/lib/cart-storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, variantId, quantity = 1 } = body
    
    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'ID продукта обязателен'
      }, { status: 400 })
    }
    
    if (quantity < 1) {
      return NextResponse.json({
        success: false,
        error: 'Количество должно быть больше 0'
      }, { status: 400 })
    }
    
    // Получаем информацию о продукте из БД
    let productData
    
    if (variantId) {
      // Если указан вариант, получаем его данные
      const variantResult = await pool.query(`
        SELECT 
          v.id as variant_id,
          v.name as variant_name,
          v.sku as variant_sku,
          COALESCE(v.price_override, v.price, p.price) as price,
          v.primary_image_url as image_url,
          p.id as product_id,
          p.name as product_name
        FROM product_variants v
        JOIN products p ON v.master_id = p.id
        WHERE v.id = $1 AND p.id = $2
          AND (v.is_deleted = false OR v.is_deleted IS NULL)
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
      `, [variantId, productId])
      
      if (variantResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Вариант продукта не найден'
        }, { status: 404 })
      }
      
      productData = variantResult.rows[0]
    } else {
      // Получаем данные основного продукта
      const productResult = await pool.query(`
        SELECT 
          id as product_id,
          name as product_name,
          sku,
          price,
          image_url
        FROM products
        WHERE id = $1
          AND (is_deleted = false OR is_deleted IS NULL)
      `, [productId])
      
      if (productResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Продукт не найден'
        }, { status: 404 })
      }
      
      productData = productResult.rows[0]
    }
    
    // Получаем или создаем корзину
    const cookieStore = await cookies()
    const cartId = cookieStore.get('cartId')?.value
    const cart = await getOrCreateCart(cartId)
    
    const price = parseFloat(productData.price) || 0
    
    // Добавляем товар через общую функцию
    const cartItem: CartItem = {
      productId: productData.product_id,
      variantId: productData.variant_id || null,
      name: productData.variant_name || productData.product_name,
      price: price,
      quantity: quantity,
      imageUrl: productData.image_url,
      sku: productData.variant_sku || productData.sku
    }
    
    await addItemToCart(cart, cartItem)
    
    const stats = getCartStats(cart)
    
    // Формируем ответ
    const response = NextResponse.json({
      success: true,
      message: 'Товар добавлен в корзину',
      data: {
        cartId: cart.id,
        itemCount: stats.itemCount,
        total: cart.total,
        addedItem: {
          productId: productData.product_id,
          variantId: productData.variant_id || null,
          name: productData.variant_name || productData.product_name,
          quantity: quantity,
          price: price
        }
      }
    })
    
    // Устанавливаем cookie с ID корзины
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
      error: 'Ошибка добавления товара в корзину'
    }, { status: 500 })
  }
}