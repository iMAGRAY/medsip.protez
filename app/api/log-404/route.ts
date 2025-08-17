import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// POST /api/log-404 - логирование 404 ошибок
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, type } = body

    // Логируем только запросы на изображения
    if (type === 'image') {
      logger.warn('404 Image not found', {
        url,
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent')
      })
    }

    return NextResponse.json({ logged: true })
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to log' }, { status: 500 })
  }
}