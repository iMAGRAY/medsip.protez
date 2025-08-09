'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  Database,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Package,
  Tag,
  Hash,
  Check,
  Save
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

// Интерфейсы
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
  is_section?: boolean
}

interface SpecEnum {
  id: number
  group_id: number
  value: string
  ordering: number
  parent_id?: number
  color_value?: string
  color_hex?: string
}

interface ProductCharacteristic {
  id?: string
  group_id: number
  group_name: string
  characteristic_type: 'text' | 'numeric' | 'select' | 'boolean' | 'color'
  label: string
  value_numeric?: number
  value_text?: string
  value_color?: string
  selected_enum_id?: number
  selected_enum_value?: string
  unit_id?: number
  unit_code?: string
  is_primary?: boolean
  is_required?: boolean
  sort_order?: number
  template_id?: number
  variant_id?: number
}

interface ProductCharacteristicsManagerProps {
  productId?: number | null
  productName: string
  characteristics: any[]
  onCharacteristicsChange: (characteristics: any[]) => void
  isNewProduct?: boolean
}

export function ProductCharacteristicsManager({
  productId,
  productName,
  characteristics = [],
  onCharacteristicsChange,
  isNewProduct = false
}: ProductCharacteristicsManagerProps) {
  // Основные состояния
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([])
  const [productCharacteristics, setProductCharacteristics] = useState<ProductCharacteristic[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Состояния интерфейса
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // Восстанавливаем состояние раскрытых групп из localStorage (глобальное для всех товаров)
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('admin-characteristics-expanded-groups')
        if (saved) {

          return new Set(JSON.parse(saved))
        }
      } catch (error) {
        console.error('Error loading expanded groups state:', error)
      }
    }

    return new Set()
  })

  // Диалоги
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [isCharacteristicDialogOpen, setIsCharacteristicDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SpecGroup | null>(null)
  const [editingCharacteristic, setEditingCharacteristic] = useState<ProductCharacteristic | null>(null)

  // Формы
  const [groupFormData, setGroupFormData] = useState({
    name: "",
    description: "",
    parent_id: undefined as number | undefined
  })

  const [characteristicFormData, setCharacteristicFormData] = useState({
    group_id: 0,
    label: "",
    characteristic_type: 'text' as 'text' | 'numeric' | 'select' | 'boolean' | 'color',
    value_text: "",
    value_numeric: undefined as number | undefined,
    value_color: "#000000",
    selected_enum_id: undefined as number | undefined,
    is_required: false,
    is_primary: false
  })

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setIsInitializing(true) // Блокируем синхронизацию во время загрузки

        // Сбрасываем состояние для новых товаров
        if (isNewProduct) {
          setProductCharacteristics([])
        }

        await Promise.all([
          loadSpecGroups(),
          loadProductCharacteristics()
        ])
      } finally {
        setLoading(false)
        setIsInitializing(false) // Разблокируем синхронизацию после загрузки
      }
    }
    loadData()
  }, [productId, isNewProduct])

  // Синхронизация с родительским компонентом (только при ручных изменениях, не при загрузке)
  const [isInitializing, setIsInitializing] = useState(false)

  useEffect(() => {
    // Не вызываем onCharacteristicsChange во время загрузки данных или для новых товаров
    if (!isInitializing && !isNewProduct && productCharacteristics.length > 0) {

      onCharacteristicsChange(productCharacteristics)
    } else {

    }
  }, [productCharacteristics, isInitializing, isNewProduct])

  // Сохранение состояния раскрытых групп в localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const expandedArray = Array.from(expandedGroups)

        localStorage.setItem('admin-characteristics-expanded-groups', JSON.stringify(expandedArray))
      } catch (error) {
        console.error('Error saving expanded groups state:', error)
      }
    }
  }, [expandedGroups])

  // Дополнительный лог для отладки
  useEffect(() => {
    console.log('📊 ProductCharacteristicsManager Props:', {
      productId,
      productName,
      characteristicsLength: characteristics.length,
      isNewProduct,
      productCharacteristicsLength: productCharacteristics.length,
      expandedGroupsSize: expandedGroups.size,
      expandedGroupsContent: Array.from(expandedGroups),
      selectedGroupsSize: 0, // Удалено: selectedGroups
      selectedGroupsContent: [] // Удалено: selectedGroups
    })
  }, [productId, productName, characteristics, isNewProduct, productCharacteristics, expandedGroups])

  // Отслеживание изменений expandedGroups
  useEffect(() => {
    // Здесь можно выполнить действия при изменении expandedGroups, если потребуется.
  }, [expandedGroups])

  const loadSpecGroups = async () => {
    try {
      const res = await fetch('/api/characteristics')
      if (res.ok) {
        const apiResponse = await res.json()
        const data = apiResponse.data || apiResponse
        const processedGroups = processHierarchicalGroups(data)

        setSpecGroups(processedGroups)
      }
    } catch (error) {
      console.error('Error loading spec groups:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить группы характеристик",
        variant: "destructive"
      })
    }
  }

  const loadProductCharacteristics = async () => {
    if (!productId || isNewProduct) {

      return
    }

    try {
      const res = await fetch(`/api/products/${productId}/characteristics`)
      if (res.ok) {
        const apiResponse = await res.json()

        // Распаковываем данные из новой EAV системы
        const characteristicsData = apiResponse.data?.characteristics || []

        // Преобразуем группированные данные в плоский массив
        const flatCharacteristics = characteristicsData.flatMap((group: any) => {
          return group.characteristics?.map((char: any) => ({
            id: `${char.template_id}-${char.variant_id}`,
            group_id: group.group_id,
            group_name: group.group_name,
            characteristic_type: char.input_type === 'enum' ? 'select' : 'text',
            label: char.enum_display_name || char.enum_value || char.raw_value || char.template_name,
            value_text: char.raw_value,
            value_numeric: char.numeric_value,
            value_color: char.enum_color || char.raw_value,
            selected_enum_id: char.enum_value_id,
            selected_enum_value: char.enum_value,
            template_id: char.template_id,
            variant_id: char.variant_id,
            is_primary: false,
            is_required: false,
            sort_order: char.template_sort_order || 0
          })) || []
        })

        setProductCharacteristics(flatCharacteristics)

      }
    } catch (error) {
      console.error('Error loading product characteristics:', error)
    }
  }

  // Функция для обработки данных из API characteristics
  const processHierarchicalGroups = (groups: any[]): SpecGroup[] => {
    const processGroup = (group: any): SpecGroup => {
      const enumValues = group.enums || group.enum_values || []
      const enumCount = group.enum_values_count || enumValues.length || 0

      const processedGroup: SpecGroup = {
        id: group.id,
        name: group.name,
        description: group.description,
        enum_count: enumCount,
        enum_values: enumValues,
        enums: enumValues,
        parent_id: group.parent_id,
        level: 0, // Будет вычислен в buildHierarchy
        source_type: 'spec_group',
        original_id: group.id,
        ordering: group.ordering || 0,
        children: [],
        is_section: group.is_section || false
      }

      return processedGroup
    }

    const processedGroups = groups.map(processGroup)
    return buildHierarchy(processedGroups)
  }

  // Функция для построения иерархической структуры
  const buildHierarchy = (flatGroups: SpecGroup[]): SpecGroup[] => {

    // Создаем карту групп по ID для быстрого поиска
    const groupMap = new Map<string | number, SpecGroup>()
    flatGroups.forEach(group => {
      groupMap.set(group.id, { ...group, children: [] })
    })

    const rootGroups: SpecGroup[] = []

    // Строим дерево, устанавливая связи parent-child
    flatGroups.forEach(group => {
      const currentGroup = groupMap.get(group.id)!

      if (group.parent_id && groupMap.has(group.parent_id)) {
        // Это дочерняя группа
        const parentGroup = groupMap.get(group.parent_id)!
        if (!parentGroup.children) {
          parentGroup.children = []
        }
        parentGroup.children.push(currentGroup)
      } else {
        // Это корневая группа
        rootGroups.push(currentGroup)
      }
    })

    // Устанавливаем уровни рекурсивно
    const setLevels = (groups: SpecGroup[], level: number = 0) => {
      groups.forEach(group => {
        group.level = level
        if (group.children && group.children.length > 0) {
          setLevels(group.children, level + 1)
        }
      })
    }

    setLevels(rootGroups)
    return rootGroups
  }

  const processApiCharacteristics = (apiData: any): ProductCharacteristic[] => {
    if (!apiData || !Array.isArray(apiData)) return []

    return apiData.map((char: any, index: number) => ({
      id: char.id?.toString() || `temp-${index}`,
      group_id: char.group_id,
      group_name: char.group_name || 'Без группы',
      characteristic_type: char.characteristic_type || 'text',
      label: char.label || char.name || '',
      value_numeric: char.value_numeric,
      value_text: char.value_text,
      value_color: char.value_color,
      selected_enum_id: char.selected_enum_id,
      selected_enum_value: char.selected_enum_value,
      unit_id: char.unit_id,
      unit_code: char.unit_code,
      is_primary: char.is_primary || false,
      is_required: char.is_required || false,
      sort_order: char.sort_order || 0
    }))
  }

  // Функция для получения цвета (приоритет - color_hex из БД)
  const getColorValue = (enumValue: SpecEnum): string => {
    // Если есть color_hex в БД - используем его
    if (enumValue.color_hex) {
      return enumValue.color_hex
    }

    // Фолбэк на старую карту цветов для совместимости
    const colorMap: { [key: string]: string } = {
      'телесный': '#D1D5DB',
      'черный матовый': '#1F1F1F',
      'белый глянцевый': '#FFFFFF',
      'серебристый металлик': '#B8B8B8',
      'синий': '#2563EB',
      'красный': '#6B7280',
      'зеленый': '#16A34A',
      'прозрачный': 'rgba(255,255,255,0.4)',
      'камуфляж': '#8B7355',
      'под заказ': 'linear-gradient(45deg, #E5E7EB, #F3F4F6, #F9FAFB, #E5E7EB, #D1D5DB)',
      'коричневый': '#8B4513',
      'желтый': '#9CA3AF',
      'фиолетовый': '#7C3AED',
      'оранжевый': '#9CA3AF',
      'розовый': '#9CA3AF',
      'серый': '#6B7280',
      'золотой': '#D4AF37',
      'серебряный': '#C0C0C0'
    }

    const normalizedName = enumValue.value.toLowerCase().trim()
    return colorMap[normalizedName] || '#E5E7EB'
  }

  const toggleGroupExpansion = (groupId: string | number) => {
    const newExpanded = new Set(expandedGroups)
    const id = String(groupId)
    const wasExpanded = newExpanded.has(id)

    if (wasExpanded) {
      newExpanded.delete(id)

    } else {
      newExpanded.add(id)

    }

    console.log('🔄 Обновляем expandedGroups:', {
      before: Array.from(expandedGroups),
      after: Array.from(newExpanded),
      action: wasExpanded ? 'collapse' : 'expand',
      groupId: id
    })

    setExpandedGroups(newExpanded)
  }

  // Функция handleGroupToggle больше не нужна, так как группы активируются автоматически

  const handleAddCharacteristic = (groupId: number, groupName: string) => {
    setCharacteristicFormData({
      group_id: groupId,
      label: "",
      characteristic_type: 'text',
      value_text: "",
      value_numeric: undefined,
      value_color: "#000000",
      selected_enum_id: undefined,
      is_required: false,
      is_primary: false
    })
    setEditingCharacteristic(null)
    setIsCharacteristicDialogOpen(true)
  }

  const handleEditCharacteristic = (characteristic: ProductCharacteristic) => {
    setCharacteristicFormData({
      group_id: characteristic.group_id,
      label: characteristic.label,
      characteristic_type: characteristic.characteristic_type,
      value_text: characteristic.value_text || "",
      value_numeric: characteristic.value_numeric,
      value_color: characteristic.value_color || "#000000",
      selected_enum_id: characteristic.selected_enum_id,
      is_required: characteristic.is_required || false,
      is_primary: characteristic.is_primary || false
    })
    setEditingCharacteristic(characteristic)
    setIsCharacteristicDialogOpen(true)
  }

  const handleSaveCharacteristic = () => {
    if (!characteristicFormData.label.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название характеристики",
        variant: "destructive"
      })
      return
    }

    const group = findGroup(characteristicFormData.group_id)
    if (!group) {
      toast({
        title: "Ошибка",
        description: "Группа не найдена",
        variant: "destructive"
      })
      return
    }

    const characteristic: ProductCharacteristic = {
      id: editingCharacteristic?.id || `temp-${Date.now()}`,
      group_id: characteristicFormData.group_id,
      group_name: group.name,
      characteristic_type: characteristicFormData.characteristic_type,
      label: characteristicFormData.label,
      value_text: characteristicFormData.value_text,
      value_numeric: characteristicFormData.value_numeric,
      value_color: characteristicFormData.value_color,
      selected_enum_id: characteristicFormData.selected_enum_id,
      is_required: characteristicFormData.is_required,
      is_primary: characteristicFormData.is_primary,
      sort_order: 0
    }

    let updatedCharacteristics: ProductCharacteristic[]

    if (editingCharacteristic) {
      // Обновляем существующую характеристику
      updatedCharacteristics = productCharacteristics.map(char =>
        char.id === editingCharacteristic.id ? characteristic : char
      )
    } else {
      // Добавляем новую характеристику
      updatedCharacteristics = [...productCharacteristics, characteristic]
    }

    setProductCharacteristics(updatedCharacteristics)
    onCharacteristicsChange(updatedCharacteristics)

    // Убеждаемся что группа выбрана
    // Удалено: setSelectedGroups(prev => new Set([...prev, characteristicFormData.group_id]))

    setIsCharacteristicDialogOpen(false)
    resetCharacteristicForm()

    toast({
      title: "Успешно",
      description: editingCharacteristic ? "Характеристика обновлена" : "Характеристика добавлена"
    })
  }

  const handleDeleteCharacteristic = (characteristicId: string) => {
    if (!confirm("Удалить эту характеристику?")) return

    const updatedCharacteristics = productCharacteristics.filter(char => char.id !== characteristicId)
    setProductCharacteristics(updatedCharacteristics)
    onCharacteristicsChange(updatedCharacteristics)

    toast({
      title: "Успешно",
      description: "Характеристика удалена"
    })
  }

  const resetCharacteristicForm = () => {
    setCharacteristicFormData({
      group_id: 0,
      label: "",
      characteristic_type: 'text',
      value_text: "",
      value_numeric: undefined,
      value_color: "#000000",
      selected_enum_id: undefined,
      is_required: false,
      is_primary: false
    })
    setEditingCharacteristic(null)
  }

  const findGroup = (groupId: number): SpecGroup | undefined => {
    const searchInGroups = (groups: SpecGroup[]): SpecGroup | undefined => {
      for (const group of groups) {
        if (group.id === groupId || (typeof group.id === 'string' && group.id.endsWith(`_${groupId}`))) {
          return group
        }
        if (group.children) {
          const found = searchInGroups(group.children)
          if (found) return found
        }
      }
      return undefined
    }
    return searchInGroups(specGroups)
  }

  // Фильтрация данных с поддержкой иерархии
  const filteredGroups = (() => {
    if (!search.trim()) return specGroups

    const filterGroup = (group: SpecGroup): SpecGroup | null => {
      const matchesSearch = group.name.toLowerCase().includes(search.toLowerCase())
      const filteredChildren = group.children ? group.children.map(filterGroup).filter(Boolean) as SpecGroup[] : []

      if (matchesSearch || filteredChildren.length > 0) {
        return {
          ...group,
          children: filteredChildren
        }
      }

      return null
    }

    return specGroups.map(filterGroup).filter(Boolean) as SpecGroup[]
  })()

  // Функции для подсчета характеристик
  const getTotalCharacteristicsCount = (group: SpecGroup): number => {
    let count = group.enum_values?.length || 0

    if (group.children && group.children.length > 0) {
      group.children.forEach(child => {
        count += getTotalCharacteristicsCount(child)
      })
    }

    return count
  }

  const getTotalSubgroupsCount = (group: SpecGroup): number => {
    let count = 0
    if (group.children && group.children.length > 0) {
      count += group.children.length
      group.children.forEach(child => {
        count += getTotalSubgroupsCount(child)
      })
    }
    return count
  }

  // Получить характеристики группы (только действительно пользовательские)
  const getGroupCharacteristics = (groupId: number): ProductCharacteristic[] => {
    return productCharacteristics.filter(char => {
      // Только пользовательские характеристики (не соответствующие enum значениям)
      return char.group_id === groupId && !char.selected_enum_id
    })
  }

  // Проверка активности группы (есть ли выбранные характеристики)
  const isGroupActive = (groupId: number): boolean => {
    // Проверяем есть ли характеристики в этой группе
    const hasCharacteristics = productCharacteristics.some(char => char.group_id === groupId)

    // Проверяем есть ли характеристики в дочерних группах
    const hasChildCharacteristics = (group: SpecGroup): boolean => {
      if (group.children && group.children.length > 0) {
        return group.children.some(child =>
          productCharacteristics.some(char => char.group_id === Number(child.id)) ||
          hasChildCharacteristics(child)
        )
      }
      return false
    }

    // Находим группу и проверяем дочерние элементы
    const group = findGroup(groupId)
    const hasChildrenWithCharacteristics = group ? hasChildCharacteristics(group) : false

    return hasCharacteristics || hasChildrenWithCharacteristics
  }

  // Подсчет активных групп
  const getActiveGroupsCount = (): number => {
    const countActiveGroups = (groups: SpecGroup[]): number => {
      let count = 0
      groups.forEach(group => {
        if (isGroupActive(Number(group.id))) {
          count++
        }
        if (group.children && group.children.length > 0) {
          count += countActiveGroups(group.children)
        }
      })
      return count
    }
    return countActiveGroups(specGroups)
  }

  // Рендер таблицы
  const renderTableView = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Название группы / Характеристика
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Количество
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {renderHierarchicalRows(filteredGroups, 0)}
            </tbody>
          </table>
        </div>

        {filteredGroups.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-4 text-gray-300"/>
            <div className="text-lg font-medium mb-2">Нет групп характеристик</div>
            <div className="text-sm mb-4">Создайте группы или измените фильтр поиска</div>
          </div>
        )}
      </div>
    )
  }

  // Рендер иерархических строк в стиле Notion
  const renderHierarchicalRows = (groups: SpecGroup[], level: number): React.ReactNode[] => {
    const rows: React.ReactNode[] = []

    groups.forEach(group => {
      // Добавляем строку группы
      rows.push(renderGroupRow(group, level))

      // Если группа развернута, показываем её характеристики
      const isExpanded = expandedGroups.has(String(group.id))

      if (isExpanded) {
        // Показываем доступные характеристики из API
        if (group.enum_values && group.enum_values.length > 0) {
          group.enum_values
            .sort((a, b) => a.ordering - b.ordering || a.value.localeCompare(b.value))
            .forEach(enumValue => {
              rows.push(renderAvailableCharacteristicRow(enumValue, group))
            })
        }

        // Показываем только действительно пользовательские характеристики (не enum)
        const groupCharacteristics = getGroupCharacteristics(Number(group.id))
        groupCharacteristics.forEach(characteristic => {
          rows.push(renderCustomCharacteristicRow(characteristic, group))
        })
      }

      // Если группа развернута и у неё есть дочерние группы, рендерим их рекурсивно
      if (isExpanded && group.children && group.children.length > 0) {
        rows.push(...renderHierarchicalRows(group.children, level + 1))
      }
    })

    return rows
  }

  // Рендер строки группы
  const renderGroupRow = (group: SpecGroup, level: number) => {
    const hasChildren = (group.children && group.children.length > 0) || (group.enum_values && group.enum_values.length > 0)
    const isExpanded = expandedGroups.has(String(group.id))
    const isActive = isGroupActive(Number(group.id)) // Изменено: используем isGroupActive вместо selectedGroups
    const totalCharacteristicsCount = getTotalCharacteristicsCount(group)
    const totalSubgroupsCount = getTotalSubgroupsCount(group)
    const groupCharacteristics = getGroupCharacteristics(Number(group.id))

    // Используем уровень из самой группы, если он есть, иначе переданный параметр
    const actualLevel = group.level !== undefined ? group.level : level

    // Определяем отступы как в IDE - каждый уровень четко смещен
    let paddingLeft = 12 // Базовый отступ для корневых элементов
    if (actualLevel > 0) {
      paddingLeft += actualLevel * 24 // 24px на каждый уровень вложенности (как в VS Code)
    }

    // Определяем, является ли элемент разделом
    const isSection = group.is_section === true

    return (
      <tr
        key={`group-${group.id}`}
        className={`hover:bg-gray-50/80 transition-colors group ${isSection ? 'bg-gray-100/50' : ''} ${isActive ? 'bg-blue-50/50' : ''}`}
      >
        <td className="py-2 pr-3" style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-2">
            {/* Стрелочка раскрытия */}
            {hasChildren ? (
              <button
                onClick={() => toggleGroupExpansion(group.id)}
                className="flex items-center justify-center w-4 h-4 rounded hover:bg-gray-200 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-600" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                )}
              </button>
            ) : (
              <div className="w-4 h-4"></div>
            )}

            {/* Иконка и название */}
            <div className="flex items-center gap-2">
              {/* Улучшенные иконки с учетом типа */}
              {isSection ? (
                // Иконки для разделов - серый цвет
                isExpanded && hasChildren ?
                  <FolderOpen className="w-4 h-4 text-gray-600" /> :
                  <Folder className="w-4 h-4 text-gray-600" />
              ) : actualLevel === 1 || (actualLevel === 0 && group.parent_id) ? (
                // Иконки для групп в разделах
                <Package className="w-4 h-4 text-slate-600" />
              ) : actualLevel === 0 && !group.parent_id ? (
                // Иконки для независимых групп
                <Hash className="w-4 h-4 text-amber-600" />
              ) : (
                // Иконки для подгрупп
                <Tag className="w-4 h-4 text-gray-500" />
              )}

              <span className={`text-sm font-medium ${isSection ? 'text-gray-800' : 'text-gray-900'}`}>
                {group.name}
              </span>

              {/* Независимая группа индикатор */}
              {!group.is_section && !group.parent_id && actualLevel === 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  Независимая
                </span>
              )}

              {/* Индикатор активности группы */}
              {isActive && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
                  Активна
                </span>
              )}
            </div>
          </div>

          {/* Описание под названием */}
          {group.description && (
            <div
              className={`text-xs mt-1 ${isSection ? 'text-gray-600' : 'text-gray-500'}`}
              style={{ paddingLeft: `${24}px` }}
            >
              {group.description}
            </div>
          )}
        </td>

        <td className="px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-2">
            {totalCharacteristicsCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {totalCharacteristicsCount} хар-к
              </span>
            )}
            {groupCharacteristics.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                {groupCharacteristics.length} выбрано
              </span>
            )}
            {totalSubgroupsCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {totalSubgroupsCount} подгрупп
              </span>
            )}
            {totalCharacteristicsCount === 0 && totalSubgroupsCount === 0 && groupCharacteristics.length === 0 && (
              <span className="text-gray-400 text-xs">пусто</span>
            )}
          </div>
        </td>

        <td className="px-3 py-2">
          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAddCharacteristic(Number(group.id), group.name)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-green-600"
              title="Добавить характеристику"
            >
              <Plus className="w-3 h-3"/>
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  // Рендер строки доступной характеристики из API
  const renderAvailableCharacteristicRow = (enumValue: SpecEnum, parentGroup: SpecGroup) => {
    const groupLevel = parentGroup.level !== undefined ? parentGroup.level : 0
    let paddingLeft = 12 + (groupLevel + 1) * 24

    // Проверяем есть ли уже такая характеристика у товара
    const existingChar = productCharacteristics.find(char =>
      char.group_id === enumValue.group_id && char.selected_enum_id === enumValue.id
    )

    return (
      <tr
        key={`enum-${enumValue.id}`}
        className={`hover:bg-emerald-50/30 transition-colors group ${existingChar ? 'bg-green-50/30' : ''}`}
      >
        <td className="py-1.5 pr-3" style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4"></div>

            <div className="flex items-center gap-2">
              {/* Цветовой квадратик для группы "Цвет" */}
              {(Number(parentGroup.id) === 17) ? (
                <div
                  className="w-3 h-3 rounded border flex-shrink-0 shadow-sm"
                  style={{
                    background: getColorValue(enumValue),
                    border: enumValue.value.toLowerCase().includes('белый') ? '1px solid #D1D5DB' : '1px solid #9CA3AF'
                  }}
                  title={`Цвет: ${enumValue.value}`}
                />
              ) : (
                <div className="w-3 h-3 rounded border border-emerald-300 bg-emerald-100 flex-shrink-0" />
              )}

              <span className="text-sm text-gray-700">
                {enumValue.value}
              </span>

              {existingChar && (
                <Check className="w-3 h-3 text-green-600" />
              )}
            </div>
          </div>
        </td>

        <td className="px-3 py-1.5 text-center">
          <Switch
            checked={!!existingChar}
            onCheckedChange={(checked) => {
              if (checked) {
                // Добавляем характеристику
                const newChar: ProductCharacteristic = {
                  id: `enum-${enumValue.id}-${Date.now()}`,
                  group_id: enumValue.group_id,
                  group_name: parentGroup.name,
                  characteristic_type: 'select',
                  label: enumValue.value,
                  selected_enum_id: enumValue.id,
                  selected_enum_value: enumValue.value,
                  is_primary: false,
                  is_required: false,
                  sort_order: enumValue.ordering
                }
                const updatedCharacteristics = [...productCharacteristics, newChar]
                setProductCharacteristics(updatedCharacteristics)
                onCharacteristicsChange(updatedCharacteristics)

                // Убеждаемся что группа выбрана
                // Удалено: setSelectedGroups(prev => new Set([...prev, enumValue.group_id]))
              } else {
                // Удаляем характеристику
                const updatedCharacteristics = productCharacteristics.filter(char =>
                  !(char.group_id === enumValue.group_id && char.selected_enum_id === enumValue.id)
                )
                setProductCharacteristics(updatedCharacteristics)
                onCharacteristicsChange(updatedCharacteristics)
              }
            }}
          />
        </td>

        <td className="px-3 py-1.5 text-center">
          <span className="text-xs text-gray-500">—</span>
        </td>

        <td className="px-3 py-1.5">
          <div className="flex items-center justify-center gap-1">
            {existingChar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditCharacteristic(existingChar)}
                className="h-5 w-5 p-0 text-gray-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Редактировать характеристику"
              >
                <Edit className="w-2.5 h-2.5"/>
              </Button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  // Рендер строки пользовательской характеристики
  const renderCustomCharacteristicRow = (characteristic: ProductCharacteristic, parentGroup: SpecGroup) => {
    const groupLevel = parentGroup.level !== undefined ? parentGroup.level : 0
    let paddingLeft = 12 + (groupLevel + 1) * 24

    return (
      <tr
        key={`custom-${characteristic.id}`}
        className="hover:bg-blue-50/30 transition-colors group bg-blue-50/20"
      >
        <td className="py-1.5 pr-3" style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4"></div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border border-blue-300 bg-blue-100 flex-shrink-0" />

              <span className="text-sm text-gray-700 font-medium">
                {characteristic.label}
              </span>

              <Badge variant="secondary" className="text-xs">
                Пользовательская
              </Badge>

              {characteristic.is_primary && (
                <Badge variant="default" className="text-xs">
                  Основная
                </Badge>
              )}
            </div>
          </div>
        </td>

        <td className="px-3 py-1.5 text-center">
          <Check className="w-4 h-4 text-blue-600 mx-auto" />
        </td>

        <td className="px-3 py-1.5 text-center">
          <span className="text-xs text-blue-600">
            {characteristic.characteristic_type}
          </span>
        </td>

        <td className="px-3 py-1.5">
          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditCharacteristic(characteristic)}
              className="h-5 w-5 p-0 text-gray-400 hover:text-blue-600"
              title="Редактировать характеристику"
            >
              <Edit className="w-2.5 h-2.5"/>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteCharacteristic(characteristic.id!)}
              className="h-5 w-5 p-0 text-gray-400 hover:text-red-600"
              title="Удалить характеристику"
            >
              <Trash2 className="w-2.5 h-2.5"/>
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <div className="text-lg">Загрузка характеристик...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5"/>
            Характеристики товара
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExpandedGroups(new Set())

              }}
              className="text-xs"
            >
              <ChevronRight className="w-3 h-3 mr-1"/>
              Свернуть все
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allGroupIds = new Set<string>()
                const collectIds = (groups: SpecGroup[]) => {
                  groups.forEach(group => {
                    allGroupIds.add(String(group.id))
                    if (group.children) {
                      collectIds(group.children)
                    }
                  })
                }
                collectIds(specGroups)
                setExpandedGroups(allGroupIds)

              }}
              className="text-xs"
            >
              <ChevronDown className="w-3 h-3 mr-1"/>
              Развернуть все
            </Button>
          </div>
        </div>

        {productCharacteristics.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Выбрано характеристик: {productCharacteristics.length}</span>
            <span className="text-gray-400">•</span>
            <span>Групп: {getActiveGroupsCount()}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Поиск */}
        <div className="flex items-center gap-4">
          <Input
            placeholder="Поиск групп характеристик..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Таблица характеристик */}
        {renderTableView()}
      </CardContent>

      {/* Диалог создания/редактирования характеристики */}
      <Dialog open={isCharacteristicDialogOpen} onOpenChange={(open) => {
        setIsCharacteristicDialogOpen(open)
        if (!open) resetCharacteristicForm()
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingCharacteristic ? "Редактировать характеристику" : "Новая характеристика"}
            </DialogTitle>
            <DialogDescription>
              {editingCharacteristic ? "Изменение существующей характеристики товара" : "Создание новой характеристики для товара"}
            </DialogDescription>
            {!editingCharacteristic && characteristicFormData.group_id > 0 && (() => {
              const targetGroup = findGroup(characteristicFormData.group_id)
              return targetGroup ? (
                <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                  <span className="font-medium">Добавление в группу:</span> {targetGroup.name}
                </div>
              ) : null
            })()}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="characteristicLabel">Название характеристики *</Label>
              <Input
                id="characteristicLabel"
                value={characteristicFormData.label}
                onChange={(e) => setCharacteristicFormData(prev => ({
                  ...prev,
                  label: e.target.value
                }))}
                placeholder="Например: Материал корпуса, Вес..."
              />
            </div>

            <div>
              <Label htmlFor="characteristicType">Тип характеристики</Label>
              <Select
                value={characteristicFormData.characteristic_type}
                onValueChange={(value: 'text' | 'numeric' | 'select' | 'boolean' | 'color') =>
                  setCharacteristicFormData(prev => ({ ...prev, characteristic_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Текст</SelectItem>
                  <SelectItem value="numeric">Число</SelectItem>
                  <SelectItem value="select">Выпадающий список</SelectItem>
                  <SelectItem value="boolean">Да/Нет</SelectItem>
                  <SelectItem value="color">Цвет</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Поля для разных типов характеристик */}
            {characteristicFormData.characteristic_type === 'text' && (
              <div>
                <Label htmlFor="characteristicValueText">Значение</Label>
                <Input
                  id="characteristicValueText"
                  value={characteristicFormData.value_text}
                  onChange={(e) => setCharacteristicFormData(prev => ({
                    ...prev,
                    value_text: e.target.value
                  }))}
                  placeholder="Введите текстовое значение"
                />
              </div>
            )}

            {characteristicFormData.characteristic_type === 'numeric' && (
              <div>
                <Label htmlFor="characteristicValueNumeric">Числовое значение</Label>
                <Input
                  id="characteristicValueNumeric"
                  type="number"
                  value={characteristicFormData.value_numeric || ''}
                  onChange={(e) => setCharacteristicFormData(prev => ({
                    ...prev,
                    value_numeric: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="Введите число"
                  step="0.01"
                />
              </div>
            )}

            {characteristicFormData.characteristic_type === 'color' && (
              <div>
                <Label htmlFor="characteristicValueColor">Цвет</Label>
                <div className="flex gap-3 items-center">
                  <Input
                    id="characteristicValueColor"
                    value={characteristicFormData.value_color}
                    onChange={(e) => setCharacteristicFormData(prev => ({
                      ...prev,
                      value_color: e.target.value
                    }))}
                    placeholder="#FF5733"
                    className="flex-1"
                  />
                  <input
                    type="color"
                    value={characteristicFormData.value_color}
                    onChange={(e) => setCharacteristicFormData(prev => ({
                      ...prev,
                      value_color: e.target.value
                    }))}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {characteristicFormData.characteristic_type === 'select' && (
              <div>
                <Label>Выберите значение из списка</Label>
                <Select
                  value={characteristicFormData.selected_enum_id?.toString() || ''}
                  onValueChange={(value) => {
                    const enumId = parseInt(value)
                    const group = findGroup(characteristicFormData.group_id)
                    const enumValue = group?.enum_values?.find(e => e.id === enumId)
                    setCharacteristicFormData(prev => ({
                      ...prev,
                      selected_enum_id: enumId,
                      label: enumValue?.value || prev.label
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите значение..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const group = findGroup(characteristicFormData.group_id)
                      return group?.enum_values?.map(enumValue => (
                        <SelectItem key={enumValue.id} value={enumValue.id.toString()}>
                          {enumValue.value}
                        </SelectItem>
                      )) || []
                    })()}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isRequired"
                  checked={characteristicFormData.is_required}
                  onCheckedChange={(checked) => setCharacteristicFormData(prev => ({
                    ...prev,
                    is_required: checked
                  }))}
                />
                <Label htmlFor="isRequired">Обязательная</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isPrimary"
                  checked={characteristicFormData.is_primary}
                  onCheckedChange={(checked) => setCharacteristicFormData(prev => ({
                    ...prev,
                    is_primary: checked
                  }))}
                />
                <Label htmlFor="isPrimary">Основная</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSaveCharacteristic} className="bg-blue-500 hover:bg-blue-600">
                <Save className="w-4 h-4 mr-2" />
                {editingCharacteristic ? "Сохранить изменения" : "Добавить характеристику"}
              </Button>
              <Button variant="outline" onClick={() => setIsCharacteristicDialogOpen(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}