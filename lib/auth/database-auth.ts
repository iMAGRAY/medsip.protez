import { NextRequest } from 'next/server'
import { Client } from 'pg'
import { logger } from '../logger'
import bcrypt from 'bcrypt'

// Конфигурация безопасности
export const AUTH_CONFIG = {
  sessionName: 'admin_session',
  sessionTTL: 24 * 60 * 60 * 1000, // 24 часа
  extendedSessionTTL: 30 * 24 * 60 * 60 * 1000, // 30 дней
  maxAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 минут
  csrfTokenLength: 32
}

// Получение подключения к PostgreSQL
function getDbConnection() {
  return new Client({
    connectionString: process.env.DATABASE_URL
  })
}

// Интерфейс пользователя
export interface User {
  id: number
  username: string
  email: string
  first_name?: string
  last_name?: string
  role_id: number
  role_name: string
  role_display_name: string
  role_permissions: string[]
  status: 'active' | 'inactive' | 'blocked' | 'pending'
  last_login?: Date
  created_at: Date
}

// Интерфейс сессии
export interface UserSession {
  id: string
  user_id: number
  user: User
  ip_address: string
  user_agent: string
  csrf_token: string
  remember_me: boolean
  expires_at: Date
  last_activity: Date
  created_at: Date
}

// Хранилище неудачных попыток входа (в production лучше Redis)
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

// Проверка учетных данных пользователя в базе данных
async function validateUserCredentials(username: string, password: string): Promise<User | null> {
  const client = getDbConnection()

  try {
    await client.connect()

    // Получаем пользователя с его ролью и правами
    const userResult = await client.query(`
      SELECT
        u.id, u.username, u.email, u.first_name, u.last_name,
        u.password_hash, u.status, u.last_login, u.created_at,
        u.failed_login_attempts, u.locked_until,
        r.id as role_id, r.name as role_name, r.display_name as role_display_name,
        r.permissions as role_permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username = $1 AND u.status != 'blocked'
    `, [username])

    if (userResult.rows.length === 0) {
      return null
    }

    const userData = userResult.rows[0]

    // Проверяем блокировку аккаунта
    if (userData.locked_until && new Date() < new Date(userData.locked_until)) {
      logger.warn('Account is locked', { username, locked_until: userData.locked_until })
      return null
    }

    // Проверяем статус пользователя
    if (userData.status !== 'active') {
      logger.warn('User account not active', { username, status: userData.status })
      return null
    }

    // Проверяем пароль
    const passwordValid = await bcrypt.compare(password, userData.password_hash)
    if (!passwordValid) {
      // Увеличиваем счетчик неудачных попыток
      await client.query(`
        UPDATE users
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE
              WHEN failed_login_attempts + 1 >= 5
              THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
              ELSE locked_until
            END
        WHERE id = $1
      `, [userData.id])

      return null
    }

    // Сбрасываем счетчик неудачных попыток при успешном входе
    await client.query(`
      UPDATE users
      SET failed_login_attempts = 0,
          locked_until = NULL,
          last_login = CURRENT_TIMESTAMP,
          login_count = login_count + 1
      WHERE id = $1
    `, [userData.id])

    // Возвращаем данные пользователя
    return {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role_id: userData.role_id,
      role_name: userData.role_name,
      role_display_name: userData.role_display_name,
      role_permissions: userData.role_permissions || [],
      status: userData.status,
      last_login: userData.last_login,
      created_at: userData.created_at
    }

  } catch (error) {
    logger.error('Error validating user credentials', error)
    return null
  } finally {
    await client.end()
  }
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

// Создание сессии в базе данных
export async function createUserSession(
  user: User,
  ipAddress: string,
  userAgent: string,
  rememberMe: boolean = false
): Promise<string | null> {
  const client = getDbConnection()

  try {
    await client.connect()

    const sessionId = generateSecureToken(64)
    const csrfToken = generateSecureToken(AUTH_CONFIG.csrfTokenLength)
    const sessionTTL = rememberMe ? AUTH_CONFIG.extendedSessionTTL : AUTH_CONFIG.sessionTTL
    const expiresAt = new Date(Date.now() + sessionTTL)

    // Создаем сессию в базе данных
    await client.query(`
      INSERT INTO user_sessions (
        id, user_id, ip_address, user_agent, csrf_token,
        remember_me, expires_at, last_activity, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [sessionId, user.id, ipAddress, userAgent, csrfToken, rememberMe, expiresAt])

    // Очистка счетчика попыток при успешном входе
    loginAttempts.delete(ipAddress)

    // Логируем действие
    await client.query(`
      INSERT INTO user_audit_log (
        user_id, action, details, ip_address, user_agent, session_id, created_at
      ) VALUES ($1, 'login', $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      user.id,
      JSON.stringify({ remember_me: rememberMe, login_method: 'password' }),
      ipAddress,
      userAgent,
      sessionId
    ])

    logger.info('User session created', {
      userId: user.id,
      username: user.username,
      ipAddress,
      sessionId,
      rememberMe,
      expiresAt: expiresAt.toISOString()
    })

    return sessionId

  } catch (error) {
    logger.error('Error creating user session', error)
    return null
  } finally {
    await client.end()
  }
}

// Проверка сессии в базе данных
export async function validateUserSession(sessionId: string): Promise<UserSession | null> {
  const client = getDbConnection()

  try {
    await client.connect()

    // Получаем сессию с данными пользователя
    const sessionResult = await client.query(`
      SELECT
        s.id, s.user_id, s.ip_address, s.user_agent, s.csrf_token,
        s.remember_me, s.expires_at, s.last_activity, s.created_at,
        u.username, u.email, u.first_name, u.last_name, u.status,
        u.last_login, u.created_at as user_created_at,
        r.id as role_id, r.name as role_name, r.display_name as role_display_name,
        r.permissions as role_permissions
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      WHERE s.id = $1 AND s.expires_at > CURRENT_TIMESTAMP AND u.status = 'active'
    `, [sessionId])

    if (sessionResult.rows.length === 0) {
      // Удаляем истекшую сессию
      await client.query('DELETE FROM user_sessions WHERE id = $1', [sessionId])
      return null
    }

    const sessionData = sessionResult.rows[0]

    // Обновляем время последней активности
    await client.query(`
      UPDATE user_sessions
      SET last_activity = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [sessionId])

    return {
      id: sessionData.id,
      user_id: sessionData.user_id,
      user: {
        id: sessionData.user_id,
        username: sessionData.username,
        email: sessionData.email,
        first_name: sessionData.first_name,
        last_name: sessionData.last_name,
        role_id: sessionData.role_id,
        role_name: sessionData.role_name,
        role_display_name: sessionData.role_display_name,
        role_permissions: sessionData.role_permissions || [],
        status: sessionData.status,
        last_login: sessionData.last_login,
        created_at: sessionData.user_created_at
      },
      ip_address: sessionData.ip_address,
      user_agent: sessionData.user_agent,
      csrf_token: sessionData.csrf_token,
      remember_me: sessionData.remember_me,
      expires_at: sessionData.expires_at,
      last_activity: sessionData.last_activity,
      created_at: sessionData.created_at
    }

  } catch (error) {
    logger.error('Error validating user session', error)
    return null
  } finally {
    await client.end()
  }
}

// Удаление сессии
export async function destroyUserSession(sessionId: string): Promise<void> {
  const client = getDbConnection()

  try {
    await client.connect()

    // Получаем данные сессии для логирования
    const sessionResult = await client.query(`
      SELECT user_id, ip_address, user_agent FROM user_sessions WHERE id = $1
    `, [sessionId])

    if (sessionResult.rows.length > 0) {
      const sessionData = sessionResult.rows[0]

      // Логируем выход
      await client.query(`
        INSERT INTO user_audit_log (
          user_id, action, details, ip_address, user_agent, session_id, created_at
        ) VALUES ($1, 'logout', $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        sessionData.user_id,
        JSON.stringify({ logout_method: 'manual' }),
        sessionData.ip_address,
        sessionData.user_agent,
        sessionId
      ])
    }

    // Удаляем сессию
    await client.query('DELETE FROM user_sessions WHERE id = $1', [sessionId])

    logger.info('User session destroyed', { sessionId })

  } catch (error) {
    logger.error('Error destroying user session', error)
  } finally {
    await client.end()
  }
}

