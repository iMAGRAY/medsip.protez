import { NextRequest } from 'next/server'
import { logger } from '../logger'

// Конфигурация безопасности
const AUTH_CONFIG = {
  sessionName: 'admin_session',
  sessionTTL: 24 * 60 * 60 * 1000, // 24 часа (обычная сессия)
  extendedSessionTTL: 30 * 24 * 60 * 60 * 1000, // 30 дней (при "запомнить меня")
  maxAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 минут
  csrfTokenLength: 32
}

// Интерфейс сессии
interface AdminSession {
  id: string
  username: string
  loginTime: number
  lastActivity: number
  ipAddress: string
  userAgent: string
  csrfToken: string
  rememberMe: boolean // Новое поле для отслеживания "запомнить меня"
  expiresAt: number // Точное время истечения сессии
}

// Хранилище сессий (в production должно быть Redis/Database)
const activeSessions = new Map<string, AdminSession>()
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()

// Генерация безопасного токена
function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Проверка учетных данных из environment variables
function validateCredentials(username: string, password: string): boolean {
  const validUsername = process.env.ADMIN_USERNAME
  const validPassword = process.env.ADMIN_PASSWORD

  if (!validUsername || !validPassword) {
    logger.error('Admin credentials not configured in environment variables')
    throw new Error('Admin authentication not properly configured')
  }

  // В production добавить хеширование паролей
  return username === validUsername && password === validPassword
}

// Проверка лимитов попыток входа
function checkRateLimit(ipAddress: string): boolean {
  const attempts = loginAttempts.get(ipAddress)

  if (!attempts) return true

  const now = Date.now()

  // Сброс счетчика если прошло время блокировки
  if (now - attempts.lastAttempt > AUTH_CONFIG.lockoutDuration) {
    loginAttempts.delete(ipAddress)
    return true
  }

  return attempts.count < AUTH_CONFIG.maxAttempts
}

// Регистрация неудачной попытки
function recordFailedAttempt(ipAddress: string): void {
  const attempts = loginAttempts.get(ipAddress) || { count: 0, lastAttempt: 0 }
  attempts.count++
  attempts.lastAttempt = Date.now()
  loginAttempts.set(ipAddress, attempts)

  logger.warn('Failed login attempt', { ipAddress, attempts: attempts.count })
}

// Создание сессии
export function createSession(
  _username: string,
  ipAddress: string,
  _userAgent: string,
  rememberMe: boolean = false
): string {
  const sessionId = generateSecureToken(64)
  const now = Date.now()
  const sessionTTL = rememberMe ? AUTH_CONFIG.extendedSessionTTL : AUTH_CONFIG.sessionTTL

  const session: AdminSession = {
    id: sessionId,
    username: _username,
    loginTime: now,
    lastActivity: now,
    ipAddress,
    userAgent: _userAgent,
    csrfToken: generateSecureToken(AUTH_CONFIG.csrfTokenLength),
    rememberMe,
    expiresAt: now + sessionTTL
  }

  activeSessions.set(sessionId, session)

  // Очистка счетчика попыток при успешном входе
  loginAttempts.delete(ipAddress)

  logger.info('Admin session created', {
    username: _username,
    ipAddress,
    sessionId,
    rememberMe,
    expiresAt: new Date(session.expiresAt).toISOString()
  })

  return sessionId
}

// Проверка сессии
export function validateSession(sessionId: string): AdminSession | null {
  const session = activeSessions.get(sessionId)

  if (!session) return null

  const now = Date.now()

  // Проверка точного времени истечения
  if (now > session.expiresAt) {
    activeSessions.delete(sessionId)
    logger.info('Session expired', {
      sessionId,
      username: session.username,
      rememberMe: session.rememberMe
    })
    return null
  }

  // Обновление времени активности
  session.lastActivity = now

  return session
}

// Удаление сессии
export function destroySession(sessionId: string): void {
  const session = activeSessions.get(sessionId)
  if (session) {
    activeSessions.delete(sessionId)
    logger.info('Session destroyed', { sessionId, username: session.username })
  }
}

// Аутентификация через API
export async function authenticateAdmin(
  username: string,
  password: string,
  ipAddress: string,
  userAgent: string,
  rememberMe: boolean = false
): Promise<{ success: boolean; sessionId?: string; error?: string; rememberMe?: boolean }> {

  // Проверка лимитов
  if (!checkRateLimit(ipAddress)) {
    logger.warn('Rate limit exceeded', { ipAddress })
    return { success: false, error: 'Too many failed attempts. Try again later.' }
  }

  // Проверка учетных данных
  if (!validateCredentials(username, password)) {
    recordFailedAttempt(ipAddress)
    return { success: false, error: 'Invalid credentials' }
  }

  // Создание сессии с учетом "запомнить меня"
  const _sessionId = createSession(username, ipAddress, userAgent, rememberMe)

  return { success: true, sessionId: _sessionId, rememberMe }
}

// Middleware для проверки аутентификации
export function requireAuth(request: NextRequest): AdminSession | null {
  const sessionId = request.cookies.get(AUTH_CONFIG.sessionName)?.value

  if (!sessionId) return null

  return validateSession(sessionId)
}

// Очистка просроченных сессий
setInterval(() => {
  const now = Date.now()
  const expiredSessions: string[] = []

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now > session.expiresAt) {
      expiredSessions.push(sessionId)
    }
  }

  expiredSessions.forEach(sessionId => {
    const session = activeSessions.get(sessionId)
    activeSessions.delete(sessionId)
    if (session) {
      logger.info('Session expired and cleaned up', {
        sessionId,
        username: session.username,
        rememberMe: session.rememberMe
      })
    }
  })

  if (expiredSessions.length > 0) {
    logger.info('Cleaned up expired sessions', { count: expiredSessions.length })
  }
}, 60 * 60 * 1000) // Каждый час

// Экспорт конфигурации
export { AUTH_CONFIG }