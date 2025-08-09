import { NextRequest, NextResponse } from 'next/server'
import { validateUserSession, AUTH_CONFIG } from '@/lib/database-auth'
import { logger } from '@/lib/logger'

// Принудительно делаем маршрут динамическим
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(AUTH_CONFIG.sessionName)?.value

    if (!sessionId) {
      return NextResponse.json({
        authenticated: false,
        message: 'No session found'
      })
    }

    // Проверяем сессию в базе данных
    const userSession = await validateUserSession(sessionId)

    if (!userSession) {
      // Удаляем недействительный cookie
      const response = NextResponse.json({
        authenticated: false,
        message: 'Session expired'
      })

      response.cookies.delete(AUTH_CONFIG.sessionName)
      return response
    }

    // Возвращаем информацию о пользователе
    return NextResponse.json({
      authenticated: true,
      user: {
        id: userSession.user.id,
        username: userSession.user.username,
        email: userSession.user.email,
        firstName: userSession.user.first_name,
        lastName: userSession.user.last_name,
        role: userSession.user.role_name,
        permissions: userSession.user.role_permissions,
        lastLogin: userSession.user.last_login
      },
      session: {
        id: userSession.id,
        rememberMe: userSession.remember_me,
        expiresAt: userSession.expires_at,
        lastActivity: userSession.last_activity,
        ipAddress: userSession.ip_address
      }
    })

  } catch (error) {
    logger.error('Status endpoint error', error)
    return NextResponse.json(
      { authenticated: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}