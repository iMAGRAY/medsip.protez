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

// GET - получение списка ролей
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

    // Проверяем права доступа (ролевая информация доступна только админам)
    if (!session.user.role_permissions?.includes('*') &&
        !session.user.role_permissions?.includes('users.manage') &&
        !session.user.role_permissions?.includes('roles.view') &&
        !session.user.role_permissions?.includes('roles.manage')) {
return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

const client = getDbConnection()
    await client.connect()

    try {
      // Получаем все активные роли
      const result = await client.query(`
        SELECT
          id, name, display_name, description, permissions, is_active,
          created_at, updated_at
        FROM roles
        WHERE is_active = true
        ORDER BY
          CASE
            WHEN name = 'super_admin' THEN 1
            WHEN name = 'admin' THEN 2
            WHEN name = 'moderator' THEN 3
            WHEN name = 'editor' THEN 4
            WHEN name = 'viewer' THEN 5
            ELSE 6
          END
      `)

      const _roles = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        permissions: row.permissions || [],
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))

      await client.end()

      return NextResponse.json({
        success: true,
        roles
      })
    } catch (error) {
      console.error('Database error getting roles:', error)
      await client.end()
      return NextResponse.json(
        { error: 'Ошибка получения ролей из базы данных' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error getting roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - создание новой роли (только для главного администратора)
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

    // Проверяем, что запрос выполнен главным администратором (id=1)
    if (session.user_id !== 1) {
      return NextResponse.json(
        { error: 'Только главный администратор может создавать роли' },
        { status: 403 }
      )
    }

    const data = await request.json()

    const { name, displayName, description, permissions = [] } = data

    // Валидация
    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Название роли и отображаемое имя обязательны' },
        { status: 400 }
      )
    }

    // Проверка формата имени роли (только латинские буквы, цифры и подчеркивания)
    if (!/^[a-z0-9_]+$/.test(name)) {
      return NextResponse.json(
        { error: 'Название роли должно содержать только латинские буквы в нижнем регистре, цифры и подчеркивания' },
        { status: 400 }
      )
    }

    const client = getDbConnection()
    await client.connect()

    try {
      // Проверяем уникальность имени роли
      const existingRole = await client.query(`
        SELECT id FROM roles WHERE name = $1
      `, [name])

      if (existingRole.rows.length > 0) {
        await client.end()
        return NextResponse.json(
          { error: 'Роль с таким названием уже существует' },
          { status: 400 }
        )
      }

      // Создаем новую роль
      const result = await client.query(`
        INSERT INTO roles (
          name, display_name, description, permissions, is_active,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, name, display_name, description, permissions, is_active, created_at
      `, [name, displayName, description || null, permissions])

      const newRole = result.rows[0]

      // Логируем создание роли
      await client.query(`
        INSERT INTO user_audit_log (
          user_id, action, resource_type, resource_id,
          details, created_at
        ) VALUES ($1, 'role_created', 'role', $2, $3, CURRENT_TIMESTAMP)
      `, [
        session.user_id, newRole.id,
        JSON.stringify({
          role_name: newRole.name,
          created_by: session.user.username
        })
      ])

      await client.end()

      return NextResponse.json({
        success: true,
        role: {
          id: newRole.id,
          name: newRole.name,
          displayName: newRole.display_name,
          description: newRole.description,
          permissions: newRole.permissions || [],
          isActive: newRole.is_active,
          createdAt: newRole.created_at
        }
      })
    } catch (error) {
      console.error('Database error creating role:', error)
      await client.end()
      return NextResponse.json(
        { error: 'Ошибка создания роли в базе данных' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - обновление роли (только для главного администратора)
export async function PUT(request: NextRequest) {
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

    const data = await request.json()
    const { id, displayName, description, permissions } = data

    // Валидация
    if (!id || !displayName) {
      return NextResponse.json(
        { error: 'ID роли и отображаемое имя обязательны' },
        { status: 400 }
      )
    }

    const client = getDbConnection()
    await client.connect()

    // Проверяем существование роли
    const existingRole = await client.query(`
      SELECT id, name FROM roles WHERE id = $1
    `, [id])

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

    try {
      // Обновляем роль
      const result = await client.query(`
        UPDATE roles
        SET display_name = $1, description = $2, permissions = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, name, display_name, description, permissions, is_active, updated_at
      `, [displayName, description || null, permissions || [], id])

      const updatedRole = result.rows[0]

      // Логируем обновление роли
      await client.query(`
        INSERT INTO user_audit_log (
          user_id, action, resource_type, resource_id,
          details, created_at
        ) VALUES ($1, 'role_updated', 'role', $2, $3, CURRENT_TIMESTAMP)
      `, [
        session.user_id, id,
        JSON.stringify({
          role_name: updatedRole.name,
          updated_fields: Object.keys(data).filter(key => key !== 'id'),
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
      console.error('Database error updating role:', error)
      await client.end()
      return NextResponse.json(
        { error: 'Ошибка обновления роли в базе данных' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - удаление роли (только для главного администратора)
export async function DELETE(request: NextRequest) {
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

    // Получаем ID роли из URL параметров
    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get('id')

    if (!roleId) {
      return NextResponse.json(
        { error: 'ID роли обязателен' },
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
      console.error('Database error deleting role:', error)
      await client.end()
      return NextResponse.json(
        { error: 'Ошибка удаления роли в базе данных' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}