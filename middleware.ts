import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit, RATE_LIMITS, getClientIP } from '@/lib/rate-limit'

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const ip = getClientIP(request)
  
  // Применяем rate limiting для API endpoints
  if (url.pathname.startsWith('/api/')) {
    // Исключаем некоторые endpoints из общего rate limiting
    const excludedPaths = ['/api/health', '/api/admin/auth/login'] 
    
    // Исключения для test environment - localhost, development, или unknown IP
    const isTestEnvironment = process.env.NODE_ENV === 'development' || 
                              ip === 'unknown' || 
                              ip === '127.0.0.1' || 
                              ip === 'localhost' ||
                              process.env.DISABLE_RATE_LIMIT === 'true'
    
    if (!excludedPaths.some(path => url.pathname.startsWith(path)) && !isTestEnvironment) {
      const rateLimitResult = rateLimit(request, RATE_LIMITS.api)
      
      if (!rateLimitResult.allowed) {
        const resetTime = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)
        
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Превышен лимит запросов. Попробуйте позже.',
            retryAfter: resetTime
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': resetTime.toString(),
              'X-RateLimit-Limit': RATE_LIMITS.api.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitResult.resetTime!.toString()
            }
          }
        )
      }
    }
  }
  
  // Создаем response с security headers
  let response = NextResponse.next()
  
  // Проверяем запросы на изображения логотипов с неправильным регистром
  if (url.pathname === '/logo.webp' && request.method === 'GET') {
    // Перенаправляем на существующий файл Logo.webp
    response = NextResponse.rewrite(new URL('/Logo.webp', request.url))
  }
  
  // Перенаправляем запросы на logo.svg на Logo.webp
  if (url.pathname === '/logo.svg' && request.method === 'GET') {
    response = NextResponse.rewrite(new URL('/Logo.webp', request.url))
  }
  
  // Логируем 404 для изображений производителей и возвращаем заглушку
  if (url.pathname.startsWith('/images/manufacturers/') && request.method === 'GET') {
    // Возвращаем логотип по умолчанию для производителей
    response = NextResponse.rewrite(new URL('/Logo.webp', request.url))
  }
  
  // Защита от DOM XSS через URL параметры - блокируем опасные запросы
  const searchParams = url.searchParams
  let hasXSSAttempt = false
  
  // Проверяем на XSS и SQL injection паттерны в параметрах
  const maliciousPatterns = [
    // XSS patterns
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /data:image\/svg\+xml.*script/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /<form/gi,
    /<input/gi,
    /alert\s*\(/gi,
    /eval\s*\(/gi,
    /prompt\s*\(/gi,
    /confirm\s*\(/gi,
    /document\./gi,
    /window\./gi,
    /expression\s*\(/gi,
    /%3cscript/gi,
    /%3ciframe/gi,
    /&lt;script/gi,
    /&lt;iframe/gi,
    // SQL injection patterns
    /(\s|^)union(\s|$)/gi,
    /(\s|^)select(\s|$)/gi,
    /(\s|^)insert(\s|$)/gi,
    /(\s|^)update(\s|$)/gi,
    /(\s|^)delete(\s|$)/gi,
    /(\s|^)drop(\s|$)/gi,
    /(\s|^)create(\s|$)/gi,
    /(\s|^)alter(\s|$)/gi,
    /(\s|^)exec(\s|$)/gi,
    /(\s|^)execute(\s|$)/gi,
    /'.*or.*'.*=/gi,
    /'.*and.*'.*=/gi,
    /'\s*or\s+\d+\s*=\s*\d+/gi,
    /'\s*and\s+\d+\s*=\s*\d+/gi,
    /'\s*;\s*drop/gi,
    /'\s*;\s*delete/gi,
    /'\s*;\s*update/gi,
    /'\s*;\s*insert/gi,
    /--/gi,
    /\/\*/gi,
    /\*\//gi
  ]
  
  searchParams.forEach((value, key) => {
    for (const pattern of maliciousPatterns) {
      if (pattern.test(decodeURIComponent(value))) {
        hasXSSAttempt = true
        break
      }
    }
  })
  
  // Если найден XSS паттерн, возвращаем 400 ошибку вместо продолжения
  if (hasXSSAttempt) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Malicious request detected',
        code: 'XSS_ATTEMPT'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      }
    )
  }
  
  // Проверяем паттерн callback в URL (часто используется для JSONP XSS)
  if (url.pathname.includes('callback=') || url.search.includes('callback=')) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Callback parameter not allowed',
        code: 'CALLBACK_BLOCKED'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      }
    )
  }

  // Проверяем опасные параметры редиректа
  const dangerousParams = ['callback', 'redirect', 'return_url', 'goto', 'next']
  
  for (const param of dangerousParams) {
    const value = searchParams.get(param)
    if (value) {
      // Валидируем URL параметры
      try {
        const redirectUrl = new URL(value, request.url)
        // Разрешаем только локальные редиректы
        if (redirectUrl.origin !== url.origin) {
          return new NextResponse(
            JSON.stringify({
              success: false,
              error: 'External redirects not allowed',
              code: 'INVALID_REDIRECT'
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY'
              }
            }
          )
        }
      } catch {
        // Если не валидный URL, блокируем запрос
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Invalid URL in parameters',
            code: 'INVALID_URL'
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY'
            }
          }
        )
      }
    }
  }
  
  // Добавляем security headers для защиты от атак
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Добавляем HSTS header для принудительного HTTPS
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  
  // Улучшенный Content Security Policy
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' ws: wss:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  )
  
  return response
}

export const config = {
  matcher: [
    // Применяем middleware ко всем маршрутам для security headers
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}