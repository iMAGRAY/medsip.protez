import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, AUTH_CONFIG } from '@/lib/database-auth'
import { logger } from '@/lib/logger'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// Принудительно делаем маршрут динамическим
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Проверяем rate limiting
    const rateLimitResult = rateLimit(request, RATE_LIMITS.login)
    if (!rateLimitResult.allowed) {
      const resetTime = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000 / 60)
      logger.warn('Rate limit exceeded for login', { 
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        resetTimeMinutes: resetTime
      })
      return NextResponse.json(
        { 
          success: false, 
          error: `Too many login attempts. Try again in ${resetTime} minutes.` 
        },
        { status: 429 }
      )
    }

    const { username, password, rememberMe = false } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Получаем IP и User-Agent для безопасности
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Аутентификация через базу данных с поддержкой "запомнить меня"
    const authResult = await authenticateUser(username, password, ipAddress, userAgent, rememberMe)

    if (!authResult.success) {
      logger.warn('Failed admin login attempt', {
        username,
        ipAddress,
        userAgent,
        rememberMe,
        error: authResult.error
      })

      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      )
    }

    // Устанавливаем безопасный cookie с сессией
    const response = NextResponse.json({
      success: true,
      message: 'Successfully authenticated',
      user: {
        id: authResult.user!.id,
        username: authResult.user!.username,
        email: authResult.user!.email,
        firstName: authResult.user!.first_name,
        lastName: authResult.user!.last_name,
        role: authResult.user!.role_name,
        permissions: authResult.user!.role_permissions
      },
      rememberMe: rememberMe
    })

    // Время жизни cookie зависит от "запомнить меня"
    const cookieMaxAge = rememberMe
      ? AUTH_CONFIG.extendedSessionTTL / 1000 // 30 дней в секундах
      : AUTH_CONFIG.sessionTTL / 1000 // 24 часа в секундах

    response.cookies.set(AUTH_CONFIG.sessionName, authResult.sessionId!, {
      httpOnly: true,  // Защита от XSS
      secure: process.env.NODE_ENV === 'production', // HTTPS в production
      sameSite: 'strict', // Защита от CSRF
      maxAge: cookieMaxAge,
      path: '/'
    })

    logger.info('User successfully logged in', {
      userId: authResult.user!.id,
      username,
      role: authResult.user!.role_name,
      ipAddress,
      rememberMe,
      sessionId: authResult.sessionId,
      cookieMaxAge: `${cookieMaxAge / 86400} days`
    })

    return response

  } catch (error) {
    logger.error('Login endpoint error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}