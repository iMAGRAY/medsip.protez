"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  Key,
  AlertTriangle,
  User,
  X,
  Check
} from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { useAuth } from '@/components/admin/auth-guard'

interface User {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  role: string
  roleDisplayName: string
  status: 'active' | 'inactive' | 'blocked' | 'pending'
  lastLogin?: string
  loginCount: number
  failedLoginAttempts: number
  createdAt: string
  emailVerified: boolean
}

interface Role {
  id: number
  name: string
  displayName: string
  description: string
  permissions: string[]
  isActive: boolean
}

type UserStatus = 'active' | 'inactive' | 'blocked' | 'pending';

const statusColors = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  blocked: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800'
}

const statusLabels = {
  active: 'Активен',
  inactive: 'Неактивен',
  blocked: 'Заблокирован',
  pending: 'Ожидает'
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const { authStatus, hasPermission } = useAuth()

  // Проверяем права доступа
  const canManageUsers = hasPermission('users.manage') || hasPermission('*')

  if (!canManageUsers) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <Shield className="w-16 h-16 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">Доступ запрещен</h2>
              <p className="text-gray-600 text-center">
                У вас нет прав для управления пользователями
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  useEffect(() => {
    loadUsers()
    loadRoles()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      } else {
        setError('Ошибка загрузки пользователей')
      }
    } catch (error) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/admin/roles', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setRoles(data.roles || [])
      }
    } catch (error) {
      console.error('Error loading roles:', error)
    }
  }

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleStatusChange = async (userId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        loadUsers() // Перезагружаем данные
      } else {
        setError('Ошибка изменения статуса пользователя')
      }
    } catch (error) {
      setError('Ошибка соединения с сервером')
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <Users className="w-7 h-7" />
              Управление пользователями
            </h1>
            <p className="text-gray-600 mt-1">
              Управление пользователями, ролями и правами доступа
            </p>
          </div>

          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Добавить пользователя
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Создание пользователя
                </DialogTitle>
                <DialogDescription>
                  Заполните форму для создания нового пользователя системы
                </DialogDescription>
              </DialogHeader>
              <UserForm
                roles={roles}
                onSuccess={() => {
                  setIsCreateModalOpen(false)
                  loadUsers()
                }}
                onCancel={() => setIsCreateModalOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Поиск по имени пользователя, email или имени..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1">
                {filteredUsers.length} пользователей
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Пользователи системы
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Загрузка пользователей...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-red-500">{error}</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Последний вход</TableHead>
                    <TableHead>Создан</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="font-medium flex items-center gap-2">
                            {user.username}
                            {user.id === 1 && (
                              <span title="Главный администратор">
                                <Shield className="w-4 h-4 text-blue-500" />
                              </span>
                            )}
                            {user.emailVerified && (
                              <UserCheck className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                          {user.firstName && user.lastName && (
                            <div className="text-sm text-gray-500">
                              {user.firstName} {user.lastName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {user.roleDisplayName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.id === 1 ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800 font-normal">
                            ✅ Активен (Главный администратор)
                          </Badge>
                        ) : (
                          <Select
                            value={user.status}
                            onValueChange={(value) => handleStatusChange(user.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">✅ Активен</SelectItem>
                              <SelectItem value="inactive">⏸️ Неактивен</SelectItem>
                              <SelectItem value="blocked">🚫 Заблокирован</SelectItem>
                              <SelectItem value="pending">⏳ Ожидает</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? (
                          <div className="text-sm">
                            <div>{formatDate(user.lastLogin)}</div>
                            <div className="text-gray-500">
                              Входов: {user.loginCount}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Никогда</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(user.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {user.id !== authStatus.user?.id && user.id !== 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Roles Section */}
        {/* Removed Roles Section as requested */}
      </div>

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Редактирование пользователя
              </DialogTitle>
              <DialogDescription>
                Изменение данных пользователя {editingUser.username}
                {editingUser.id === 1 && (
                  <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    <Shield className="w-3 h-3 mr-1" />
                    Главный администратор
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <UserForm
              user={editingUser}
              roles={roles}
              onSuccess={() => {
                setEditingUser(null)
                loadUsers()
              }}
              onCancel={() => setEditingUser(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  )
}

// Компонент формы пользователя
function UserForm({
  user,
  roles,
  onSuccess,
  onCancel
}: {
  user?: User
  roles: Role[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    roleId: user ? roles.find(r => r.name === user.role)?.id?.toString() || '' : '',
    password: '',
    status: (user?.status || 'active') as UserStatus
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = user ? `/api/admin/users/${user.id}` : '/api/admin/users'
      const method = user ? 'PATCH' : 'POST'

      // Запрещаем изменение статуса главного администратора
      if (user?.id === 1 && formData.status !== 'active') {
        setError('Нельзя деактивировать главного администратора')
        setLoading(false)
        return
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        setError(data.error || 'Ошибка сохранения пользователя')
      }
    } catch (error) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Секция основной информации */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <User className="w-4 h-4" />
          Основная информация
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username" className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5" />
              Логин
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              disabled={user?.id === 1}
              className={user?.id === 1 ? "bg-gray-100 border-gray-200" : ""}
            />
            {user?.id === 1 && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Логин главного администратора нельзя изменить
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="email" className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
        </div>
      </div>

      {/* Секция персональных данных */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Персональные данные
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">Имя</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="Введите имя"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Фамилия</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Введите фамилию"
            />
          </div>
        </div>
      </div>

      {/* Секция настроек доступа */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Настройки доступа
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="roleId">Роль</Label>
            <Select
              value={formData.roleId}
              onValueChange={(value) => setFormData({ ...formData, roleId: value })}
              disabled={user?.id === 1}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {user?.id === 1 && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Роль главного администратора нельзя изменить
              </p>
            )}
          </div>

          {user && (
            <div>
              <Label htmlFor="status">Статус</Label>
              {user.id === 1 ? (
                <div className="h-10 px-3 py-2 border border-input rounded-md bg-green-50 text-green-700 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Активен (не может быть изменен)
                </div>
              ) : (
                <Select
                  value={formData.status}
                  onValueChange={(value: UserStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">✅ Активен</SelectItem>
                    <SelectItem value="inactive">⏸️ Неактивен</SelectItem>
                    <SelectItem value="blocked">🚫 Заблокирован</SelectItem>
                    <SelectItem value="pending">⏳ Ожидает</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {!user && (
          <div className="mt-4">
            <Label htmlFor="password" className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5" />
              Пароль
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!user}
              placeholder="Введите пароль для нового пользователя"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onCancel} className="gap-2">
          <X className="w-4 h-4" />
          Отмена
        </Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Сохранение...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {user ? 'Сохранить' : 'Создать'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}