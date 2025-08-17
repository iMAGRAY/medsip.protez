import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { getCacheManager, getLogger } from '@/lib/dependency-injection'

export async function GET(_request: NextRequest) {
  const logger = getLogger()
  const cacheManager = getCacheManager()

  try {

    const cacheKey = 'orders:count'
    const cached = cacheManager.get(cacheKey)

    if (cached) {
      logger.info('Cache hit for orders count')

      return NextResponse.json(cached)
    }

    const result = await executeQuery('SELECT COUNT(*) as total FROM orders')
    const _total = parseInt(result.rows[0].total)

    const responseData = {
      success: true,
      data: { total: _total }
    }

    // Кэшируем результат на 1 минуту
    cacheManager.set(cacheKey, responseData, 60000)

    logger.info('Orders count loaded successfully', { total: _total })

    return NextResponse.json(responseData)

  } catch (error) {
    logger.error('Ошибка получения количества заказов:', error)
    // Возвращаем fallback данные если БД недоступна
    const fallbackData = {
      success: true,
      data: { total: 0 },
      fallback: true,
      error: 'Database unavailable'
    }

    return NextResponse.json(fallbackData)
  }
}