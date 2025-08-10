import { NextRequest, NextResponse } from 'next/server'
import { getCacheStats } from '@/lib/cache/cache-utils'
import { redisClient } from '@/lib/redis-client'
import { logger } from '@/lib/logger'

// GET /api/cache-status - получить статус Redis и статистику кеша
export async function GET(_request: NextRequest) {
  try {
    // Проверяем подключение к Redis
    const isConnected = await redisClient.ping()
    
    if (!isConnected) {
      return NextResponse.json({
        success: false,
        error: 'Redis is not connected',
        status: 'disconnected'
      }, { status: 503 })
    }

    // Получаем статистику кеша
    const _cacheStats = await getCacheStats()
    
    // Получаем дополнительную информацию о Redis
    const info = {
      connected: isConnected,
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || '6379',
      cacheStats: _cacheStats,
      timestamp: new Date().toISOString()
    }

    // Получаем примеры ключей для каждого типа кеша
    const sampleKeys: Record<string, string[]> = {}
    
    try {
      const keyTypes = ['api', 'product', 'category', 'page', 'media']
      
      for (const type of keyTypes) {
        const keys = await redisClient.keys(`${type}:*`)
        sampleKeys[type] = keys.slice(0, 5) // Берем только первые 5 ключей для примера
      }
    } catch (error) {
      logger.warn('Failed to get sample keys:', error)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...info,
        sampleKeys,
        features: {
          apiCaching: true,
          productCaching: true,
          categoryCaching: true,
          pageCaching: true,
          mediaCaching: true,
          cacheInvalidation: true,
          cacheMiddleware: true
        }
      }
    })

  } catch (error) {
    logger.error('Failed to get Redis status:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get Redis status',
        details: error.message 
      },
      { status: 500 }
    )
  }
}