import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db-connection'
import { getCacheManager, getLogger } from '@/lib/dependency-injection'

// PUT - обновление цены товара в заказе
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const logger = getLogger()
  const cacheManager = getCacheManager()

  try {
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.id)
    const itemId = parseInt(resolvedParams.itemId)
    const body = await request.json()
    const { custom_price, status, notes } = body

    if (isNaN(orderId) || isNaN(itemId)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный ID заказа или товара' },
        { status: 400 }
      )
    }

    // Валидация в зависимости от того, что обновляем
    if (custom_price !== undefined && (typeof custom_price !== 'number' || custom_price < 0)) {
      return NextResponse.json(
        { success: false, error: 'Некорректная цена товара' },
        { status: 400 }
      )
    }

    if (status !== undefined) {
      const validStatuses = ['pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled', 'out_of_stock', '']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Некорректный статус товара' },
          { status: 400 }
        )
      }
    }

    const pool = getPool()
    const client = await pool.connect()

    try {
      // Начинаем транзакцию
      await client.query('BEGIN')

      // Формируем динамический запрос для обновления
      const updateFields = []
      const updateValues = []
      let paramIndex = 1

      if (custom_price !== undefined) {
        updateFields.push(`custom_price = $${paramIndex}`)
        updateValues.push(custom_price)
        paramIndex++

        updateFields.push(`product_price = $${paramIndex}`)
        updateValues.push(custom_price)
        paramIndex++

        updateFields.push(`total_price = $${paramIndex} * quantity`)
        updateValues.push(custom_price)
        paramIndex++
      }

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex}`)
        updateValues.push(status === '' ? null : status)
        paramIndex++
      }

      if (notes !== undefined) {
        updateFields.push(`notes = $${paramIndex}`)
        updateValues.push(notes === '' ? null : notes)
        paramIndex++
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
      updateValues.push(itemId, orderId)

      const updateQuery = `
        UPDATE order_items
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND order_id = $${paramIndex + 1}
        RETURNING *
      `

      const updateItemResult = await client.query(updateQuery, updateValues)

      if (updateItemResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { success: false, error: 'Товар в заказе не найден' },
          { status: 404 }
        )
      }

      let newTotal = 0

      // Пересчитываем общую сумму заказа только если изменилась цена
      if (custom_price !== undefined) {
        const totalResult = await client.query(
          'SELECT SUM(total_price) as total FROM order_items WHERE order_id = $1',
          [orderId]
        )

        newTotal = parseFloat(totalResult.rows[0].total) || 0

        // Обновляем общую сумму заказа
        await client.query(
          'UPDATE orders SET total_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newTotal, orderId]
        )
      }

      // Подтверждаем транзакцию
      await client.query('COMMIT')

      // Очищаем кэш заказов
      cacheManager.clear()

      const logData: any = { orderId, itemId }
      if (custom_price !== undefined) logData.newPrice = custom_price
      if (status !== undefined) logData.newStatus = status
      if (notes !== undefined) logData.notes = notes

      logger.info('Order item updated successfully', logData)

      const _message = custom_price !== undefined
        ? 'Цена товара обновлена'
        : status !== undefined
          ? 'Статус товара обновлен'
          : notes !== undefined
            ? 'Заметка сохранена'
            : 'Товар обновлен'

      return NextResponse.json({
        success: true,
        data: {
          item: updateItemResult.rows[0],
          newTotal: custom_price !== undefined ? newTotal : undefined,
          message: _message
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
    logger.error('Ошибка обновления цены товара в заказе:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}