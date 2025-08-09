'use client'

import React, { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, MoreVertical, Edit, Trash2, Settings, Eye, EyeOff, Plus, Save, RefreshCw, Layers, Folder, Building, Package } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SearchableCategorySelect } from '@/components/ui/searchable-category-select'

// Типы для универсальной системы меню
interface MenuEntity {
  entity_type: 'spec_group' | 'category' | 'manufacturer' | 'model_line' | 'manufacturers_category'
  entity_id: number
  name: string
  description?: string
  parent_id?: number | null
  is_active?: boolean
  in_menu: boolean
  characteristics_count?: number
  children_count?: number
  is_root?: boolean
  category_type?: string
  country?: string
  model_lines_count?: number
  manufacturer_id?: number
  manufacturer_name?: string
}

interface CatalogMenuItem {
  id: number
  entity_type: 'spec_group' | 'category' | 'manufacturer' | 'model_line' | 'manufacturers_category'
  entity_id: number
  name: string
  description?: string
  parent_id?: number | null
  sort_order: number
  is_visible: boolean
  is_expanded: boolean
  show_in_main_menu: boolean
  icon?: string
  css_class?: string
  custom_url?: string
  created_at?: string
  updated_at?: string
  children?: CatalogMenuItem[]

  // Дополнительные данные из исходных таблиц
  characteristics_count?: number
  original_name?: string
  original_description?: string
  category_type?: string
  country?: string
  manufacturer_id?: number
}

interface HierarchicalMenuItemProps {
  item: CatalogMenuItem
  level: number
  onToggleVisibility: (item: CatalogMenuItem) => void
  onToggleExpanded: (item: CatalogMenuItem) => void
  onEdit: (item: CatalogMenuItem) => void
  onDelete: (item: CatalogMenuItem) => void
}

const EntityTypeIcons = {
  spec_group: Layers,
  category: Folder,
  manufacturer: Building,
  model_line: Package,
  manufacturers_category: Building
}

const EntityTypeLabels = {
  spec_group: 'Группа характеристик',
  category: 'Категория',
  manufacturer: 'Производитель',
  model_line: 'Модельный ряд',
  manufacturers_category: 'Каталог производителей'
}

