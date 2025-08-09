import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getPool } from '@/lib/db-connection'
import { getCacheManager, getLogger } from '@/lib/dependency-injection'

// POST - создание нового заказа
export async function POST(request: NextRequest) {
  const logger = getLogger()
  const cacheManager = getCacheManager()

  try {
    const body = await request.json()
    const { customer_phone, customer_email, total_amount, notes, items } = body

    // Валидация данных - допускаем сумму 0, но проверяем наличие полей и товаров
    if (
      !customer_phone || customer_phone.trim() === '' ||
      !customer_email || customer_email.trim() === '' ||
      !items || !Array.isArray(items) || items.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'Не все обязательные поля заполнены' },
        { status: 400 }
      )
    }

    // total_amount может быть 0, но не должен быть отрицательным и должен быть числом
    if (typeof total_amount !== 'number' || isNaN(total_amount) || total_amount < 0) {
      return NextResponse.json(
        { success: false, error: 'Некорректная сумма заказа' },
        { status: 400 }
      )
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customer_email)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный email адрес' },
        { status: 400 }
      )
    }

    // Валидация телефона
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/
    if (!phoneRegex.test(customer_phone)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный номер телефона' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const client = await pool.connect()

    try {
      // Начинаем транзакцию
      await client.query('BEGIN')

      // Создаем заказ
      const orderResult = await client.query(
        `INSERT INTO orders (customer_phone, customer_email, total_amount, notes, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, created_at`,
        [customer_phone, customer_email, total_amount, notes || '', 'pending']
      )

      const orderId = orderResult.rows[0].id
      const createdAt = orderResult.rows[0].created_at

      // Добавляем товары в заказ (статус не устанавливается по умолчанию)
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, product_price, product_image_url, quantity, total_price, sku, article_number, is_on_request, variant_id, configuration, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
          [
            orderId,
            item.product_id,
            item.product_name,
            item.product_price,
            item.product_image_url || '',
            item.quantity,
            item.total_price,
            item.sku || '',
            item.article_number || '',
            item.is_on_request || false,
            item.variant_id || null,
            item.configuration ? JSON.stringify(item.configuration) : null
          ]
        )
      }

      // Подтверждаем транзакцию
      await client.query('COMMIT')

      // Очищаем кэш заказов
      cacheManager.clear()

      logger.info('Order created successfully', { orderId })

      return NextResponse.json({
        success: true,
        data: {
          orderId,
          createdAt,
          message: 'Заказ успешно создан'
        }
      })

    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Ошибка создания заказа:', error)

    // Возвращаем более информативное сообщение об ошибке в dev режиме
    const isDev = process.env.NODE_ENV === 'development'
    const errorMessage = isDev
      ? `Ошибка базы данных: ${error?.message || 'Неизвестная ошибка'}`
      : 'Внутренняя ошибка сервера'

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// GET - получение списка заказов (для админ панели)
export async function GET(request: NextRequest) {
  const logger = getLogger()
  const cacheManager = getCacheManager()

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const offset = (page - 1) * limit

    const pool = getPool()
    const client = await pool.connect()

    try {
      // Формируем WHERE условие
      let whereClause = ''
      let queryParams: any[] = []

      if (status && status !== 'all') {
        whereClause = 'WHERE o.status = $1'
        queryParams.push(status)
      }

      // Получаем заказы с количеством товаров
      const ordersQuery = `
        SELECT
          o.id,
          o.customer_phone,
          o.customer_email,
          o.total_amount,
          o.status,
          o.created_at,
          o.updated_at,
          o.notes,
          COUNT(oi.id) as items_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        ${whereClause}
        GROUP BY o.id, o.customer_phone, o.customer_email, o.total_amount, o.status, o.created_at, o.updated_at, o.notes
        ORDER BY o.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `

      queryParams.push(limit, offset)
      const ordersResult = await client.query(ordersQuery, queryParams)

      // Получаем общее количество заказов
      const countQuery = `SELECT COUNT(*) FROM orders o ${whereClause}`
      const countParams = status && status !== 'all' ? [status] : []
      const countResult = await client.query(countQuery, countParams)
      const totalOrders = parseInt(countResult.rows[0].count)

      return NextResponse.json({
        success: true,
        data: {
          orders: ordersResult.rows,
          pagination: {
            page,
            limit,
            total: totalOrders,
            pages: Math.ceil(totalOrders / limit)
          }
        }
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Ошибка получения заказов:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}