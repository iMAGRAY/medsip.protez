import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/database-auth'

// Принудительно делаем маршрут динамическим
export const dynamic = 'force-dynamic'

// Список всех доступных прав доступа в системе
const AVAILABLE_PERMISSIONS = [
  // Права суперадминистратора
  { id: '*', name: 'Все права (суперадминистратор)', category: 'system' },

  // Права на управление пользователями
  { id: 'users.view', name: 'Просмотр пользователей', category: 'users' },
  { id: 'users.manage', name: 'Управление пользователями', category: 'users' },

  // Права на управление ролями
  { id: 'roles.view', name: 'Просмотр ролей', category: 'roles' },
  { id: 'roles.manage', name: 'Управление ролями', category: 'roles' },

  // Права на управление товарами
  { id: 'products.view', name: 'Просмотр товаров', category: 'products' },
  { id: 'products.read', name: 'Чтение товаров', category: 'products' },
  { id: 'products.create', name: 'Создание товаров', category: 'products' },
  { id: 'products.update', name: 'Обновление товаров', category: 'products' },
  { id: 'products.delete', name: 'Удаление товаров', category: 'products' },
  { id: 'products.*', name: 'Все права на товары', category: 'products' },

  // Права на управление категориями
  { id: 'categories.view', name: 'Просмотр категорий', category: 'categories' },
  { id: 'categories.read', name: 'Чтение категорий', category: 'categories' },
  { id: 'categories.create', name: 'Создание категорий', category: 'categories' },
  { id: 'categories.update', name: 'Обновление категорий', category: 'categories' },
  { id: 'categories.delete', name: 'Удаление категорий', category: 'categories' },
  { id: 'categories.*', name: 'Все права на категории', category: 'categories' },

  // Права на управление характеристиками
  { id: 'specifications.view', name: 'Просмотр характеристик', category: 'specifications' },
  { id: 'specifications.read', name: 'Чтение характеристик', category: 'specifications' },
  { id: 'specifications.create', name: 'Создание характеристик', category: 'specifications' },
  { id: 'specifications.update', name: 'Обновление характеристик', category: 'specifications' },
  { id: 'specifications.delete', name: 'Удаление характеристик', category: 'specifications' },
  { id: 'specifications.*', name: 'Все права на характеристики', category: 'specifications' },

  // Права на управление производителями
  { id: 'manufacturers.view', name: 'Просмотр производителей', category: 'manufacturers' },
  { id: 'manufacturers.read', name: 'Чтение производителей', category: 'manufacturers' },
  { id: 'manufacturers.create', name: 'Создание производителей', category: 'manufacturers' },
  { id: 'manufacturers.update', name: 'Обновление производителей', category: 'manufacturers' },
  { id: 'manufacturers.delete', name: 'Удаление производителей', category: 'manufacturers' },
  { id: 'manufacturers.*', name: 'Все права на производителей', category: 'manufacturers' },

  // Права на управление медиа
  { id: 'media.view', name: 'Просмотр медиа', category: 'media' },
  { id: 'media.read', name: 'Чтение медиа', category: 'media' },
  { id: 'media.upload', name: 'Загрузка медиа', category: 'media' },
  { id: 'media.delete', name: 'Удаление медиа', category: 'media' },
  { id: 'media.*', name: 'Все права на медиа', category: 'media' },

  // Права на управление заказами
  { id: 'orders.view', name: 'Просмотр заказов', category: 'orders' },
  { id: 'orders.read', name: 'Чтение заказов', category: 'orders' },
  { id: 'orders.create', name: 'Создание заказов', category: 'orders' },
  { id: 'orders.update', name: 'Обновление заказов', category: 'orders' },
  { id: 'orders.delete', name: 'Удаление заказов', category: 'orders' },
  { id: 'orders.*', name: 'Все права на заказы', category: 'orders' },

  // Права на управление складом
  { id: 'warehouse.view', name: 'Просмотр склада', category: 'warehouse' },
  { id: 'warehouse.read', name: 'Чтение склада', category: 'warehouse' },
  { id: 'warehouse.manage', name: 'Управление складом', category: 'warehouse' },
  { id: 'warehouse.*', name: 'Все права на склад', category: 'warehouse' },

  // Права на управление настройками
  { id: 'settings.view', name: 'Просмотр настроек', category: 'settings' },
  { id: 'settings.read', name: 'Чтение настроек', category: 'settings' },
  { id: 'settings.update', name: 'Обновление настроек', category: 'settings' },
  { id: 'settings.*', name: 'Все права на настройки', category: 'settings' },

  // Права на управление кешем
  { id: 'cache.view', name: 'Просмотр кеша', category: 'cache' },
  { id: 'cache.clear', name: 'Очистка кеша', category: 'cache' },
  { id: 'cache.*', name: 'Все права на кеш', category: 'cache' },

  // Права на управление каталогами
  { id: 'catalog.view', name: 'Просмотр каталогов', category: 'catalog' },
  { id: 'catalog.read', name: 'Чтение каталогов', category: 'catalog' },
  { id: 'catalog.create', name: 'Создание каталогов', category: 'catalog' },
  { id: 'catalog.update', name: 'Обновление каталогов', category: 'catalog' },
  { id: 'catalog.delete', name: 'Удаление каталогов', category: 'catalog' },
  { id: 'catalog.*', name: 'Все права на каталоги', category: 'catalog' },
]

// GET - получение списка доступных прав доступа
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

    // Проверяем права доступа (доступно только для админов)
    if (!session.user.role_permissions?.includes('*') &&
        !session.user.role_permissions?.includes('roles.view') &&
        !session.user.role_permissions?.includes('roles.manage') &&
        !session.user.role_permissions?.includes('users.manage')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Группируем права по категориям
    const _permissionsByCategory = AVAILABLE_PERMISSIONS.reduce((acc, permission) => {
      const category = permission.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(permission)
      return acc
    }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>)

    return NextResponse.json({
      success: true,
      permissions: AVAILABLE_PERMISSIONS,
      permissionsByCategory: _permissionsByCategory
    })

  } catch (error) {
    console.error('Error getting permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}