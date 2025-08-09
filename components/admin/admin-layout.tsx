"use client"

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  Menu,
  Home,
  Package,
  Users,
  Settings,
  BarChart3,
  Image as ImageIcon,
  FileText,
  Database,
  Layers,
  Grid3X3,
  Palette,
  Tag,
  Monitor,
  Activity,
  LogOut,
  Shield,
  Warehouse,
  ClipboardList,
  Star,
  FileDown
} from 'lucide-react'
import { InstantLink } from '@/components/instant-link'
import { AutoSkeleton, useSkeleton } from '@/components/skeleton-provider'
import { useAuth } from './auth-guard'
import { OrdersProvider, useOrders } from '@/lib/orders-context'

interface AdminLayoutProps {
  children: React.ReactNode
}

interface NavigationItem {
  title: string
  href: string
  icon: any
  exact?: boolean
  badge?: string
  isModal?: boolean
  count?: number
}

// Функция для получения списка навигации с учетом прав пользователя
const getAdminNavigation = (userRole?: string, ordersCount?: number, userId?: number): NavigationItem[] => {
  const baseNavigation: NavigationItem[] = [
    {
      title: 'Дашборд',
      href: '/admin',
      icon: BarChart3,
      exact: true
    },
    {
      title: 'Склад',
      href: '/admin/warehouse',
      icon: Warehouse
    },
    {
              title: 'Товары',
      href: '/admin/products',
      icon: Package
    },
    {
      title: 'Категории',
      href: '/admin/categories',
      icon: Grid3X3
    },
    {
      title: 'Теги',
      href: '/admin/tags',
      icon: Tag
    },
    {
      title: 'Производители',
      href: '/admin/manufacturers',
      icon: Users
    },
    {
      title: 'Характеристики',
      href: '/admin/specifications',
      icon: FileText
    },
    {
      title: 'Медиа',
      href: '/admin/media',
      icon: ImageIcon
    },
    {
      title: 'Redis Monitor',
      href: '/admin/redis-monitor',
      icon: Activity
    },
    {
      title: 'Заказы',
      href: '/admin/orders',
      icon: ClipboardList,
      count: ordersCount
    },
    {
      title: 'Файлы каталога',
      href: '/admin/catalog-files',
      icon: FileDown
    }
  ]

  // Добавляем управление пользователями только для супер-админа
  if (userRole === 'super_admin') {
    baseNavigation.push({
      title: 'Пользователи',
      href: '/admin/users',
      icon: Shield
    })
  }

  // Добавляем управление ролями только для главного администратора (id=1)
  if (userId === 1) {
    baseNavigation.push({
      title: 'Роли и права',
      href: '/admin/roles',
      icon: Shield
    })
  }

  // Настройки добавляем в конец
  baseNavigation.push({
    title: 'Настройки',
    href: '/admin/settings',
    icon: Settings
  })

  return baseNavigation
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { isPageLoading } = useSkeleton()
  const { authStatus, handleLogout } = useAuth()
  const { ordersCount, refreshOrdersCount } = useOrders()

  // Обновляем счетчик при переходе на страницу заказов
  useEffect(() => {
    if (pathname === '/admin/orders') {
      refreshOrdersCount()
    }
  }, [pathname, refreshOrdersCount])

  // Получаем навигацию с учетом роли пользователя
  const adminNavigation = getAdminNavigation(authStatus.user?.role, ordersCount, authStatus.user?.id)

  const isActive = (href: string, exact?: boolean) => {
    if (!pathname) return false
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <InstantLink
          href="/admin"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center border border-gray-200">
            <Monitor className="w-4 h-4 text-gray-500" />
          </div>
          <span className="text-lg font-normal text-gray-700">Админ панель</span>
        </InstantLink>

        {/* Logout Button */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Shield className="w-3 h-3" />
            <span>Сессия: {authStatus.user?.username}</span>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="w-full flex items-center gap-2 text-gray-500 hover:text-red-500 hover:bg-red-50 justify-start px-2 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            Выход
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {adminNavigation.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href, item.exact)

          return (
            <InstantLink
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-sm ${
                active
                  ? 'bg-white text-gray-700 font-normal shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm'
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <Icon className={`w-4 h-4 transition-colors ${
                active ? 'text-gray-600' : 'text-gray-400 group-hover:text-gray-500'
              }`} />
              <span className="flex-1">{item.title}</span>
              {item.count !== undefined && item.title === 'Заказы' && (
                <Badge
                  variant="secondary"
                  className={`text-xs px-1.5 py-0.5 transition-all duration-300 ${
                    item.count > 0
                      ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}
                >
                  {item.count}
                </Badge>
              )}
              {item.badge && (
                <Badge
                  variant={item.badge === 'hot' ? 'destructive' : 'secondary'}
                  className="text-xs px-1.5 py-0.5"
                >
                  {item.badge === 'hot' ? '🔥' : 'NEW'}
                </Badge>
              )}
            </InstantLink>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 mt-auto">
        <InstantLink
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm rounded-lg transition-all duration-200 text-sm"
        >
          <Home className="w-4 h-4" />
          <span>На сайт</span>
        </InstantLink>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <InstantLink href="/admin" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
              <Monitor className="w-3 h-3 text-gray-500" />
            </div>
            <span className="font-normal text-gray-700">Админ панель</span>
          </InstantLink>

          {/* Mobile Logout Button */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="w-3 h-3" />
            </Button>

            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-lg">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="lg:flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 h-screen sticky top-0 border-r border-gray-200">
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          <div className="p-6">
            <AutoSkeleton isLoading={isPageLoading}>
              {children}
            </AutoSkeleton>
          </div>
        </main>
      </div>
    </div>
  )
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>
}