function HierarchicalMenuItem({
  item,
  level,
  onToggleVisibility,
  onToggleExpanded,
  onEdit,
  onDelete
}: HierarchicalMenuItemProps) {
  const hasChildren = item.children && item.children.length > 0
  const paddingLeft = level * 24 + 16
  const IconComponent = EntityTypeIcons[item.entity_type]

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className="flex items-center justify-between py-3 hover:bg-gray-50 transition-colors"
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '16px' }}
      >
        <div className="flex items-center space-x-3">
          {hasChildren ? (
            <button
              onClick={() => onToggleExpanded(item)}
              className="flex items-center justify-center w-5 h-5 text-gray-400 hover:text-gray-600"
            >
              {item.is_expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5 h-5" />
          )}

          <IconComponent className="h-4 w-4 text-gray-500" />

          <div className="flex flex-col">
            <span className={`${level === 0 ? 'font-medium' : 'font-normal'} text-gray-900`}>
              {item.name}
            </span>
            {item.description && (
              <span className="text-xs text-gray-500">{item.description}</span>
            )}
          </div>

          <Badge variant="outline" className="text-xs">
            {EntityTypeLabels[item.entity_type]}
          </Badge>

          {item.entity_type === 'spec_group' && item.characteristics_count !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {item.characteristics_count} хар-к
            </Badge>
          )}

          {!item.is_visible && (
            <Badge variant="destructive" className="text-xs">
              Скрыто
            </Badge>
          )}

          <Badge variant="outline" className="text-xs">
            #{item.sort_order}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onToggleVisibility(item)}>
                {item.is_visible ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Скрыть из меню
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Показать в меню
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="h-4 w-4 mr-2" />
                Редактировать
              </DropdownMenuItem>
              {hasChildren && (
                <DropdownMenuItem onClick={() => onToggleExpanded(item)}>
                  <Settings className="h-4 w-4 mr-2" />
                  {item.is_expanded ? 'Свернуть по умолчанию' : 'Развернуть по умолчанию'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(item)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить из меню
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {item.is_expanded && hasChildren && (
        <div className="bg-gray-50">
          {item.children?.map(child => (
            <HierarchicalMenuItem
              key={child.id}
              item={child}
              level={level + 1}
              onToggleVisibility={onToggleVisibility}
              onToggleExpanded={onToggleExpanded}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CatalogMenuPage() {
  const [menuSettings, setMenuSettings] = useState<CatalogMenuItem[]>([])
  const [availableEntities, setAvailableEntities] = useState<{[key: string]: MenuEntity[]}>({})
  const [selectedEntityType, setSelectedEntityType] = useState<'spec_group' | 'category' | 'manufacturer' | 'model_line' | 'manufacturers_category'>('spec_group')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sort_order: 0,
    is_visible: true,
    is_expanded: false,
    show_in_main_menu: true,
    entity_id: null as number | null,
    entity_type: 'spec_group' as 'spec_group' | 'category' | 'manufacturer' | 'model_line' | 'manufacturers_category',
    parent_id: null as number | null,
    icon: '',
    css_class: '',
    custom_url: ''
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {

      // Загружаем текущее меню
      const menuResponse = await fetch('/api/catalog-menu')
      const menuData = await menuResponse.json()

      if (menuData.success) {

        setMenuSettings(menuData.flat || [])
      } else {
        console.error('❌ Ошибка загрузки меню:', menuData.error)
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить настройки меню",
          variant: "destructive"
        })
      }

      // Загружаем доступные сущности
      const entitiesResponse = await fetch('/api/catalog-menu/available-entities')
      const entitiesData = await entitiesResponse.json()

      if (entitiesData.success) {

        setAvailableEntities(entitiesData.data)
      } else {
        console.error('❌ Ошибка загрузки сущностей:', entitiesData.error)
      }

    } catch (error) {
      console.error('💥 Ошибка при загрузке данных:', error)
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке данных",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleVisibility = async (item: CatalogMenuItem) => {
    if (!item.id) return
    setSaving(true)
    try {
      const response = await fetch(`/api/catalog-menu?id=${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...item,
          is_visible: !item.is_visible
        }),
      })

      if (response.ok) {
        await loadData()
        toast({
          title: "Успешно",
          description: `Элемент ${!item.is_visible ? 'показан' : 'скрыт'} в меню`,
        })
      } else {
        throw new Error('Ошибка обновления видимости')
      }
    } catch (error) {
      console.error('Ошибка обновления видимости:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось обновить видимость элемента",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleExpanded = async (item: CatalogMenuItem) => {
    if (!item.id) return
    setSaving(true)
    try {
      const response = await fetch(`/api/catalog-menu?id=${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...item,
          is_expanded: !item.is_expanded
        }),
      })

      if (response.ok) {
        await loadData()
        toast({
          title: "Успешно",
          description: `Элемент ${!item.is_expanded ? 'развернут' : 'свернут'} по умолчанию`,
        })
      } else {
        throw new Error('Ошибка обновления состояния')
      }
    } catch (error) {
      console.error('Ошибка обновления состояния:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось обновить состояние элемента",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item: CatalogMenuItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      sort_order: item.sort_order,
      is_visible: item.is_visible,
      is_expanded: item.is_expanded,
      show_in_main_menu: item.show_in_main_menu,
      entity_id: item.entity_id,
      entity_type: item.entity_type,
      parent_id: item.parent_id || null,
      icon: item.icon || '',
      css_class: item.css_class || '',
      custom_url: item.custom_url || ''
    })
    setEditingId(item.id || null)
    setIsAddingNew(false)
    setIsDialogOpen(true)
  }

  const handleDelete = async (item: CatalogMenuItem) => {
    if (!item.id) return

    setSaving(true)
    try {
      const response = await fetch(`/api/catalog-menu?id=${item.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadData()
        toast({
          title: "Успешно",
          description: "Элемент удален из меню",
        })
      } else {
        throw new Error('Ошибка удаления')
      }
    } catch (error) {
      console.error('Ошибка удаления:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось удалить элемент",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = () => {
    setFormData({
      name: '',
      description: '',
      sort_order: menuSettings.length,
      is_visible: true,
      is_expanded: false,
      show_in_main_menu: true,
      entity_id: null,
      entity_type: 'spec_group',
      parent_id: null,
      icon: '',
      css_class: '',
      custom_url: ''
    })
    setEditingId(null)
    setIsAddingNew(true)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Валидация
      if (!formData.name.trim()) {
        throw new Error('Название обязательно')
      }

      if (formData.entity_type !== 'manufacturers_category' && !formData.entity_id) {
        throw new Error('Выберите сущность')
      }

      const payload = {
        ...formData,
        // Для manufacturers_category устанавливаем специальные значения
        ...(formData.entity_type === 'manufacturers_category' && {
          entity_id: 0,
          name: formData.name || 'Все производители',
          description: formData.description || 'Автоматическая категория, включающая всех активных производителей'
        })
      }

      const url = editingId
        ? `/api/catalog-menu?id=${editingId}`
        : '/api/catalog-menu'

      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Ошибка ${method === 'PUT' ? 'обновления' : 'создания'}`)
      }

      // Обновляем данные
      await loadData()

      // Сбрасываем форму
      setEditingId(null)
      setFormData({
        name: '',
        description: '',
        sort_order: 0,
        is_visible: true,
        is_expanded: false,
        show_in_main_menu: true,
        entity_id: null,
        entity_type: 'spec_group',
        parent_id: null,
        icon: '',
        css_class: '',
        custom_url: ''
      })

    } catch (error) {
      console.error('Error saving:', error)
      // Здесь можно добавить toast уведомление об ошибке
    } finally {
      setSaving(false)
    }
  }

  const buildHierarchy = (items: CatalogMenuItem[], parentId: number | null = null): CatalogMenuItem[] => {
    return items
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        ...item,
        children: buildHierarchy(items, item.id)
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  const hierarchicalMenu = buildHierarchy(menuSettings)

  // Получаем доступные сущности для выбранного типа
  const currentEntities = availableEntities[selectedEntityType] || []
  const availableForAdd = currentEntities.filter(entity => !entity.in_menu)

  // Получаем список элементов, которые могут быть родительскими
  const parentOptions = menuSettings.filter(setting => setting.id !== editingId)

  // Типы сущностей
  const entityTypes = [
    { value: 'spec_group', label: 'Группа характеристик', icon: Layers, color: 'text-blue-600' },
    { value: 'category', label: 'Категория', icon: Folder, color: 'text-green-600' },
    { value: 'manufacturer', label: 'Производитель', icon: Building, color: 'text-purple-600' },
    { value: 'model_line', label: 'Модельный ряд', icon: Package, color: 'text-orange-600' },
    { value: 'manufacturers_category', label: 'Каталог производителей', icon: Building, color: 'text-red-600' }
  ]

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-slate-600 flex items-center">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Загрузка...
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Управление меню каталога</h1>
            <p className="text-muted-foreground mt-2">
              Настройте отображение и структуру меню каталога на сайте. Доступны только главные группы характеристик.
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={loadData}
              variant="outline"
              disabled={loading || saving}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Обновить
            </Button>
            <Button
              onClick={handleAdd}
              disabled={availableForAdd.length === 0 || saving}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить главную группу
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Универсальное меню каталога
              {saving && (
                <span className="ml-2 text-sm text-muted-foreground">
                  <RefreshCw className="inline h-3 w-3 animate-spin mr-1" />
                  Сохранение...
                </span>
              )}
            </CardTitle>
            <CardDescription>
              🔄 Управление элементами меню каталога: группы характеристик, категории, производители и модельные ряды.
              Создавайте иерархическую структуру навигации для удобства пользователей.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {menuSettings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-lg font-medium">Меню пусто</div>
                <div className="text-sm mt-1">
                  Добавьте элементы в меню для отображения на сайте
                </div>
                <Button
                  onClick={handleAdd}
                  className="mt-4"
                  disabled={availableForAdd.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить первый элемент
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg border border-gray-200">
                  {hierarchicalMenu.map(item => (
                    <HierarchicalMenuItem
                      key={item.id}
                      item={item}
                      level={0}
                      onToggleVisibility={handleToggleVisibility}
                      onToggleExpanded={handleToggleExpanded}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2 text-blue-700 font-medium">
                      <Layers className="h-4 w-4" />
                      <span>Группы характеристик</span>
                    </div>
                    <div className="mt-1 text-blue-600">
                      {menuSettings.filter(item => item.entity_type === 'spec_group').length} в меню
                    </div>
                  </div>

                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2 text-green-700 font-medium">
                      <Folder className="h-4 w-4" />
                      <span>Категории</span>
                    </div>
                    <div className="mt-1 text-green-600">
                      {menuSettings.filter(item => item.entity_type === 'category').length} в меню
                    </div>
                  </div>

                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2 text-orange-700 font-medium">
                      <Building className="h-4 w-4" />
                      <span>Производители</span>
                    </div>
                    <div className="mt-1 text-orange-600">
                      {menuSettings.filter(item => item.entity_type === 'manufacturer').length} в меню
                    </div>
                  </div>

                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2 text-purple-700 font-medium">
                      <Package className="h-4 w-4" />
                      <span>Модельные ряды</span>
                    </div>
                    <div className="mt-1 text-purple-600">
                      {menuSettings.filter(item => item.entity_type === 'model_line').length} в меню
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                  <span>Всего элементов в меню: {menuSettings.length}</span>
                  <span>Видимых: {menuSettings.filter(item => item.is_visible).length} из {menuSettings.length}</span>
                  <span>Доступно для добавления: {Object.values(availableEntities).flat().filter(e => !e.in_menu).length}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Диалог добавления/редактирования */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {isAddingNew ? 'Добавить элемент в меню каталога' : 'Редактировать элемент меню'}
              </DialogTitle>
              <DialogDescription>
                {isAddingNew
                  ? '🔄 Выберите тип сущности и конкретный элемент для добавления в меню каталога'
                  : 'Измените настройки отображения для этого элемента меню'
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="space-y-4">
              {isAddingNew && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entity_type">Тип сущности</Label>
                    <Select
                      value={formData.entity_type}
                      onValueChange={(value) => {
                        const newEntityType = value as 'spec_group' | 'category' | 'manufacturer' | 'model_line' | 'manufacturers_category'
                        setSelectedEntityType(newEntityType)
                        setFormData(prev => ({
                          ...prev,
                          entity_type: newEntityType,
                          entity_id: null,
                          name: '',
                          description: ''
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип сущности..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spec_group">
                          <div className="flex items-center space-x-2">
                            <Layers className="h-4 w-4" />
                            <span>Группа характеристик</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="category">
                          <div className="flex items-center space-x-2">
                            <Folder className="h-4 w-4" />
                            <span>Категория</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="manufacturer">
                          <div className="flex items-center space-x-2">
                            <Building className="h-4 w-4" />
                            <span>Производитель</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="model_line">
                          <div className="flex items-center space-x-2">
                            <Package className="h-4 w-4" />
                            <span>Модельный ряд</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="manufacturers_category">
                          <div className="flex items-center space-x-2">
                            <Building className="h-4 w-4" />
                            <span>Каталог производителей</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Выбор сущности */}
                  {formData.entity_type && (
                    <div className="space-y-2">
                      <Label>Выберите сущность</Label>
                      {formData.entity_type === 'manufacturers_category' ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center space-x-2 text-blue-700">
                            <Building className="h-5 w-5" />
                            <span className="font-medium">Автоматическая категория</span>
                          </div>
                          <p className="text-sm text-blue-600 mt-1">
                            Эта категория автоматически включит всех активных производителей как подкатегории.
                            Количество производителей: {availableEntities.manufacturers_category?.[0]?.characteristics_count || 0}
                          </p>
                        </div>
                      ) : (
                        <Select
                          value={formData.entity_id?.toString() || ''}
                          onValueChange={(value) => {
                            const entityId = parseInt(value)
                            const selectedEntity = availableEntities[formData.entity_type]?.find(e => e.entity_id === entityId)
                            setFormData(prev => ({
                              ...prev,
                              entity_id: entityId,
                              name: selectedEntity?.name || '',
                              description: selectedEntity?.description || ''
                            }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Выберите ${EntityTypeLabels[formData.entity_type]?.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableEntities[formData.entity_type]?.filter(entity => !entity.in_menu).map((entity) => (
                              <SelectItem key={entity.entity_id} value={entity.entity_id.toString()}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{entity.name}</span>
                                  <div className="flex space-x-1">
                                    {(entity.characteristics_count ?? 0) > 0 && (
                                      <Badge variant="secondary" className="ml-2">
                                        {entity.characteristics_count} хар-к
                                      </Badge>
                                    )}
                                    {(entity.children_count ?? 0) > 0 && (
                                      <Badge variant="outline" className="ml-1">
                                        {entity.children_count} подгрупп
                                      </Badge>
                                    )}
                                    {entity.is_root && (
                                      <Badge variant="default" className="ml-1 bg-green-100 text-green-800">
                                        Корневая
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Название в меню</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Введите название..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Порядок сортировки</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icon">Иконка</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="layers, folder, building..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Опциональное описание..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent_id">Родительский элемент</Label>
                <SearchableCategorySelect
                  categories={parentOptions.map(setting => ({
                    id: setting.id,
                    name: setting.name,
                    description: EntityTypeLabels[setting.entity_type]
                  }))}
                  value={formData.parent_id?.toString() || "none"}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    parent_id: value === "none" ? null : parseInt(value)
                  }))}
                  placeholder="Выберите родительский элемент..."
                  includeNoneOption={true}
                  noneOptionText="Корневой уровень"
                  noneValue="none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_visible"
                    checked={formData.is_visible}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
                  />
                  <Label htmlFor="is_visible" className="text-sm">Видимо в меню</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_expanded"
                    checked={formData.is_expanded}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_expanded: checked }))}
                  />
                  <Label htmlFor="is_expanded" className="text-sm">Развернуто</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="show_in_main_menu"
                    checked={formData.show_in_main_menu}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_in_main_menu: checked }))}
                  />
                  <Label htmlFor="show_in_main_menu" className="text-sm">Главное меню</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={saving}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={saving || !formData.name || (isAddingNew && !formData.entity_id)}>
                  {saving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isAddingNew ? 'Добавить в меню' : 'Сохранить изменения'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}