import { NextRequest } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// Simple in-memory rate limiting (для production лучше Redis)
const rateLimitStore: RateLimitStore = {}

export interface RateLimitConfig {
  windowMs: number // время окна в миллисекундах
  maxRequests: number // максимальное количество запросов в окне
}

// Конфигурации для разных типов API
export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 попыток за 15 минут
  api: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 запросов в минуту
  strict: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 запросов в минуту для чувствительных API
}

export function rateLimit(request: NextRequest, config: RateLimitConfig): { allowed: boolean; resetTime?: number } {
  const ip = getClientIP(request)
  const key = `${ip}:${request.nextUrl.pathname}`
  const now = Date.now()
  
  // Очищаем старые записи
  if (rateLimitStore[key] && now > rateLimitStore[key].resetTime) {
    delete rateLimitStore[key]
  }
  
  // Инициализируем или обновляем счетчик
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + config.windowMs
    }
    return { allowed: true }
  }
  
  // Проверяем лимит
  if (rateLimitStore[key].count >= config.maxRequests) {
    return { 
      allowed: false, 
      resetTime: rateLimitStore[key].resetTime 
    }
  }
  
  // Увеличиваем счетчик
  rateLimitStore[key].count++
  return { allowed: true }
}

export function getClientIP(request: NextRequest): string {
  // Пытаемся получить реальный IP из различных заголовков
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip')
  const cloudflare = request.headers.get('cf-connecting-ip')
  
  if (cloudflare) return cloudflare
  if (real) return real
  if (forwarded) return forwarded.split(',')[0].trim()
  
  // Fallback для development
  return 'unknown'
}

// Cleanup функция для очистки старых записей (запускать периодически)
export function cleanupOldEntries() {
  const now = Date.now()
  Object.keys(rateLimitStore).forEach(key => {
    if (now > rateLimitStore[key].resetTime) {
      delete rateLimitStore[key]
    }
  })
}

// Запускаем cleanup каждые 10 минут
if (typeof window === 'undefined') {
  setInterval(cleanupOldEntries, 10 * 60 * 1000)
}