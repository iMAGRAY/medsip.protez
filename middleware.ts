import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  
  // Проверяем запросы на изображения логотипов с неправильным регистром
  if (url.pathname === '/logo.webp' && request.method === 'GET') {
    // Перенаправляем на существующий файл Logo.webp
    return NextResponse.rewrite(new URL('/Logo.webp', request.url))
  }
  
  // Перенаправляем запросы на logo.svg на Logo.webp
  if (url.pathname === '/logo.svg' && request.method === 'GET') {
    return NextResponse.rewrite(new URL('/Logo.webp', request.url))
  }
  
  // Логируем 404 для изображений производителей и возвращаем заглушку
  if (url.pathname.startsWith('/images/manufacturers/') && request.method === 'GET') {
    // Возвращаем логотип по умолчанию для производителей
    return NextResponse.rewrite(new URL('/Logo.webp', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/logo.webp',
    '/logo.svg',
    '/images/manufacturers/:path*'
  ]
}