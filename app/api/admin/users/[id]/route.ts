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

// PATCH - обновление пользователя
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const userId = parseInt(params.id)
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const data = await request.json()
    const { username, email, firstName, lastName, roleId, status, password } = data

    // Запрещаем деактивацию главного администратора (id=1)
    if (userId === 1 && status && status !== 'active') {
      return NextResponse.json(
        { error: 'Нельзя деактивировать главного администратора' },
        { status: 400 }
      )
    }

    // Запрещаем изменение логина главного администратора (id=1)
    if (userId === 1 && username) {
      return NextResponse.json(
        { error: 'Нельзя изменить логин главного администратора' },
        { status: 400 }
      )
    }

    // Запрещаем изменение роли главного администратора (id=1)
    if (userId === 1 && roleId) {
      return NextResponse.json(
        { error: 'Нельзя изменить роль главного администратора' },
        { status: 400 }
      )
    }

    const client = getDbConnection()
    await client.connect()

    // Проверяем существование пользователя
    const existingUser = await client.query(`
      SELECT id, username, email FROM users WHERE id = $1
    `, [userId])

    if (existingUser.rows.length === 0) {
      await client.end()
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Проверяем уникальность username и email (исключая текущего пользователя)
    if (username || email) {
      const duplicateCheck = await client.query(`
        SELECT id FROM users
        WHERE (username = $1 OR email = $2) AND id != $3
      `, [username || '', email || '', userId])

      if (duplicateCheck.rows.length > 0) {
        await client.end()
        return NextResponse.json(
          { error: 'Username or email already exists' },
          { status: 400 }
        )
      }
    }

    // Строим динамический запрос обновления
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (username) {
      updateFields.push(`username = $${paramIndex}`)
      updateValues.push(username)
      paramIndex++
    }
    if (email) {
      updateFields.push(`email = $${paramIndex}`)
      updateValues.push(email)
      paramIndex++
    }
    if (firstName !== undefined) {
      updateFields.push(`first_name = $${paramIndex}`)
      updateValues.push(firstName || null)
      paramIndex++
    }
    if (lastName !== undefined) {
      updateFields.push(`last_name = $${paramIndex}`)
      updateValues.push(lastName || null)
      paramIndex++
    }
    if (roleId) {
      updateFields.push(`role_id = $${paramIndex}`)
      updateValues.push(roleId)
      paramIndex++
    }
    if (status) {
      updateFields.push(`status = $${paramIndex}`)
      updateValues.push(status)
      paramIndex++
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12)
      updateFields.push(`password_hash = $${paramIndex}`)
      updateValues.push(passwordHash)
      paramIndex++
      updateFields.push(`password_changed_at = CURRENT_TIMESTAMP`)
    }

    if (updateFields.length === 0) {
      await client.end()
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Добавляем updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(userId)

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, first_name, last_name, status, updated_at
    `

    const result = await client.query(updateQuery, updateValues)
    const updatedUser = result.rows[0]

    // Логируем изменение пользователя
    await client.query(`
      INSERT INTO user_audit_log (
        user_id, action, resource_type, resource_id,
        details, created_at
      ) VALUES ($1, 'user_updated', 'user', $2, $3, CURRENT_TIMESTAMP)
    `, [
      session.user_id, userId,
      JSON.stringify({
        updated_fields: Object.keys(data),
        updated_by: session.user.username,
        target_user: updatedUser.username
      })
    ])

    await client.end()

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        status: updatedUser.status,
        updatedAt: updatedUser.updated_at
      }
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - удаление пользователя
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const userId = parseInt(params.id)
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    // Нельзя удалить самого себя
    if (userId === session.user_id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Запрещаем удаление главного администратора (id=1)
    if (userId === 1) {
      return NextResponse.json(
        { error: 'Нельзя удалить главного администратора' },
        { status: 400 }
      )
    }

    const client = getDbConnection()
    await client.connect()

    // Проверяем существование пользователя
    const existingUser = await client.query(`
      SELECT id, username, email FROM users WHERE id = $1
    `, [userId])

    if (existingUser.rows.length === 0) {
      await client.end()
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userToDelete = existingUser.rows[0]

    // Вместо полного удаления, деактивируем пользователя
    await client.query(`
      UPDATE users
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId])

    // Удаляем активные сессии пользователя
    await client.query(`
      DELETE FROM user_sessions WHERE user_id = $1
    `, [userId])

    // Логируем деактивацию пользователя
    await client.query(`
      INSERT INTO user_audit_log (
        user_id, action, resource_type, resource_id,
        details, created_at
      ) VALUES ($1, 'user_deactivated', 'user', $2, $3, CURRENT_TIMESTAMP)
    `, [
      session.user_id, userId,
      JSON.stringify({
        deactivated_user: {
          username: userToDelete.username,
          email: userToDelete.email
        },
        deactivated_by: session.user.username,
        reason: 'Admin deletion'
      })
    ])

    await client.end()

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - получение конкретного пользователя
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        !session.user.role_permissions?.includes('users.manage') &&
        parseInt(params.id) !== session.user_id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const userId = parseInt(params.id)
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    // Запрещаем доступ к данным суперадминистратора для обычных пользователей
    if (userId === 1 && session.user_id !== 1) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const client = getDbConnection()
    await client.connect()

    // Получаем пользователя с его ролью
    const result = await client.query(`
      SELECT
        u.id, u.username, u.email, u.first_name, u.last_name,
        u.status, u.email_verified, u.last_login, u.login_count,
        u.failed_login_attempts, u.created_at, u.updated_at,
        r.id as role_id, r.name as role, r.display_name as role_display_name,
        r.description as role_description, r.permissions as role_permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId])

    if (result.rows.length === 0) {
      await client.end()
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = result.rows[0]
    await client.end()

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        roleId: user.role_id,
        roleDisplayName: user.role_display_name,
        roleDescription: user.role_description,
        rolePermissions: user.role_permissions,
        status: user.status,
        emailVerified: user.email_verified,
        lastLogin: user.last_login,
        loginCount: user.login_count,
        failedLoginAttempts: user.failed_login_attempts,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    })

  } catch (error) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}