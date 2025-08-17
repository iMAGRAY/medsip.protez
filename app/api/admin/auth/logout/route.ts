import { NextRequest, NextResponse } from 'next/server'
import { destroyUserSession, AUTH_CONFIG } from '@/lib/database-auth'
import { logger } from '@/lib/logger'

// Принудительно делаем маршрут динамическим
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(AUTH_CONFIG.sessionName)?.value

    if (sessionId) {
      // Удаляем сессию из базы данных
      await destroyUserSession(sessionId)
    }

    // Удаляем cookie сессии
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    response.cookies.delete(AUTH_CONFIG.sessionName)

    logger.info('User logged out', { sessionId })

    return response

  } catch (error) {
    logger.error('Logout error', error)

    // Все равно удаляем cookie, даже если есть ошибка
    const response = NextResponse.json({
      success: true,
      message: 'Logged out'
    })

    response.cookies.delete(AUTH_CONFIG.sessionName)

    return response
  }
}