// Аутентификация пользователя
export async function authenticateUser(
  username: string,
  password: string,
  ipAddress: string,
  userAgent: string,
  rememberMe: boolean = false
): Promise<{ success: boolean; sessionId?: string; error?: string; user?: User }> {

  // Проверка лимитов
  if (!checkRateLimit(ipAddress)) {
    logger.warn('Rate limit exceeded', { ipAddress })
    return { success: false, error: 'Too many failed attempts. Try again later.' }
  }

  // Проверка учетных данных
  const user = await validateUserCredentials(username, password)
  if (!user) {
    recordFailedAttempt(ipAddress)
    return { success: false, error: 'Invalid credentials' }
  }

  // Создание сессии
  const sessionId = await createUserSession(user, ipAddress, userAgent, rememberMe)
  if (!sessionId) {
    return { success: false, error: 'Failed to create session' }
  }

  return { success: true, sessionId, user }
}

// Middleware для проверки аутентификации
export async function requireAuth(request: NextRequest): Promise<UserSession | null> {
  const sessionId = request.cookies.get(AUTH_CONFIG.sessionName)?.value

  if (!sessionId) return null

  return await validateUserSession(sessionId)
}

// Проверка прав доступа пользователя
export function hasPermission(user: User, permission: string): boolean {
  if (!user.role_permissions) return false

  // Супер-админ имеет все права
  if (user.role_permissions.includes('*')) return true

  // Проверка точного совпадения
  if (user.role_permissions.includes(permission)) return true

  // Проверка wildcard разрешений (например, products.* для products.read)
  return user.role_permissions.some(perm => {
    if (perm.endsWith('*')) {
      const basePermission = perm.slice(0, -1)
      return permission.startsWith(basePermission)
    }
    return false
  })
}

// Очистка истекших сессий (функция для cron)
export async function cleanupExpiredSessions(): Promise<number> {
  const client = getDbConnection()

  try {
    await client.connect()

    const result = await client.query(`
      DELETE FROM user_sessions
      WHERE expires_at < CURRENT_TIMESTAMP
         OR last_activity < CURRENT_TIMESTAMP - INTERVAL '30 days'
    `)

    const deletedCount = result.rowCount || 0

    if (deletedCount > 0) {
      logger.info('Cleaned up expired sessions', { count: deletedCount })
    }

    return deletedCount

  } catch (error) {
    logger.error('Error cleaning up expired sessions', error)
    return 0
  } finally {
    await client.end()
  }
}

// Запуск очистки истекших сессий каждый час
setInterval(cleanupExpiredSessions, 60 * 60 * 1000)