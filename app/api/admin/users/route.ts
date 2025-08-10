import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/database-auth'
import { Client } from 'pg'
import bcrypt from 'bcrypt'

// Принудительно делаем маршрут динамическим
export const dynamic = 'force-dynamic'

// Подключение к базе данных
function getDbConnection() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
  })
}

// GET - получение списка пользователей
export async function GET(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!session.user.role_permissions?.includes('*') &&
        !session.user.role_permissions?.includes('users.manage')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const client = getDbConnection()
    await client.connect()

    // Определяем, является ли пользователь суперадминистратором (id=1)
    const isSuperAdmin = session.user_id === 1;

    // Получаем пользователей с их ролями
    // Если пользователь не суперадминистратор, исключаем суперадминистратора из результатов
    const query = `
      SELECT
        u.id, u.username, u.email, u.first_name, u.last_name,
        u.status, u.email_verified, u.last_login, u.login_count,
        u.failed_login_attempts, u.created_at, u.updated_at,
        r.name as role, r.display_name as role_display_name,
        r.description as role_description
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ${!isSuperAdmin ? 'WHERE u.id != 1' : ''}
      ORDER BY u.created_at DESC
    `;

    const result = await client.query(query);

    const _users = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      roleDisplayName: row.role_display_name,
      roleDescription: row.role_description,
      status: row.status,
      emailVerified: row.email_verified,
      lastLogin: row.last_login,
      loginCount: row.login_count,
      failedLoginAttempts: row.failed_login_attempts,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    await client.end()

    return NextResponse.json({
      success: true,
      users: _users
    })

  } catch (error) {
    console.error('Error getting users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - создание нового пользователя
export async function POST(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!session.user.role_permissions?.includes('*') &&
        !session.user.role_permissions?.includes('users.manage')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const data = await request.json()
    const { username, email, firstName, lastName, roleId, password, status = 'active' } = data

    // Валидация
    if (!username || !email || !password || !roleId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const client = getDbConnection()
    await client.connect()

    // Проверяем уникальность username и email
    const existingUser = await client.query(`
      SELECT id FROM users WHERE username = $1 OR email = $2
    `, [username, email])

    if (existingUser.rows.length > 0) {
      await client.end()
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 400 }
      )
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 12)

    // Создаем пользователя
    const result = await client.query(`
      INSERT INTO users (
        username, email, password_hash, role_id,
        first_name, last_name, status, email_verified,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, username, email, created_at
    `, [
      username, email, passwordHash, roleId,
      firstName || null, lastName || null, status, false,
      session.user_id
    ])

    const newUser = result.rows[0]

    // Логируем создание пользователя
    await client.query(`
      INSERT INTO user_audit_log (
        user_id, action, resource_type, resource_id,
        details, created_at
      ) VALUES ($1, 'user_created', 'user', $2, $3, CURRENT_TIMESTAMP)
    `, [
      session.user_id, newUser.id,
      JSON.stringify({
        created_user: {
          username: newUser.username,
          email: newUser.email,
          role_id: roleId
        },
        created_by: session.user.username
      })
    ])

    await client.end()

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.created_at
      }
    })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}