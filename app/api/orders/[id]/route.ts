import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getPool } from '@/lib/db-connection'
import { getCacheManager, getLogger } from '@/lib/dependency-injection'

// GET - получение деталей заказа
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const logger = getLogger()

  try {
    const orderId = parseInt(params.id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный ID заказа' },
        { status: 400 }
      )
    }

    // Получаем информацию о заказе
    const orderResult = await executeQuery(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Заказ не найден' },
        { status: 404 }
      )
    }

    const order = orderResult.rows[0]

    // Получаем товары в заказе
    const itemsResult = await executeQuery(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
      [orderId]
    )

    const orderDetails = {
      ...order,
      items: itemsResult.rows
    }

    logger.info('Order details loaded successfully', { orderId })

    return NextResponse.json({
      success: true,
      data: orderDetails
    })

  } catch (error) {
    logger.error('Ошибка получения деталей заказа:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT - обновление статуса заказа
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id)
    const body = await request.json()
    const { status, notes } = body

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный ID заказа' },
        { status: 400 }
      )
    }

    // Валидация статуса
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'deleted']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный статус заказа' },
        { status: 400 }
      )
    }

    // Обновляем заказ
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (status) {
      updateFields.push(`status = $${paramIndex}`)
      updateValues.push(status)
      paramIndex++
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`)
      updateValues.push(notes)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Нет данных для обновления' },
        { status: 400 }
      )
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(orderId)

    const updateQuery = `
      UPDATE orders
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await executeQuery(updateQuery, updateValues)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Заказ не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Заказ успешно обновлен'
    })

  } catch (error) {
    console.error('Ошибка обновления заказа:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE - удаление заказа
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный ID заказа' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const client = await pool.connect()

    try {
      // Начинаем транзакцию
      await client.query('BEGIN')

      // Проверяем существование заказа
      const orderCheck = await client.query(
        'SELECT id FROM orders WHERE id = $1',
        [orderId]
      )

      if (orderCheck.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { success: false, error: 'Заказ не найден' },
          { status: 404 }
        )
      }

      // Удаляем товары заказа (order_items)
      await client.query(
        'DELETE FROM order_items WHERE order_id = $1',
        [orderId]
      )

      // Удаляем сам заказ
      const deleteResult = await client.query(
        'DELETE FROM orders WHERE id = $1 RETURNING id',
        [orderId]
      )

      // Подтверждаем транзакцию
      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Заказ #${orderId} успешно удален`,
        data: { deletedOrderId: orderId }
      })

    } catch (dbError) {
      // Откатываем транзакцию в случае ошибки
      await client.query('ROLLBACK')
      throw dbError
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Ошибка удаления заказа:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}