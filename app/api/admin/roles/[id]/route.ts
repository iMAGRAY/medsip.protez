import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/database-auth'
import { Client } from 'pg'

// Принудительно делаем маршрут динамическим
export const dynamic = 'force-dynamic'

// Подключение к базе данных
function getDbConnection() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
  })
}

// GET - получение конкретной роли
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
        !session.user.role_permissions?.includes('roles.view') &&
        !session.user.role_permissions?.includes('roles.manage') &&
        !session.user.role_permissions?.includes('users.manage')) {
return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const roleId = parseInt(resolvedParams.id)
    if (isNaN(roleId)) {

      return NextResponse.json(
        { error: 'Invalid role ID' },
        { status: 400 }
      )
    }

const client = getDbConnection()
    await client.connect()

    try {
      // Получаем роль
      const result = await client.query(`
        SELECT
          id, name, display_name, description, permissions, is_active,
          created_at, updated_at
        FROM roles
        WHERE id = $1
      `, [roleId])

      if (result.rows.length === 0) {

        await client.end()
        return NextResponse.json(
          { error: 'Role not found' },
          { status: 404 }
        )
      }

      const role = result.rows[0]
await client.end()

      return NextResponse.json({
        success: true,
        role: {
          id: role.id,
          name: role.name,
          displayName: role.display_name,
          description: role.description,
          permissions: role.permissions || [],
          isActive: role.is_active,
          createdAt: role.created_at,
          updatedAt: role.updated_at
        }
      })
    } catch (error) {
      await client.end()
      return NextResponse.json(
        { error: 'Ошибка получения роли из базы данных' },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - обновление роли (только для главного администратора)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Проверяем, что запрос выполнен главным администратором (id=1)
    if (session.user_id !== 1) {
      return NextResponse.json(
        { error: 'Только главный администратор может изменять роли' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const roleId = parseInt(resolvedParams.id)
    if (isNaN(roleId)) {
      return NextResponse.json(
        { error: 'Invalid role ID' },
        { status: 400 }
      )
    }

    const data = await request.json()

    const { displayName, description, permissions } = data

    const client = getDbConnection()
    await client.connect()

    try {
      // Проверяем существование роли
      const existingRole = await client.query(`
        SELECT id, name FROM roles WHERE id = $1
      `, [roleId])

      if (existingRole.rows.length === 0) {
        await client.end()
        return NextResponse.json(
          { error: 'Роль не найдена' },
          { status: 404 }
        )
      }

      const roleName = existingRole.rows[0].name

      // Запрещаем изменение роли super_admin
      if (roleName === 'super_admin') {
        await client.end()
        return NextResponse.json(
          { error: 'Роль super_admin не может быть изменена' },
          { status: 400 }
        )
      }

      // Формируем части запроса и параметры
      const updateParts = []
      const queryParams = []
      let paramIndex = 1

      if (displayName !== undefined) {
        updateParts.push(`display_name = $${paramIndex}`)
        queryParams.push(displayName)
        paramIndex++
      }

      if (description !== undefined) {
        updateParts.push(`description = $${paramIndex}`)
        queryParams.push(description)
        paramIndex++
      }

      if (permissions !== undefined) {
        updateParts.push(`permissions = $${paramIndex}`)
        queryParams.push(permissions)
        paramIndex++
      }

      // Добавляем обновление времени
      updateParts.push(`updated_at = CURRENT_TIMESTAMP`)

      // Добавляем ID роли в конец параметров
      queryParams.push(roleId)

      // Если нет частей для обновления, возвращаем ошибку
      if (updateParts.length === 0) {
        await client.end()
        return NextResponse.json(
          { error: 'Нет данных для обновления' },
          { status: 400 }
        )
      }

      // Обновляем роль
      const result = await client.query(`
        UPDATE roles
        SET ${updateParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, display_name, description, permissions, is_active, updated_at
      `, queryParams)

      const updatedRole = result.rows[0]

      // Логируем обновление роли
      await client.query(`
        INSERT INTO user_audit_log (
          user_id, action, resource_type, resource_id,
          details, created_at
        ) VALUES ($1, 'role_updated', 'role', $2, $3, CURRENT_TIMESTAMP)
      `, [
        session.user_id, roleId,
        JSON.stringify({
          role_name: updatedRole.name,
          updated_fields: Object.keys(data),
          updated_by: session.user.username
        })
      ])

      await client.end()

      return NextResponse.json({
        success: true,
        role: {
          id: updatedRole.id,
          name: updatedRole.name,
          displayName: updatedRole.display_name,
          description: updatedRole.description,
          permissions: updatedRole.permissions || [],
          isActive: updatedRole.is_active,
          updatedAt: updatedRole.updated_at
        }
      })
    } catch (error) {
      await client.end()
      return NextResponse.json(
        { error: 'Ошибка обновления роли в базе данных' },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - удаление роли (только для главного администратора)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Проверяем, что запрос выполнен главным администратором (id=1)
    if (session.user_id !== 1) {
      return NextResponse.json(
        { error: 'Только главный администратор может удалять роли' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const roleId = parseInt(resolvedParams.id)
    if (isNaN(roleId)) {
      return NextResponse.json(
        { error: 'Invalid role ID' },
        { status: 400 }
      )
    }

    const client = getDbConnection()
    await client.connect()

    try {
      // Проверяем существование роли
      const existingRole = await client.query(`
        SELECT id, name FROM roles WHERE id = $1
      `, [roleId])

      if (existingRole.rows.length === 0) {
        await client.end()
        return NextResponse.json(
          { error: 'Роль не найдена' },
          { status: 404 }
        )
      }

      const roleName = existingRole.rows[0].name
// Запрещаем удаление системных ролей
      if (['super_admin', 'admin', 'moderator', 'editor', 'viewer'].includes(roleName)) {

        await client.end()
        return NextResponse.json(
          { error: 'Системные роли не могут быть удалены' },
          { status: 400 }
        )
      }

      // Проверяем, используется ли роль пользователями
      const usersWithRole = await client.query(`
        SELECT COUNT(*) as count FROM users WHERE role_id = $1
      `, [roleId])

      if (parseInt(usersWithRole.rows[0].count) > 0) {

        await client.end()
        return NextResponse.json(
          { error: 'Роль используется пользователями и не может быть удалена' },
          { status: 400 }
        )
      }

      // Деактивируем роль вместо полного удаления
      await client.query(`
        UPDATE roles
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [roleId])

// Логируем удаление роли
      await client.query(`
        INSERT INTO user_audit_log (
          user_id, action, resource_type, resource_id,
          details, created_at
        ) VALUES ($1, 'role_deleted', 'role', $2, $3, CURRENT_TIMESTAMP)
      `, [
        session.user_id, roleId,
        JSON.stringify({
          role_name: roleName,
          deleted_by: session.user.username
        })
      ])

      await client.end()

      return NextResponse.json({
        success: true,
        message: 'Роль успешно удалена'
      })
    } catch (error) {
      await client.end()
      return NextResponse.json(
        { error: 'Ошибка удаления роли в базе данных' },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}