"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Info,
  AlertTriangle,
  Lock,
  User,
  Users,
  Key,
  ChevronDown
} from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { useAuth } from '@/components/admin/auth-guard'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Типы данных
interface Role {
  id: number
  name: string
  displayName: string
  description: string
  permissions: string[]
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

interface Permission {
  id: string
  name: string
  category: string
}

// Страница управления ролями
export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionsByCategory, setPermissionsByCategory] = useState<Record<string, Permission[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleteRole, setDeleteRole] = useState<Role | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { authStatus } = useAuth()

  // Проверяем, является ли текущий пользователь главным администратором
  const isSuperAdmin = authStatus.user?.id === 1

  useEffect(() => {
    loadRoles()
    loadPermissions()
  }, [])

  const loadRoles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/roles', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setRoles(data.roles || [])
      } else {
        setError('Ошибка загрузки ролей')
      }
    } catch (error) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const loadPermissions = async () => {
    try {
      const response = await fetch('/api/admin/permissions', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setPermissions(data.permissions || [])
        setPermissionsByCategory(data.permissionsByCategory || {})
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка загрузки прав доступа')
        console.error('Error loading permissions:', errorData)
      }
    } catch (error) {
      console.error('Error loading permissions:', error)
      setError('Ошибка соединения с сервером при загрузке прав доступа')
    }
  }

  const handleDeleteRole = async (roleId: number) => {
    try {
      setDeleteLoading(true)

      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()

        loadRoles()
        setDeleteRole(null)
      } else {
        const data = await response.json()
        console.error('Error deleting role:', data)
        alert(data.error || 'Ошибка удаления роли')
      }
    } catch (error) {
      console.error('Error in role deletion:', error)
      alert('Ошибка соединения с сервером')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Форматирование даты
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <Shield className="w-7 h-7" />
              Управление ролями и правами доступа
            </h1>
            <p className="text-gray-600 mt-1">
              Управление ролями пользователей и их правами доступа
            </p>
          </div>

          {isSuperAdmin && (
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Добавить роль
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Создание новой роли
                  </DialogTitle>
                  <DialogDescription>
                    Заполните форму для создания новой роли с необходимыми правами доступа
                  </DialogDescription>
                </DialogHeader>
                <RoleForm
                  permissions={permissions}
                  permissionsByCategory={permissionsByCategory}
                  onSuccess={() => {
                    setIsCreateModalOpen(false)
                    loadRoles()
                  }}
                  onCancel={() => setIsCreateModalOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Roles Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Роли системы
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Загрузка ролей...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-red-500">{error}</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Права доступа</TableHead>
                    <TableHead>Создана</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="font-medium flex items-center gap-2">
                            {role.displayName}
                            {role.name === 'super_admin' && (
                              <Badge variant="destructive" className="ml-2">
                                <Lock className="w-3 h-3 mr-1" />
                                Системная
                              </Badge>
                            )}
                            {['admin', 'moderator', 'editor', 'viewer'].includes(role.name) && (
                              <Badge variant="secondary" className="ml-2">
                                <Info className="w-3 h-3 mr-1" />
                                Системная
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {role.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-xs">
                          {role.description || 'Нет описания'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.includes('*') ? (
                            <Badge variant="destructive">
                              Все права
                            </Badge>
                          ) : (
                            <>
                              {role.permissions.slice(0, 3).map((permission, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {permission}
                                </Badge>
                              ))}
                              {role.permissions.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{role.permissions.length - 3}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(role.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRole(role)}
                            disabled={!isSuperAdmin}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {!['super_admin', 'admin', 'moderator', 'editor', 'viewer'].includes(role.name) && isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => setDeleteRole(role)}
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

        {/* Permissions Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Доступные права
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="system">
              <TabsList className="mb-4">
                {Object.keys(permissionsByCategory).map((category) => (
                  <TabsTrigger key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <TabsContent key={category} value={category} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {perms.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-center p-2 border rounded-md"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{permission.name}</div>
                          <div className="text-xs text-gray-500">{permission.id}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Edit Role Dialog */}
      {editingRole && (
        <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Редактирование роли
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <span>Изменение настроек роли <strong>{editingRole.displayName}</strong></span>
                {['super_admin', 'admin', 'moderator', 'editor', 'viewer'].includes(editingRole.name) && (
                  <Badge variant={editingRole.name === 'super_admin' ? "destructive" : "secondary"} className="ml-2">
                    <Lock className="w-3 h-3 mr-1" />
                    {editingRole.name === 'super_admin' ? 'Главный администратор' : 'Системная роль'}
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>
            <RoleForm
              role={editingRole}
              permissions={permissions}
              permissionsByCategory={permissionsByCategory}
              onSuccess={() => {
                setEditingRole(null)
                loadRoles()
              }}
              onCancel={() => setEditingRole(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Role Dialog */}
      <AlertDialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление роли</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить роль <strong>{deleteRole?.displayName}</strong>?
              <br />
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteRole && handleDeleteRole(deleteRole.id)}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}

// Компонент формы роли
function RoleForm({
  role,
  permissions,
  permissionsByCategory,
  onSuccess,
  onCancel
}: {
  role?: Role
  permissions: Permission[]
  permissionsByCategory: Record<string, Permission[]>
  onSuccess: () => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    displayName: role?.displayName || '',
    description: role?.description || '',
    permissions: role?.permissions || []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('system')

  // Проверяем, является ли роль системной
  const isSystemRole = role && ['super_admin', 'admin', 'moderator', 'editor', 'viewer'].includes(role.name)
  const isSuperAdmin = role?.name === 'super_admin'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Проверяем валидность формы
      if (!formData.displayName.trim()) {
        setError('Название роли обязательно')
        setLoading(false)
        return
      }

      if (!role && !formData.name.trim()) {
        setError('Идентификатор роли обязателен')
        setLoading(false)
        return
      }

      let url = '/api/admin/roles'
      let method = 'POST'

      if (role) {
        url = `/api/admin/roles/${role.id}`
        method = 'PATCH'
      }

      // Подготавливаем данные
      const requestData = {
        ...(role ? { id: role.id } : {}),
        ...(role ? {} : { name: formData.name.toLowerCase().replace(/[^a-z0-9_]/g, '_') }),
        displayName: formData.displayName.trim(),
        description: formData.description.trim() || undefined,
        permissions: formData.permissions
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestData)
      })

      if (response.ok) {
        const data = await response.json()

        onSuccess()
      } else {
        const data = await response.json()
        console.error('Error saving role:', data)
        setError(data.error || 'Ошибка сохранения роли')
      }
    } catch (error) {
      console.error('Error in role form submission:', error)
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (permissionId: string) => {
    setFormData(prev => {
      if (prev.permissions.includes(permissionId)) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => p !== permissionId)
        }
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, permissionId]
        }
      }
    })
  }

  const selectAllInCategory = (category: string) => {
    const categoryPermissions = permissionsByCategory[category]?.map(p => p.id) || []

    setFormData(prev => {
      // Проверяем, все ли права из категории уже выбраны
      const allSelected = categoryPermissions.every(p => prev.permissions.includes(p))

      if (allSelected) {
        // Если все выбраны, убираем их
        return {
          ...prev,
          permissions: prev.permissions.filter(p => !categoryPermissions.includes(p))
        }
      } else {
        // Если не все выбраны, добавляем недостающие
        const newPermissions = [...prev.permissions]
        categoryPermissions.forEach(p => {
          if (!newPermissions.includes(p)) {
            newPermissions.push(p)
          }
        })
        return {
          ...prev,
          permissions: newPermissions
        }
      }
    })
  }

  return (
    <div className="max-h-[75vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {isSuperAdmin && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
            <div className="flex items-center gap-2 font-medium text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              Внимание!
            </div>
            <p className="mt-1 text-yellow-700">
              Роль суперадминистратора имеет все права и не может быть изменена.
            </p>
          </div>
        )}

        {isSystemRole && !isSuperAdmin && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <div className="flex items-center gap-2 font-medium text-blue-800">
              <Info className="w-4 h-4" />
              Информация
            </div>
            <p className="mt-1 text-blue-700">
              Это системная роль. Вы можете изменить её название и описание, но не можете изменить идентификатор.
            </p>
          </div>
        )}

        {/* Основная информация о роли */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Основная информация
          </h3>

          <div className="space-y-3">
            {!role && (
              <div>
                <Label htmlFor="name" className="flex items-center gap-1 text-sm">
                  <Key className="w-3.5 h-3.5" />
                  Идентификатор роли
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="role_name"
                  required
                  disabled={!!role}
                  className="font-mono mt-1 h-8"
                />
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Используется в системе. Только латинские буквы, цифры и подчеркивания.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="displayName" className="flex items-center gap-1 text-sm">
                  <User className="w-3.5 h-3.5" />
                  Название роли
                </Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Название роли"
                  required
                  disabled={isSuperAdmin}
                  className={`mt-1 h-8 ${isSuperAdmin ? "bg-gray-100 border-gray-200" : ""}`}
                />
                {isSuperAdmin && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Название роли суперадминистратора нельзя изменить
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description" className="flex items-center gap-1 text-sm">
                  <Info className="w-3.5 h-3.5" />
                  Описание
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание роли и её назначение"
                  disabled={isSuperAdmin}
                  className={`mt-1 resize-none h-16 ${isSuperAdmin ? "bg-gray-100 border-gray-200" : ""}`}
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>

        {!isSuperAdmin && (
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Права доступа
              </h3>
              <Badge variant="outline" className="text-xs">
                {formData.permissions.length} выбрано
              </Badge>
            </div>

            <div className="w-full space-y-3">
              {/* Выбор категории */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Категория:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Shield className="w-4 h-4" />
                      {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {Object.keys(permissionsByCategory).map((category) => (
                      <DropdownMenuItem
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={selectedCategory === category ? "bg-blue-50" : ""}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Отображение прав выбранной категории */}
              {(() => {
                const categoryPermissions = permissionsByCategory[selectedCategory] || [];
                const selectedInCategory = categoryPermissions.filter(p => formData.permissions.includes(p.id)).length;
                const totalInCategory = categoryPermissions.length;

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                        <Badge variant="outline" className="text-xs">
                          {selectedInCategory}/{totalInCategory}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllInCategory(selectedCategory)}
                        className="gap-1 h-7 text-xs px-2"
                      >
                        <Check className="w-3 h-3" />
                        {selectedInCategory === totalInCategory ? 'Снять все' : 'Выбрать все'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                      {categoryPermissions.map((permission) => (
                        <div
                          key={permission.id}
                          className={`flex items-start space-x-2 p-2 border rounded-lg transition-colors cursor-pointer ${
                            formData.permissions.includes(permission.id)
                              ? "bg-blue-50 border-blue-200"
                              : "bg-white hover:bg-gray-50 border-gray-200"
                          }`}
                          onClick={() => togglePermission(permission.id)}
                        >
                          <Checkbox
                            id={permission.id}
                            checked={formData.permissions.includes(permission.id)}
                            onCheckedChange={() => togglePermission(permission.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {permission.name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">
                              {permission.id}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <Button type="button" variant="outline" onClick={onCancel} className="gap-2 h-8">
            <X className="w-4 h-4" />
            Отмена
          </Button>
          <Button type="submit" disabled={loading || isSuperAdmin} className="gap-2 h-8">
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Сохранение...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {role ? 'Сохранить' : 'Создать'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}