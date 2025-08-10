import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Серверный кеш для API endpoints
const serverCache = new Map<string, { data: any; expires: number }>()

// Утилиты для работы с серверным кешем
const cacheUtils = {
  get: (key: string) => {
    const cached = serverCache.get(key)
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }
    if (cached) {
      serverCache.delete(key) // Удаляем истекший кеш
    }
    return null
  },

  set: (key: string, _data: any, ttl: number = 300) => { // TTL в секундах
    serverCache.set(key, {
      data,
      expires: Date.now() + (ttl * 1000)
    })
  },

  delete: (key: string) => {
    return serverCache.delete(key)
  },

  clear: () => {
    serverCache.clear()
  },

  getStats: () => {
    let validEntries = 0
    let expiredEntries = 0
    const now = Date.now()

    for (const [key, value] of serverCache.entries()) {
      if (value.expires > now) {
        validEntries++
      } else {
        expiredEntries++
      }
    }

    return {
      total: serverCache.size,
      valid: validEntries,
      expired: expiredEntries,
      memoryUsage: `${serverCache.size * 100}B`
    }
  }
}

// GET - получить значение из кеша
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { error: 'Key parameter is required' },
        { status: 400 }
      )
    }

    const data = cacheUtils.get(key)

    logger.debug('Cache GET request', { key, found: data !== null })

    return NextResponse.json({
      success: true,
      data,
      exists: data !== null
    })

  } catch (_error) {
    logger.error('Cache GET API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - установить значение в кеш
export async function POST(request: NextRequest) {
  try {
    const { action, key, value, ttl } = await request.json()

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      )
    }

    if (action === 'set') {
      cacheUtils.set(key, value, ttl || 300)

      logger.debug('Cache SET request', { key, ttl: ttl || 300 })

      return NextResponse.json({
        success: true,
        message: 'Cache set successfully'
      })
    }

    if (action === 'stats') {
      const _stats = cacheUtils.getStats()
      return NextResponse.json({
        success: true,
        stats
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "set" or "stats"' },
      { status: 400 }
    )

  } catch (_error) {
    logger.error('Cache POST API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - удалить значение из кеша
export async function DELETE(request: NextRequest) {
  try {
    const { key, action } = await request.json()

    if (action === 'clear') {
      cacheUtils.clear()
      logger.info('Cache cleared completely')

      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully'
      })
    }

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      )
    }

    const success = cacheUtils.delete(key)

    logger.debug('Cache DELETE request', { key, deleted: success })

    return NextResponse.json({
      success,
      message: success ? 'Cache deleted successfully' : 'Key not found'
    })

  } catch (_error) {
    logger.error('Cache DELETE API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}