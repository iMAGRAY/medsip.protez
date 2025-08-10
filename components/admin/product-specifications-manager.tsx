"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Edit, Trash2, Settings, Database, Type, ChevronDown, ChevronRight, FolderOpen, Package, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { getCharacteristicColor } from '@/lib/theme-colors'

interface SpecGroup {
  id: string | number
  name: string
  description?: string
  enum_count?: number
  enum_values?: SpecEnum[]
  parent_id?: string | number | null
  level?: number
  children?: SpecGroup[]
  source_type?: 'spec_group' | 'category'
  original_id?: number
  enums?: SpecEnum[]
  ordering?: number
}

interface SpecEnum {
  id: number
  group_id: number
  value: string
  ordering: number
  parent_id?: number
  children?: SpecEnum[]
  color_value?: string
}

interface Characteristic {
  id?: number
  name: string
  type: 'text' | 'numeric' | 'select' | 'boolean'
  unit?: string
  description?: string
  options?: string[]
  default_value?: string
  is_required?: boolean
  sort_order?: number
}

interface ProductSpecificationsManagerProps {
  productId: number | null
  productName: string
  specifications: any[]
  onSpecificationsChange: (specifications: any[]) => void
  isNewProduct?: boolean
}

export function ProductSpecificationsManager({
  productId,
  productName,
  specifications,
  onSpecificationsChange,
  isNewProduct
}: ProductSpecificationsManagerProps) {
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("groups")
  const [loading, setLoading] = useState(true)

  // Диалоги
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [isEnumDialogOpen, setIsEnumDialogOpen] = useState(false)
  const [isCharacteristicDialogOpen, setIsCharacteristicDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SpecGroup | null>(null)
  const [editingEnum, setEditingEnum] = useState<SpecEnum | null>(null)
  const [editingCharacteristic, setEditingCharacteristic] = useState<Characteristic | null>(null)

  // Формы
  const [groupFormData, setGroupFormData] = useState({
    name: "",
    description: "",
    parent_id: undefined as number | undefined
  })

  const [enumFormData, setEnumFormData] = useState({
    groupId: 0,
    value: "",
    ordering: 0,
    parent_id: undefined as number | undefined,
    color_value: ""
  })

  const [characteristicFormData, setCharacteristicFormData] = useState<Characteristic>({
    name: "",
    type: "text",
    unit: "",
    description: "",
    options: [],
    default_value: "",
    is_required: false,
    sort_order: 0
  })

  // Состояние для раскрытых групп
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedEnums, setExpandedEnums] = useState<Set<number>>(new Set())

  // Состояния для работы с характеристиками товара
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<Set<string>>(new Set())
  const [productSpecifications, setProductSpecifications] = useState<any[]>(specifications)

  // Удаляю дублированную цветовую карту и использую централизованную функцию
  const getColorForValue = (value: string) => {
    return getCharacteristicColor(value)
  }

  // Загрузка данных
  const loadSpecGroups = useCallback(async () => {
      try {

        const res = await fetch("/api/specifications")

        if (res.ok) {
          const apiResponse = await res.json()
          const data = apiResponse.data || apiResponse

          const hierarchicalGroups = processHierarchicalGroups(data)

          setSpecGroups(hierarchicalGroups)
        } else {
          console.error("❌ Failed to load spec groups:", res.status)
          toast.error('Не удалось загрузить группы характеристик')
        }
      } catch (error) {
        console.error("❌ Error loading spec groups:", error)
        toast.error('Ошибка при загрузке групп характеристик')
      } finally {
        setLoading(false)
      }
    }, [])

  const processHierarchicalGroups = (groups: any[]): SpecGroup[] => {
    const processGroup = (group: any): SpecGroup => {
      return {
        id: group.id || `spec_${group.id}`,
        name: group.name || 'Unnamed Group',
        description: group.description || '',
        enum_count: group.enum_count || 0,
        enum_values: group.enum_values || group.enums || [],
        parent_id: group.parent_id || null,
        level: group.level || 0,
        children: group.children ? group.children.map(processGroup) : [],
        source_type: 'spec_group',
        original_id: group.id,
        enums: group.enums || [],
        ordering: group.ordering || 0
      }
    }

    return groups.map(processGroup)
  }

  useEffect(() => {
    loadSpecGroups()
  }, [loadSpecGroups])

  // Синхронизация с родительским компонентом
  useEffect(() => {
    setProductSpecifications(specifications)

    // Инициализируем выбранные характеристики на основе текущих характеристик товара
    const selected = new Set<string>()
    specifications.forEach(spec => {
      if (spec.spec_type === 'select') {
        // Найдем enum ID для select характеристик
        const enumValue = specGroups
          .flatMap(g => g.enum_values || g.enums || [])
          .find(e => e.group_id === spec.group_id && e.value === spec.spec_value)

        if (enumValue) {
          selected.add(`${spec.group_id}-${enumValue.id}`)
        }
      } else {
        // Для текстовых характеристик используем group ID
        selected.add(`group-${spec.group_id}`)
      }
    })
    setSelectedCharacteristics(selected)
  }, [specifications, specGroups])

  // Обработка выбора характеристики
  const handleCharacteristicSelect = (enumValue: SpecEnum, groupName: string) => {
    const charKey = `${enumValue.group_id}-${enumValue.id}`

    if (selectedCharacteristics.has(charKey)) {
      // Убираем характеристику
      const newSelected = new Set(selectedCharacteristics)
      newSelected.delete(charKey)
      setSelectedCharacteristics(newSelected)

      // Убираем из товара
      const updatedSpecs = productSpecifications.filter(spec =>
        !(spec.group_id === enumValue.group_id && spec.spec_value === enumValue.value)
      )
      setProductSpecifications(updatedSpecs)
      onSpecificationsChange(updatedSpecs)
    } else {
      // Добавляем характеристику
      const newSelected = new Set(selectedCharacteristics)
      newSelected.add(charKey)
      setSelectedCharacteristics(newSelected)

      // Добавляем к товару
      const newSpec = {
        tempId: Date.now(),
        spec_name: groupName,
        spec_value: enumValue.value,
        spec_type: 'select',
        group_id: enumValue.group_id,
        sort_order: enumValue.ordering,
        is_primary: false,
        unit: '',
        numeric_value: null
      }

      const updatedSpecs = [...productSpecifications, newSpec]
      setProductSpecifications(updatedSpecs)
      onSpecificationsChange(updatedSpecs)

      toast.success(`Добавлена характеристика: ${groupName} - ${enumValue.value}`)
    }
  }

  // Обработка выбора группы как текстовой характеристики
  const handleGroupSelect = (group: SpecGroup) => {
    const groupKey = `group-${group.id}`

    if (selectedCharacteristics.has(groupKey)) {
      // Убираем группу
      const newSelected = new Set(selectedCharacteristics)
      newSelected.delete(groupKey)
      setSelectedCharacteristics(newSelected)

      // Убираем из товара
      const updatedSpecs = productSpecifications.filter(spec =>
        !(spec.spec_name === group.name && spec.spec_type === 'text')
      )
      setProductSpecifications(updatedSpecs)
      onSpecificationsChange(updatedSpecs)
    } else {
      // Добавляем группу как текстовую характеристику
      const newSelected = new Set(selectedCharacteristics)
      newSelected.add(groupKey)
      setSelectedCharacteristics(newSelected)

      // Добавляем к товару
      const newSpec = {
        tempId: Date.now(),
        spec_name: group.name,
        spec_value: '',
        spec_type: 'text',
        group_id: typeof group.id === 'string' ? parseInt(group.id.replace('spec_', '')) : group.id,
        sort_order: 0,
        is_primary: false,
        unit: '',
        numeric_value: null
      }

      const updatedSpecs = [...productSpecifications, newSpec]
      setProductSpecifications(updatedSpecs)
      onSpecificationsChange(updatedSpecs)

      toast.success(`Добавлена характеристика: ${group.name}`)
    }
  }

  const resetGroupForm = () => {
    setGroupFormData({ name: "", description: "", parent_id: undefined })
    setEditingGroup(null)
  }

  const handleAddSubgroup = (parentGroup: SpecGroup) => {
    resetGroupForm()
    setGroupFormData(prev => ({
      ...prev,
      parent_id: typeof parentGroup.id === 'string' ?
        parseInt(parentGroup.id.replace('spec_', '')) :
        parentGroup.id as number
    }))
    setIsGroupDialogOpen(true)
  }

  const handleGroupSave = async () => {
    if (!groupFormData.name.trim()) {
      toast.error('Введите название группы')
      return
    }

    try {
      const requestData = {
        name: groupFormData.name,
        description: groupFormData.description,
        parent_id: groupFormData.parent_id || null
      }

        let response
      if (editingGroup) {
        const groupId = typeof editingGroup.id === 'string' && editingGroup.id.startsWith('spec_')
          ? parseInt(editingGroup.id.replace('spec_', ''))
          : editingGroup.id

        response = await fetch(`/api/spec-groups`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: groupId, ...requestData })
          })
        } else {
        response = await fetch('/api/spec-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        })
      }

      if (response.ok) {
        toast.success(editingGroup ? 'Группа обновлена' : 'Группа создана')
        await loadSpecGroups()
        setIsGroupDialogOpen(false)
        resetGroupForm()
      } else {
          const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка при сохранении группы')
      }
    } catch (error) {
      console.error('Error saving group:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка при сохранении группы')
    }
  }

  const handleGroupEdit = (group: SpecGroup) => {
    setEditingGroup(group)
    setGroupFormData({
      name: group.name,
      description: group.description || '',
      parent_id: group.parent_id ?
        (typeof group.parent_id === 'string' ? parseInt(group.parent_id) : group.parent_id) :
        undefined
    })
    setIsGroupDialogOpen(true)
  }

  const handleGroupDelete = async (groupId: string | number) => {
    if (!confirm('Вы уверены, что хотите удалить эту группу? Все связанные характеристики также будут удалены.')) {
      return
    }

    try {
      const _id = typeof groupId === 'string' && groupId.startsWith('spec_')
        ? parseInt(groupId.replace('spec_', ''))
        : groupId

      const response = await fetch(`/api/spec-groups`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: _id })
      })

      if (response.ok) {
        toast.success('Группа удалена')
        await loadSpecGroups()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка при удалении группы')
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка при удалении группы')
    }
  }

  const toggleGroupExpansion = (groupId: string | number) => {
    setExpandedGroups(prev => {
      const newExpanded = new Set(prev)
      const key = String(groupId)
      if (newExpanded.has(key)) {
        newExpanded.delete(key)
    } else {
        newExpanded.add(key)
      }
      return newExpanded
    })
  }

  const resetEnumForm = () => {
    setEnumFormData({
      groupId: 0,
      value: "",
      ordering: 0,
      parent_id: undefined,
      color_value: ""
    })
    setEditingEnum(null)
  }

  const handleAddEnum = (groupId: string | number, parentId?: number) => {
    resetEnumForm()
    const id = typeof groupId === 'string' && groupId.startsWith('spec_')
      ? parseInt(groupId.replace('spec_', ''))
      : groupId as number

    setEnumFormData(prev => ({
      ...prev,
      groupId: id,
      parent_id: parentId
    }))
    setIsEnumDialogOpen(true)
  }

  const handleEnumEdit = (enumValue: SpecEnum) => {
    setEditingEnum(enumValue)
    setEnumFormData({
      groupId: enumValue.group_id,
      value: enumValue.value,
      ordering: enumValue.ordering,
      parent_id: enumValue.parent_id,
      color_value: enumValue.color_value || ""
    })
    setIsEnumDialogOpen(true)
  }

  const handleEnumSave = async () => {
    if (!enumFormData.value.trim()) {
      toast.error('Введите значение характеристики')
      return
    }

    try {
      const requestData = {
        group_id: enumFormData.groupId,
        value: enumFormData.value,
        ordering: enumFormData.ordering,
        parent_id: enumFormData.parent_id || null,
        color_value: enumFormData.color_value || null
      }

        let response
      if (editingEnum) {
        response = await fetch(`/api/spec-enums`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingEnum.id, ...requestData })
          })
        } else {
        response = await fetch('/api/spec-enums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        })
      }

      if (response.ok) {
        toast.success(editingEnum ? "Характеристика обновлена" : "Характеристика создана")
        await loadSpecGroups()
        setIsEnumDialogOpen(false)
        resetEnumForm()
      } else {
          const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка при сохранении характеристики')
      }
    } catch (error) {
      console.error('Error saving enum:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка при сохранении характеристики')
    }
  }

  const handleEnumDelete = async (enumId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту характеристику?')) {
      return
    }

    try {
      const response = await fetch(`/api/spec-enums`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: enumId })
      })

      if (response.ok) {
        toast.success('Характеристика удалена')
        await loadSpecGroups()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка при удалении характеристики')
      }
    } catch (error) {
      console.error('Error deleting enum:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка при удалении характеристики')
    }
  }

  const toggleEnumExpansion = (enumId: number) => {
    setExpandedEnums(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(enumId)) {
        newExpanded.delete(enumId)
    } else {
        newExpanded.add(enumId)
      }
      return newExpanded
    })
  }

  // Фильтрация групп по поиску
  const filteredGroups = React.useMemo(() => {
    if (!search.trim()) return specGroups

    const filterGroup = (group: SpecGroup): SpecGroup | null => {
      const matchesSearch = group.name.toLowerCase().includes(search.toLowerCase()) ||
                          (group.description || '').toLowerCase().includes(search.toLowerCase())

      const filteredChildren = group.children?.map(filterGroup).filter(Boolean) as SpecGroup[] || []

      if (matchesSearch || filteredChildren.length > 0) {
        return {
          ...group,
          children: filteredChildren
        }
      }

      return null
    }

    return specGroups.map(filterGroup).filter(Boolean) as SpecGroup[]
  }, [specGroups, search])

  const getTotalSubgroupsCount = (group: SpecGroup): number => {
    let count = 0
    if (group.children) {
      count += group.children.length
      group.children.forEach(child => {
        count += getTotalSubgroupsCount(child)
      })
    }
    return count
  }

  const getTotalCharacteristicsCount = (group: SpecGroup): number => {
    let count = (group.enum_values?.length || 0) + (group.enums?.length || 0)
    if (group.children) {
      group.children.forEach(child => {
        count += getTotalCharacteristicsCount(child)
      })
    }
    return count
  }

  const renderGroupTree = (groups: SpecGroup[], level = 0) => {
    return groups.map((group) => {
      const isExpanded = expandedGroups.has(String(group.id))
      const hasChildren = group.children && group.children.length > 0
      const hasEnums = (group.enum_values && group.enum_values.length > 0) || (group.enums && group.enums.length > 0)
      const subgroupsCount = getTotalSubgroupsCount(group)
      const characteristicsCount = getTotalCharacteristicsCount(group)

  return (
        <div key={group.id} className="space-y-1">
          <div
            className={`p-3 border rounded-lg transition-all duration-200 hover:bg-gray-50 ${
              level === 0 ? 'bg-white border-gray-200' :
              level === 1 ? 'bg-gray-50 border-gray-150 ml-4' :
              'bg-gray-25 border-gray-100 ml-8'
            }`}
          >
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {(hasChildren || hasEnums) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleGroupExpansion(group.id)}
                    className="p-1 h-6 w-6"
                  >
                    {isExpanded ?
                      <ChevronDown className="w-4 h-4" /> :
                      <ChevronRight className="w-4 h-4" />
                    }
                  </Button>
                )}

                <div className="flex items-center gap-2">
                  {level === 0 && <FolderOpen className="w-5 h-5 text-blue-600" />}
                  {level === 1 && <Package className="w-4 h-4 text-orange-600" />}
                  {level >= 2 && <Tag className="w-4 h-4 text-green-600" />}

            <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{group.name}</span>
                      {subgroupsCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {subgroupsCount} подгрупп
                        </Badge>
                      )}
                      {characteristicsCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {characteristicsCount} характ.
                        </Badge>
                      )}
            </div>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    )}
            </div>
          </div>
            </div>

                            <div className="flex items-center gap-1">
                {/* Кнопка выбора группы как характеристики */}
                <Button
                  variant={selectedCharacteristics.has(`group-${group.id}`) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleGroupSelect(group)}
                  className={selectedCharacteristics.has(`group-${group.id}`)
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "border-green-600 text-green-600 hover:bg-green-50"
                  }
                  title={selectedCharacteristics.has(`group-${group.id}`) ? "Убрать из товара" : "Добавить как текстовую характеристику"}
                >
                  {selectedCharacteristics.has(`group-${group.id}`) ? "✓" : "+"}
              </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddEnum(group.id)}
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  title="Добавить характеристику"
                >
                  <Tag className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddSubgroup(group)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  title="Добавить подгруппу"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleGroupEdit(group)}
                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleGroupDelete(group.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                  </div>
                  </div>
                </div>

          {isExpanded && (
            <div className="space-y-1">
              {hasEnums && (
                <div className="ml-8">
                  {renderEnumTree(group.enum_values || group.enums || [], typeof group.id === 'string' && group.id.startsWith('spec_') ? parseInt(group.id.replace('spec_', '')) : group.id as number)}
                    </div>
              )}
              {hasChildren && (
                  <div>
                  {renderGroupTree(group.children!, level + 1)}
                  </div>
                            )}
                          </div>
                          )}
                        </div>
      )
    })
  }

  const renderEnumTree = (enums: SpecEnum[], groupId: number) => {
    const rootEnums = enums.filter(e => !e.parent_id)

         const renderEnumItem = (enumValue: SpecEnum, level = 0) => {
       const isExpanded = expandedEnums.has(enumValue.id)
       const hasChildren = enumValue.children && enumValue.children.length > 0

      return (
        <div key={enumValue.id} className="space-y-1">
          <div className={`p-2 border rounded bg-white hover:bg-gray-50 ${level > 0 ? 'ml-4' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                {hasChildren && (
                        <Button
                    variant="ghost"
                          size="sm"
                    onClick={() => toggleEnumExpansion(enumValue.id)}
                    className="p-1 h-5 w-5"
                        >
                    {isExpanded ?
                      <ChevronDown className="w-3 h-3" /> :
                      <ChevronRight className="w-3 h-3" />
                    }
                        </Button>
                )}

                <div
                  className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0"
                  style={{ background: getColorForValue(enumValue.value) }}
                  title={`Цвет: ${enumValue.color_value || 'автоматический'}`}
                />

                <span className="text-sm font-medium">{enumValue.value}</span>

                {enumValue.ordering > 0 && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    #{enumValue.ordering}
                  </Badge>
                )}
                      </div>

                            <div className="flex items-center gap-1">
                {/* Кнопка выбора характеристики */}
                      <Button
                  variant={selectedCharacteristics.has(`${enumValue.group_id}-${enumValue.id}`) ? "default" : "outline"}
                        size="sm"
                  onClick={() => {
                    const groupName = specGroups.find(g =>
                      (typeof g.id === 'number' && g.id === enumValue.group_id) ||
                      (typeof g.id === 'string' && parseInt(g.id.replace('spec_', '')) === enumValue.group_id)
                    )?.name || 'Характеристика'
                    handleCharacteristicSelect(enumValue, groupName)
                  }}
                  className={`p-1 h-6 w-6 ${selectedCharacteristics.has(`${enumValue.group_id}-${enumValue.id}`)
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "border-green-600 text-green-600 hover:bg-green-50"
                  }`}
                  title={selectedCharacteristics.has(`${enumValue.group_id}-${enumValue.id}`) ? "Убрать из товара" : "Добавить к товару"}
                >
                  {selectedCharacteristics.has(`${enumValue.group_id}-${enumValue.id}`) ? "✓" : "+"}
                      </Button>

                {level === 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddEnum(groupId, enumValue.id)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 h-6 w-6"
                    title="Добавить подгруппу"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                )}
                          <Button
                  variant="ghost"
                            size="sm"
                  onClick={() => handleEnumEdit(enumValue)}
                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 p-1 h-6 w-6"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEnumDelete(enumValue.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-6 w-6"
                >
                  <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        </div>
                    </div>

          {isExpanded && hasChildren && (
            <div className="ml-4 space-y-1">
              {enumValue.children!.map(child => renderEnumItem(child, level + 1))}
                </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {rootEnums
          .sort((a, b) => a.ordering - b.ordering || a.value.localeCompare(b.value))
          .map(enumValue => renderEnumItem(enumValue))}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="text-lg">Загрузка характеристик...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600"/>
          Характеристики товара: {productName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-3">
          <Input
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="text-blue-600 text-sm">ℹ️</div>
              <div className="text-blue-800 text-sm">
                <div className="font-medium mb-1">Как добавить характеристики:</div>
                <div className="space-y-1 text-xs">
                  <div>• Нажмите <span className="bg-green-100 text-green-700 px-1 rounded font-mono">+</span> рядом с группой для добавления как текстовой характеристики</div>
                  <div>• Нажмите <span className="bg-green-100 text-green-700 px-1 rounded font-mono">+</span> рядом с характеристикой для добавления готового значения</div>
                  <div>• Переключитесь на вкладку &quot;Характеристики&quot; для редактирования значений</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Database className="w-4 h-4"/>
              Группы характеристик ({filteredGroups.length})
            </TabsTrigger>
            <TabsTrigger value="characteristics" className="flex items-center gap-2">
              <Type className="w-4 h-4"/>
              Характеристики
            </TabsTrigger>
          </TabsList>

          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5"/>
                    Группы характеристик ({filteredGroups.length})
                  </CardTitle>
                  <Dialog open={isGroupDialogOpen} onOpenChange={(open) => {
                    setIsGroupDialogOpen(open)
                    if (!open) resetGroupForm()
                  }}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-500 hover:bg-blue-600">
                        <Plus className="w-4 h-4 mr-2"/>
                        Добавить группу
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
                            <DialogTitle>
                  {editingGroup ? "Редактировать группу" : "Новая группа характеристик"}
                </DialogTitle>
                <DialogDescription>
                  {editingGroup ? "Изменение существующей группы характеристик" : "Создание новой группы для организации характеристик товаров"}
                </DialogDescription>
          </DialogHeader>
                      <div className="space-y-4">
            <div>
                          <Label htmlFor="groupName">Название группы *</Label>
              <Input
                            id="groupName"
                            value={groupFormData.name}
                            onChange={(e) => setGroupFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="например: Физические параметры"
                          />
            </div>
            <div>
                          <Label htmlFor="groupDescription">Описание</Label>
                          <Textarea
                            id="groupDescription"
                            value={groupFormData.description}
                            onChange={(e) => setGroupFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Описание группы характеристик"
                            rows={3}
              />
            </div>

            <div>
                          <Label htmlFor="parentGroup">Родительская группа</Label>
              <Select
                            value={groupFormData.parent_id?.toString() || "root"}
                            onValueChange={(value) => setGroupFormData(prev => ({
                              ...prev,
                              parent_id: value === "root" ? undefined : parseInt(value)
                            }))}
              >
                <SelectTrigger>
                              <SelectValue placeholder="Выберите родительскую группу..." />
                </SelectTrigger>
                <SelectContent>
                              <SelectItem value="root">Корневая группа</SelectItem>
                              {specGroups.map(group => {
                                const originalId = typeof group.id === 'string' && group.id.startsWith('spec_')
                                  ? parseInt(group.id.replace('spec_', ''))
                                  : typeof group.id === 'number' ? group.id : 0;

                                return (
                                  <SelectItem key={group.id} value={originalId.toString()}>
                                    {group.name}
                    </SelectItem>
                                );
                              })}
                </SelectContent>
              </Select>
            </div>

                        <div className="flex gap-2 pt-4">
                          <Button onClick={handleGroupSave} className="bg-blue-500 hover:bg-blue-600">
                            {editingGroup ? "Обновить" : "Создать"}
                          </Button>
                          <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
                            Отмена
                          </Button>
                </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {renderGroupTree(filteredGroups)}

                  {filteredGroups.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Database className="w-12 h-12 mx-auto mb-4 text-gray-300"/>
                                              <div className="text-lg font-medium mb-2">Нет групп характеристик</div>
                        <div className="text-sm mb-4">Создайте первую группу для организации характеристик товаров</div>
                    </div>
              )}
            </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="characteristics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="w-5 h-5"/>
                  Характеристики товара ({productSpecifications.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {productSpecifications.length > 0 ? (
                  <div className="space-y-3">
                    {productSpecifications.map((spec, index) => (
                      <div key={spec.tempId || spec.id || index} className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{spec.spec_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {spec.spec_type === 'select' ? 'Выбор' : 'Текст'}
                            </Badge>
                            {spec.is_primary && (
                              <Badge variant="secondary" className="text-xs">Основная</Badge>
                            )}
                          </div>

                          {spec.spec_type === 'select' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">Значение:</span>
                              <span className="text-sm font-medium">{spec.spec_value}</span>
                </div>
              ) : (
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Значение:</Label>
                <Input
                                value={spec.spec_value}
                                onChange={(e) => {
                                  const updatedSpecs = productSpecifications.map(s =>
                                    (s.tempId === spec.tempId || s.id === spec.id)
                                      ? { ...s, spec_value: e.target.value }
                                      : s
                                  )
                                  setProductSpecifications(updatedSpecs)
                                  onSpecificationsChange(updatedSpecs)
                                }}
                                placeholder={`Введите ${spec.spec_name.toLowerCase()}`}
                                className="h-8"
                              />
                            </div>
                          )}

                          {spec.unit && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Единица:</span>
                              <Badge variant="outline" className="text-xs">{spec.unit}</Badge>
                            </div>
              )}
            </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updatedSpecs = productSpecifications.map(s =>
                                (s.tempId === spec.tempId || s.id === spec.id)
                                  ? { ...s, is_primary: !s.is_primary }
                                  : s
                              )
                              setProductSpecifications(updatedSpecs)
                              onSpecificationsChange(updatedSpecs)
                            }}
                            className={spec.is_primary ? "border-gray-300 text-gray-600 bg-gray-50" : ""}
                          >
                            {spec.is_primary ? "★" : "☆"}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updatedSpecs = productSpecifications.filter(s =>
                                s.tempId !== spec.tempId && s.id !== spec.id
                              )
                              setProductSpecifications(updatedSpecs)
                              onSpecificationsChange(updatedSpecs)

                              // Убираем из выбранных
                              if (spec.spec_type === 'select') {
                                // Найдем enum по group_id и value
                                const enumValue = specGroups
                                  .flatMap(g => g.enum_values || g.enums || [])
                                  .find(e => e.group_id === spec.group_id && e.value === spec.spec_value)

                                if (enumValue) {
                                  const charKey = `${spec.group_id}-${enumValue.id}`
                                  const newSelected = new Set(selectedCharacteristics)
                                  newSelected.delete(charKey)
                                  setSelectedCharacteristics(newSelected)
                                }
                              } else {
                                const groupKey = `group-${spec.group_id}`
                                const newSelected = new Set(selectedCharacteristics)
                                newSelected.delete(groupKey)
                                setSelectedCharacteristics(newSelected)
                              }

                              toast.success('Характеристика удалена')
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Type className="w-12 h-12 mx-auto mb-4 text-gray-300"/>
                    <div className="text-lg font-medium mb-2">Нет характеристик</div>
                                            <div className="text-sm mb-4">Добавьте характеристики через вкладку &quot;Группы характеристик&quot;</div>
                    <div className="text-xs text-gray-400">
                      Нажмите <span className="bg-green-100 text-green-700 px-1 rounded">+</span> рядом с группами или характеристиками для добавления
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Диалог создания/редактирования характеристики */}
        <Dialog open={isEnumDialogOpen} onOpenChange={(open) => {
          setIsEnumDialogOpen(open)
          if (!open) resetEnumForm()
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingEnum
                  ? "Редактировать характеристику"
                  : enumFormData.parent_id
                    ? "Новая подгруппа"
                    : "Новая характеристика"
                }
              </DialogTitle>
              <DialogDescription>
                {editingEnum
                  ? "Изменение существующей характеристики товара"
                  : enumFormData.parent_id
                    ? "Создание новой подгруппы характеристик"
                    : "Добавление новой характеристики для товаров"
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
            <div>
                <Label htmlFor="enumValue">Значение характеристики *</Label>
              <Input
                  id="enumValue"
                  value={enumFormData.value}
                  onChange={(e) => setEnumFormData(prev => ({
                    ...prev,
                    value: e.target.value
                  }))}
                  placeholder="Например: Водонепроницаемость, Левая сторона..."
              />
            </div>

            <div>
                <Label htmlFor="enumOrdering">Порядок сортировки</Label>
              <Input
                  id="enumOrdering"
                type="number"
                  value={enumFormData.ordering}
                  onChange={(e) => setEnumFormData(prev => ({
                    ...prev,
                    ordering: parseInt(e.target.value) || 0
                  }))}
                  placeholder="1, 2, 3..."
              />
            </div>

            <div>
                <Label htmlFor="colorValue">Цвет</Label>
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <Input
                      id="colorValue"
                      value={enumFormData.color_value}
                      onChange={(e) => setEnumFormData(prev => ({
                        ...prev,
                        color_value: e.target.value
                      }))}
                      placeholder="#FF5733, rgba(255,87,51,0.8)"
                    />
            </div>
                  <input
                    type="color"
                    value={enumFormData.color_value.startsWith('#') ? enumFormData.color_value : '#E5E7EB'}
                    onChange={(e) => setEnumFormData(prev => ({
                      ...prev,
                      color_value: e.target.value
                    }))}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                </div>
          </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleEnumSave} className="bg-amber-500 hover:bg-amber-600">
                  {editingEnum ? "Сохранить изменения" : "Создать характеристику"}
                </Button>
                <Button variant="outline" onClick={() => setIsEnumDialogOpen(false)}>
              Отмена
            </Button>
              </div>
            </div>
        </DialogContent>
      </Dialog>
      </CardContent>
    </Card>
  )
}