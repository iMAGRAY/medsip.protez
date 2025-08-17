"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Trash2,
  Settings,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Package,
  Star,
  Save,
  Search,
  Check,
  X,
  Target,
  Archive
} from 'lucide-react'
import { toast } from 'sonner'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getCharacteristicColor } from '@/lib/theme-colors'

// Интерфейсы
interface SpecGroup {
  id: number
  name: string
  description?: string
  enum_count?: number
  enum_values?: SpecEnum[]
  parent_id?: number | null
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
  display_name?: string
  ordering: number
  parent_id?: number
  children?: SpecEnum[]
  color_value?: string
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
}

interface CharacteristicTemplate {
  id: string
  name: string
  description?: string
  characteristics: ProductCharacteristic[]
  created_at: string
  is_favorite?: boolean
}

interface ProductSpecificationsManagerProps {
  productId?: number | null
  productName: string
  specifications: any[]
  onSpecificationsChange: (specifications: any[]) => void
  isNewProduct?: boolean
}

export function ProductSpecificationsManagerNew({
  productId,
  productName: _productName,
  specifications: _specifications = [],
  onSpecificationsChange,
  isNewProduct = false
}: ProductSpecificationsManagerProps) {
  // Основные состояния
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([])
  const [productCharacteristics, setProductCharacteristics] = useState<ProductCharacteristic[]>([])
  const [templates, setTemplates] = useState<CharacteristicTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Состояния интерфейса
  const [activeStep, setActiveStep] = useState<'groups' | 'configure' | 'manage'>('groups')
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [_expandedGroups, _setExpandedGroups] = useState<Set<string>>(new Set())

  // Диалоги
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isGroupConfigDialogOpen, setIsGroupConfigDialogOpen] = useState(false)
  const [configuringGroup, setConfiguringGroup] = useState<SpecGroup | null>(null)

  // Формы
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: ''
  })

  const [characteristicForm, setCharacteristicForm] = useState({
    type: 'text' as 'text' | 'numeric' | 'select' | 'boolean' | 'color',
    label: '',
    value_text: '',
    value_numeric: undefined as number | undefined,
    value_color: '#000000',
    selected_enum_id: undefined as number | undefined,
    is_required: false,
    is_primary: false
  })

  // Добавляем состояние для режима просмотра
  const [viewMode, setViewMode] = useState<'compact' | 'table'>('compact')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())

  // ID редактируемой характеристики (метка)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState<string>('')  

  // Функция для обработки данных характеристик из API (должна быть выше использования)
  const processApiCharacteristics = useCallback((apiData: any[]): ProductCharacteristic[] => {
    return apiData.map(item => ({
      id: `char_${item.id}`,
      group_id: item.group_id,
      group_name: item.group_name,
      characteristic_type: item.type === 'enum' ? 'select' : item.type,
      label: item.label || item.group_name,
      value_numeric: item.value_numeric,
      value_text: item.value_text,
      selected_enum_value: item.enum_value,
      unit_code: item.unit_code,
      is_primary: false,
      is_required: false,
      sort_order: 0
    }))
  }, [])

  // Функция для инициализации свернутых групп
  useEffect(() => {
    if (selectedGroups.size > 0) {
      // Сворачиваем все группы кроме первой для компактности
      const groupsArray = Array.from(selectedGroups)
      const groupsToCollapse = groupsArray.slice(1) // Оставляем первую группу развернутой
      setCollapsedGroups(new Set(groupsToCollapse))
    }
  }, [selectedGroups])

  // Загрузка данных
    const loadData = useCallback(async () => {
              try {
                setLoading(true)

                // Сбрасываем состояние для новых товаров
                if (isNewProduct) {
                  setSelectedGroups(new Set())
                  setProductCharacteristics([])
                  setActiveStep('groups')
                }

                await Promise.all([
                  loadSpecGroups(),
                  loadProductCharacteristics(),
                  loadTemplates()
                ])
              } finally {
                setLoading(false)
              }
            }, [isNewProduct])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Синхронизация с родительским компонентом
  useEffect(() => {

    onSpecificationsChange(productCharacteristics)
  }, [productCharacteristics, onSpecificationsChange])

  // Вспомогательная функция для обработки иерархических групп (перемещена выше использования)
  const processHierarchicalGroups = useCallback((groups: any[]): SpecGroup[] => {
    const processGroup = (group: any, _index: number): SpecGroup | null => {
      let groupId: number;

      // Обрабатываем разные форматы ID
      if (typeof group.id === 'string' && group.id.startsWith('spec_')) {
        // Извлекаем числовую часть из формата spec_XXX
        const numericPart = group.id.replace('spec_', '');
        groupId = Number(numericPart);
      } else {
        // Обычное преобразование в число
        groupId = Number(group.id);
      }

      // Если ID не является корректным числом, пропускаем эту группу
      if (isNaN(groupId) || groupId <= 0) {
        // Skipping group with invalid ID
        return null
      }

      const processedGroup: SpecGroup = {
        id: groupId,
        name: group.name || `Group ${groupId}`,
        description: group.description || ''
      }

      return processedGroup
    }

    return groups.map((group, index) => processGroup(group, index)).filter(Boolean) as SpecGroup[]
  }, [])

  const loadSpecGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/specifications')
      if (res.ok) {
        const apiResponse = await res.json()
        const data = apiResponse.data || apiResponse
        const processedGroups = processHierarchicalGroups(data)

        if (process.env.NODE_ENV === 'development') {
          // Spec groups loaded
        }

        setSpecGroups(processedGroups)
      }
    } catch (error) {
      // Error loading spec groups
      toast.error('Не удалось загрузить группы характеристик')
    }
  }, [processHierarchicalGroups])

  const loadProductCharacteristics = useCallback(async () => {
    if (!productId || isNewProduct) {
              // Для новых товаров не загружаем характеристики
      if (process.env.NODE_ENV === 'development') {

      }
      return
    }

    try {
      const res = await fetch(`/api/products/${productId}/characteristics`)
      if (res.ok) {
        const data = await res.json()
        // Преобразуем данные из API в формат для отображения
        const processedCharacteristics = processApiCharacteristics(data)
        setProductCharacteristics(processedCharacteristics)

        // Обновляем выбранные группы на основе существующих характеристик
        const existingGroupIds = new Set(processedCharacteristics.map(char => char.group_id))

        if (process.env.NODE_ENV === 'development') {

          // Group IDs from characteristics
        }

        setSelectedGroups(existingGroupIds)

        // Если есть характеристики, переходим на шаг управления
        if (processedCharacteristics.length > 0) {
          setActiveStep('manage')
        }
      }
    } catch (error) {
      // Error loading product characteristics
    }
  }, [productId, isNewProduct, processApiCharacteristics])

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/form-templates')
      if (res.ok) {
        const data = await res.json()

        setTemplates(data)
      } else {
        // Failed to load templates
      }
    } catch (error) {
      // Error loading templates
    }
  }

  // УДАЛЕНА дублированная функция processHierarchicalGroups - уже определена выше
  // УДАЛЕНА дублированная функция processApiCharacteristics - уже определена выше

  // Управление выбором групп
  const handleGroupToggle = (groupId: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    event?.preventDefault()

    // Проверяем, что groupId является корректным числом
    if (isNaN(groupId) || groupId === 0) {
      // Invalid groupId
      toast.error('Ошибка: некорректный ID группы')
      return
    }

    // Для отладки - потом можно убрать
    if (process.env.NODE_ENV === 'development') {
      // Toggling group
    }

    setSelectedGroups(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(groupId)) {
        newSelected.delete(groupId)
        // Удаляем характеристики этой группы
        setProductCharacteristics(prevChars =>
          prevChars.filter(char => char.group_id !== groupId)
        )
        toast.success('Группа убрана из выбора')
      } else {
        newSelected.add(groupId)
        toast.success('Группа добавлена в выбор')
      }

      if (process.env.NODE_ENV === 'development') {
        // New selected groups
      }

      return newSelected
    })
  }

  const handleConfigureGroup = (group: SpecGroup) => {

    setConfiguringGroup(group)
    setIsGroupConfigDialogOpen(true)
  }

  const handleAddCharacteristic = (event?: React.MouseEvent) => {
    event?.preventDefault()
    event?.stopPropagation()

    if (!configuringGroup) return

    const newCharacteristic: ProductCharacteristic = {
      id: `char_${Date.now()}`,
      group_id: Number(configuringGroup.id),
      group_name: configuringGroup.name,
      characteristic_type: characteristicForm.type,
      label: characteristicForm.label,
      value_numeric: characteristicForm.value_numeric,
      value_text: characteristicForm.value_text,
      value_color: characteristicForm.value_color,
      selected_enum_id: characteristicForm.selected_enum_id,
      is_primary: characteristicForm.is_primary,
      is_required: characteristicForm.is_required,
      sort_order: productCharacteristics.length
    }

    setProductCharacteristics(prev => [...prev, newCharacteristic])

    // Сбрасываем форму
    setCharacteristicForm({
      type: 'text',
      label: '',
      value_text: '',
      value_numeric: undefined,
      value_color: '#000000',
      selected_enum_id: undefined,
      is_required: false,
      is_primary: false
    })

    // Закрываем диалог
    setIsGroupConfigDialogOpen(false)

    toast.success('Характеристика добавлена')
  }

  const handleDeleteCharacteristic = (characteristicId: string) => {
    setProductCharacteristics(prev => {
      const updated = prev.filter(char => char.id !== characteristicId)
      return updated
    })
  }

  const handleUpdateCharacteristic = (characteristicId: string, updates: Partial<ProductCharacteristic>) => {
    setProductCharacteristics(prev => {
      const updated = prev.map(char =>
        char.id === characteristicId ? { ...char, ...updates } : char
      )
      return updated
    })
  }

  const handleAddEnumCharacteristic = (enumValue: SpecEnum) => {
    if (!configuringGroup) return

    const newCharacteristic: ProductCharacteristic = {
      id: `char_enum_${Date.now()}_${enumValue.id}`,
      group_id: Number(configuringGroup.id),
      group_name: configuringGroup.name,
      characteristic_type: 'select',
      label: enumValue.display_name || enumValue.value,
      selected_enum_id: enumValue.id,
      selected_enum_value: enumValue.value,
      is_primary: false,
      is_required: false,
      sort_order: productCharacteristics.length
    }

    setProductCharacteristics(prev => [...prev, newCharacteristic])
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      toast.error('Введите название шаблона')
      return
    }

    try {
      setSaving(true)
      const templateData = {
        name: templateForm.name,
        description: templateForm.description,
        characteristics: productCharacteristics
      }

      const res = await fetch('/api/form-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })

      if (res.ok) {
        const _savedTemplate = await res.json()

        toast.success('Шаблон сохранён')
        setIsTemplateDialogOpen(false)
        setTemplateForm({ name: '', description: '' })
        await loadTemplates()
      } else {
        const errorData = await res.json().catch(() => ({}))
        // Failed to save template
        toast.error('Не удалось сохранить шаблон')
      }
    } catch (error) {
      // Error saving template
      toast.error('Не удалось сохранить шаблон')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {

      const res = await fetch(`/api/form-templates/${templateId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Шаблон удалён')
        await loadTemplates()
      } else {
        const errorData = await res.json().catch(() => ({}))
        // Failed to delete template
        toast.error('Не удалось удалить шаблон')
      }
    } catch (error) {
      // Error deleting template
      toast.error('Не удалось удалить шаблон')
    }
  }

  const handleApplyTemplate = async (template: CharacteristicTemplate, mode: 'replace' | 'merge' = 'replace') => {
    try {

      // Проверяем, что характеристики валидны
      const validCharacteristics = template.characteristics.filter(char => {
        const hasValidGroupId = char.group_id && !isNaN(Number(char.group_id))
        const groupExists = specGroups.find(g => g.id === Number(char.group_id))

        if (!hasValidGroupId) {
          // Characteristic has invalid group_id
          return false
        }

        if (!groupExists) {
          // Group not found for characteristic
          return false
        }

        return true
      })

      if (validCharacteristics.length === 0) {
        toast.error('Шаблон не содержит совместимых характеристик')
        return
      }

      // Обновляем ID характеристик для избежания конфликтов
      const templateCharacteristics = validCharacteristics.map((char, index) => ({
        ...char,
        id: `template_char_${Date.now()}_${index}`,
        group_id: Number(char.group_id), // Убеждаемся что это число
        // Добавляем группу по имени если её нет
        group_name: char.group_name || specGroups.find(g => g.id === Number(char.group_id))?.name || 'Неизвестная группа'
      }))

      let finalCharacteristics: ProductCharacteristic[]
      let finalGroupIds: Set<number>

      if (mode === 'merge') {
        // Объединяем с существующими характеристиками
        const existingGroupIds = new Set(productCharacteristics.map(char => char.group_id))
        const newCharacteristics = templateCharacteristics.filter(char =>
          !existingGroupIds.has(char.group_id)
        )

        finalCharacteristics = [...productCharacteristics, ...newCharacteristics]
        finalGroupIds = new Set([
          ...Array.from(selectedGroups),
          ...templateCharacteristics.map(char => char.group_id)
        ])

        toast.success(`Шаблон "${template.name}" добавлен (${newCharacteristics.length} новых характеристик)`)
      } else {
        // Заменяем существующие характеристики
        finalCharacteristics = templateCharacteristics
        finalGroupIds = new Set(templateCharacteristics.map(char => char.group_id))

        toast.success(`Шаблон "${template.name}" применён (${templateCharacteristics.length} характеристик)`)
      }

      // Final selected groups

      setProductCharacteristics(finalCharacteristics)
      setSelectedGroups(finalGroupIds)

      // Синхронизируем с родительским компонентом
      onSpecificationsChange(finalCharacteristics)

      setActiveStep('manage')
      setIsTemplateDialogOpen(false) // Закрываем диалог

    } catch (error) {
      // Error applying template
      toast.error('Не удалось применить шаблон')
    }
  }

  // Удаляю дублированную цветовую карту и использую централизованную функцию
  const getColorForValue = (value: string) => {
    return getCharacteristicColor(value)
  }

  const filteredGroups = specGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Функция для переключения сворачивания группы
  const toggleGroupCollapse = (groupId: number) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const renderStepIndicator = () => (
    <div className="flex items-center space-x-3 mb-4">
      <div className={`flex items-center space-x-2 ${activeStep === 'groups' ? 'text-blue-600' : 'text-gray-400'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          activeStep === 'groups' ? 'bg-blue-600 text-white' : 'bg-gray-200'
        }`}>
          1
        </div>
        <span className="text-sm">Выбор групп</span>
      </div>

      <ChevronRight className="w-3 h-3 text-gray-400" />

      <div className={`flex items-center space-x-2 ${activeStep === 'configure' ? 'text-blue-600' : 'text-gray-400'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          activeStep === 'configure' ? 'bg-blue-600 text-white' : 'bg-gray-200'
        }`}>
          2
        </div>
        <span className="text-sm">Настройка</span>
      </div>

      <ChevronRight className="w-3 h-3 text-gray-400" />

      <div className={`flex items-center space-x-2 ${activeStep === 'manage' ? 'text-blue-600' : 'text-gray-400'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          activeStep === 'manage' ? 'bg-blue-600 text-white' : 'bg-gray-200'
        }`}>
          3
        </div>
        <span className="text-sm">Управление</span>
      </div>
    </div>
  )

  const renderGroupsStep = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Выберите группы характеристик</h3>
          <p className="text-xs text-gray-600">Выберите готовые группы характеристик для вашего товара</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsTemplateDialogOpen(true)}
          >
            <FolderOpen className="w-3 h-3 mr-1" />
            Шаблоны
          </Button>
          {selectedGroups.size > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelectedGroups(new Set())}
            >
              <X className="w-3 h-3 mr-1" />
              Очистить
            </Button>
          )}
          {process.env.NODE_ENV === 'development' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // State logged to console

                toast.success('Состояние выведено в консоль')
              }}
            >
              Debug
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-3 h-3 text-gray-400" />
        <Input
          placeholder="Поиск групп характеристик..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {filteredGroups.map(group => {
          const groupId = group.id // Уже число после processHierarchicalGroups
          const isSelected = selectedGroups.has(groupId)

          // Отладка
          if (process.env.NODE_ENV === 'development') {
            // Здесь можно добавить логи или другие отладочные действия
          }

          return (
            <Card
              key={`group-${group.id}`}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:shadow-md'
              }`}
              onClick={(event) => handleGroupToggle(groupId, event)}
            >
            <CardHeader className="pb-2 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  <CardTitle className="text-sm">{group.name}</CardTitle>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300'
                }`}>
                  {isSelected && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 py-2">
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">{group.description}</p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  {group.enum_count || 0}
                </Badge>
                {group.enums && group.enums.length > 0 && (
                  <div className="flex -space-x-1">
                    {group.enums.slice(0, 3).map((enumValue, index) => (
                      <div
                        key={`group-${group.id}-enum-${enumValue.id || index}`}
                        className="w-3 h-3 rounded-full border border-white"
                        style={{ backgroundColor: getColorForValue(enumValue.value) }}
                        title={enumValue.value}
                      />
                    ))}
                    {group.enums.length > 3 && (
                      <div className="w-3 h-3 rounded-full bg-gray-200 border border-white text-xs flex items-center justify-center">
                        +{group.enums.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
            )
        })}
      </div>

      <div className="flex justify-between pt-2">
        <div className="text-xs text-gray-500">
          Выбрано групп: {selectedGroups.size}
          {selectedGroups.size === 0 && (
            <div className="text-xs text-gray-400 mt-1">
              Нажмите на карточку группы для выбора
            </div>
          )}
          {selectedGroups.size > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              Выбранные группы: {Array.from(selectedGroups).map(id => {
                const group = specGroups.find(g => g.id === id)
                if (process.env.NODE_ENV === 'development') {

                }
                return group ? group.name : `ID:${id}`
              }).join(', ')}
            </div>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setActiveStep('configure')}
          disabled={selectedGroups.size === 0}
        >
          Настроить
        </Button>
      </div>
    </div>
  )

  const renderConfigureStep = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Настройка характеристик</h3>
          <p className="text-xs text-gray-600">Настройте характеристики для выбранных групп</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setActiveStep('groups')}
        >
          ← Назад
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from(selectedGroups).map(groupId => {
          const group = specGroups.find(g => g.id === groupId)
          if (!group) {
            // Group not found for ID
            return null
          }

          const groupCharacteristics = productCharacteristics.filter(char => char.group_id === groupId)

          return (
            <Card key={`config-group-${groupId}`}>
              <CardHeader className="pb-2 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    <CardTitle className="text-sm">{group.name}</CardTitle>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleConfigureGroup(group)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Добавить
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 py-2">
                <div className="space-y-2">
                  {groupCharacteristics.map((char, index) => (
                    <div key={`config-char-${char.id || index}`} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <span className="font-medium">{char.label}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          {char.characteristic_type}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCharacteristic(char.id!)}
                          className="p-1 h-6 w-6"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {groupCharacteristics.length === 0 && (
                    <div className="text-center py-3 text-gray-500">
                      <p className="text-xs">Нет характеристик в этой группе</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-between pt-2">
        <div className="text-xs text-gray-500">
          Всего характеристик: {productCharacteristics.length}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setActiveStep('manage')}
          disabled={productCharacteristics.length === 0}
        >
          Далее
        </Button>
      </div>
    </div>
  )

  const renderManageStep = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Управление характеристиками</h3>
          <p className="text-xs text-gray-600">Настройте значения характеристик для товара</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-gray-100 rounded p-1">
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'compact'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Компактный
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Таблица
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setActiveStep('groups')}
          >
            <Plus className="w-3 h-3 mr-1" />
            Группы
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsTemplateDialogOpen(true)}
          >
            <Save className="w-3 h-3 mr-1" />
            Шаблон
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
        // Табличный режим
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Группа</th>
                <th className="px-2 py-1 text-left font-medium">Характеристика</th>
                <th className="px-2 py-1 text-left font-medium">Значение</th>
                <th className="px-2 py-1 text-center font-medium">Осн.</th>
                <th className="px-2 py-1 text-center font-medium">Обяз.</th>
                <th className="px-2 py-1 text-center font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {productCharacteristics.map((char, index) => (
                <tr key={`table-char-${char.id || index}`} className="hover:bg-gray-50">
                  <td className="px-2 py-1 text-gray-600">{char.group_name}</td>
                  <td className="px-2 py-1 font-medium">
                    {editingLabelId === char.id ? (
                      <Input
                        value={editingLabelValue}
                        autoFocus
                        onChange={(e) => setEditingLabelValue(e.target.value)}
                        onBlur={commitEditLabel}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditLabel()
                          if (e.key === 'Escape') setEditingLabelId(null)
                        }}
                        className="h-6 text-xs"
                      />
                    ) : (
                      <span
                        className="text-xs font-medium text-gray-900 truncate cursor-pointer hover:underline"
                        onDoubleClick={() => startEditLabel(char)}
                      >
                        {char.label}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {char.characteristic_type === 'text' && (
                      <Input
                        value={char.value_text || ''}
                        onChange={(e) =>
                          handleUpdateCharacteristic(char.id!, { value_text: e.target.value })
                        }
                        placeholder="Значение"
                        className="h-6 text-xs"
                      />
                    )}
                    {char.characteristic_type === 'numeric' && (
                      <Input
                        type="number"
                        value={char.value_numeric || ''}
                        onChange={(e) =>
                          handleUpdateCharacteristic(char.id!, { value_numeric: Number(e.target.value) })
                        }
                        placeholder="Число"
                        className="h-6 text-xs"
                      />
                    )}
                    {char.characteristic_type === 'select' && (
                      <SearchableSelect
                        options={(specGroups.find(g => g.id === char.group_id)?.enums || []).map(ev => ({ value: ev.id, label: ev.value }))}
                        value={char.selected_enum_id || ''}
                        onValueChange={(val) => handleUpdateCharacteristic(char.id!, { selected_enum_id: Number(val) })}
                        placeholder="Выберите"/>
                    )}
                    {char.characteristic_type === 'boolean' && (
                      <Switch
                        checked={char.value_text === 'true'}
                        onCheckedChange={(checked) =>
                          handleUpdateCharacteristic(char.id!, { value_text: checked ? 'true' : 'false' })
                        }
                        className="scale-75"
                      />
                    )}
                    {char.characteristic_type === 'color' && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={char.value_color || '#000000'}
                          onChange={(e) =>
                            handleUpdateCharacteristic(char.id!, { value_color: e.target.value })
                          }
                          className="w-8 h-6 border border-gray-300 rounded cursor-pointer"
                          title="Выбрать цвет"
                        />
                        <Input
                          value={char.value_color || ''}
                          onChange={(e) =>
                            handleUpdateCharacteristic(char.id!, { value_color: e.target.value })
                          }
                          placeholder="#FF5733"
                          className="h-6 text-xs flex-1"
                        />
                        <div
                          className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                          style={{
                            background: char.value_color || '#E5E7EB',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}
                          title={`Цвет: ${char.value_color || 'не выбран'}`}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <Switch
                      checked={char.is_primary}
                      onCheckedChange={(checked) =>
                        handleUpdateCharacteristic(char.id!, { is_primary: checked })
                      }
                      className="scale-75"
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <Switch
                      checked={char.is_required}
                      onCheckedChange={(checked) =>
                        handleUpdateCharacteristic(char.id!, { is_required: checked })
                      }
                      className="scale-75"
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCharacteristic(char.id!)}
                      className="p-0 h-6 w-6"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {productCharacteristics.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              <p className="text-xs">Нет характеристик</p>
            </div>
          )}
        </div>
      ) : (
        // Компактный режим со свернутыми группами
        <div className="space-y-1">
          {Array.from(selectedGroups).map(groupId => {
            const group = specGroups.find(g => g.id === groupId)
            if (!group) return null

            const groupCharacteristics = productCharacteristics.filter(char => char.group_id === groupId)
            const isCollapsed = collapsedGroups.has(groupId)

            return (
              <div key={`group-manage-${groupId}`} className="border border-gray-200 rounded">
                <div
                  className="flex items-center justify-between px-2 py-1 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                  onClick={() => toggleGroupCollapse(groupId)}
                >
                  <div className="flex items-center space-x-2">
                    <Package className="w-3 h-3 text-gray-500" />
                    <span className="text-xs font-medium">{group.name}</span>
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      {groupCharacteristics.length}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleConfigureGroup(group)
                      }}
                      className="p-0 h-5 w-5"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="px-2 py-1 space-y-1">
                    {groupCharacteristics.map((char, index) => (
                      <div key={`manage-char-${char.id || index}`} className="flex items-center space-x-2 py-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1 mb-1">
                            <span className="text-xs font-medium text-gray-900 truncate">{char.label}</span>
                            {char.is_primary && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">О</span>
                            )}
                            {char.is_required && (
                              <span className="text-xs bg-red-100 text-red-800 px-1 rounded">*</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            {char.characteristic_type === 'text' && (
                              <Input
                                value={char.value_text || ''}
                                onChange={(e) =>
                                  handleUpdateCharacteristic(char.id!, { value_text: e.target.value })
                                }
                                className="h-6 text-xs flex-1"
                              />
                            )}
                            {char.characteristic_type === 'numeric' && (
                              <Input
                                type="number"
                                value={char.value_numeric || ''}
                                onChange={(e) =>
                                  handleUpdateCharacteristic(char.id!, { value_numeric: Number(e.target.value) })
                                }
                                className="h-6 text-xs flex-1"
                              />
                            )}
                            {char.characteristic_type === 'select' && (
                              <SearchableSelect
                                options={(specGroups.find(g => g.id === char.group_id)?.enums || []).map(ev => ({ value: ev.id, label: ev.value }))}
                                value={char.selected_enum_id || ''}
                                onValueChange={(val) => handleUpdateCharacteristic(char.id!, { selected_enum_id: Number(val) })}
                                placeholder="Выберите"/>
                            )}
                            {char.characteristic_type === 'boolean' && (
                              <div className="flex items-center space-x-1">
                                <Switch
                                  checked={char.value_text === 'true'}
                                  onCheckedChange={(checked) =>
                                    handleUpdateCharacteristic(char.id!, { value_text: checked ? 'true' : 'false' })
                                  }
                                  className="scale-75"
                                />
                                <span className="text-xs">{char.value_text === 'true' ? 'Да' : 'Нет'}</span>
                              </div>
                            )}
                            {char.characteristic_type === 'color' && (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="color"
                                  value={char.value_color || '#000000'}
                                  onChange={(e) =>
                                    handleUpdateCharacteristic(char.id!, { value_color: e.target.value })
                                  }
                                  className="w-6 h-6 border border-gray-300 rounded cursor-pointer"
                                  title="Выбрать цвет"
                                />
                                <Input
                                  value={char.value_color || ''}
                                  onChange={(e) =>
                                    handleUpdateCharacteristic(char.id!, { value_color: e.target.value })
                                  }
                                  placeholder="#FF5733"
                                  className="h-6 text-xs flex-1"
                                />
                                <div
                                  className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                                  style={{
                                    background: char.value_color || '#E5E7EB',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                  }}
                                  title={`Цвет: ${char.value_color || 'не выбран'}`}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Switch
                            checked={char.is_primary}
                            onCheckedChange={(checked) =>
                              handleUpdateCharacteristic(char.id!, { is_primary: checked })
                            }
                            className="scale-75"
                          />
                          <Switch
                            checked={char.is_required}
                            onCheckedChange={(checked) =>
                              handleUpdateCharacteristic(char.id!, { is_required: checked })
                            }
                            className="scale-75"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCharacteristic(char.id!)}
                            className="p-0 h-5 w-5"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {groupCharacteristics.length === 0 && (
                      <div className="text-center py-1 text-gray-500">
                        <p className="text-xs">Нет характеристик</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {productCharacteristics.length === 0 && (
            <div className="text-center py-4 border rounded-lg">
              <Target className="w-6 h-6 mx-auto text-gray-400 mb-2" />
              <h3 className="text-sm font-medium mb-1">Нет характеристик</h3>
              <p className="text-xs text-gray-600 mb-2">Начните с выбора групп характеристик</p>
              <Button
                type="button"
                size="sm"
                onClick={() => setActiveStep('groups')}
              >
                Выбрать группы
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderTemplateDialog = () => (
    <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Шаблоны характеристик</DialogTitle>
          <DialogDescription>
            Используйте готовые шаблоны или сохраните текущую конфигурацию для повторного использования
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="use">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="use">Использовать</TabsTrigger>
            <TabsTrigger value="save">Сохранить</TabsTrigger>
          </TabsList>

          <TabsContent value="use" className="space-y-4">
            <div className="space-y-2">
              {templates.map((template, index) => (
                <Card key={`template-${template.id || index}`} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Archive className="w-5 h-5 text-gray-500" />
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        {template.is_favorite && (
                          <Star className="w-4 h-4 text-gray-500 fill-current" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            // Apply template (replace) button clicked
                            handleApplyTemplate(template, 'replace');
                          }}
                        >
                          Заменить
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => {
                            // Apply template (merge) button clicked
                            handleApplyTemplate(template, 'merge');
                          }}
                        >
                          Добавить
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Удалить шаблон "${template.name}"?`)) {
                              handleDeleteTemplate(template.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>

                    {/* Показываем группы характеристик в шаблоне */}
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">Группы:</div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(template.characteristics.map(char => char.group_name))).map((groupName, index) => (
                          <Badge key={`template-group-${index}`} variant="outline" className="text-xs">
                            {groupName}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {template.characteristics.length} характеристик
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(template.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {templates.length === 0 && (
                <div className="text-center py-8">
                  <Archive className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Нет сохранённых шаблонов</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Создайте характеристики и сохраните их как шаблон для повторного использования
                  </p>
                  {process.env.NODE_ENV === 'development' && (
                    <div className="flex gap-2 mt-4 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Templates loading...
                          loadTemplates();
                        }}
                      >
                        Перезагрузить шаблоны
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {

                            const res = await fetch('/api/form-templates/test', { method: 'POST' });
                            const result = await res.json();
                            if (result.success) {
                              toast.success('Тестовый шаблон создан');
                              loadTemplates();
                            } else {
                              toast.error('Ошибка создания тестового шаблона');
                              // Test template creation failed
                            }
                          } catch (error) {
                            console.error('❌ Error creating test template:', error);
                            toast.error('Ошибка создания тестового шаблона');
                          }
                        }}
                      >
                        Создать тестовый шаблон
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="save" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Название шаблона</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Введите название шаблона"
                />
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Описание шаблона"
                  rows={3}
                />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Характеристики для сохранения:</h4>
                <div className="space-y-1">
                  {productCharacteristics.map((char, index) => (
                    <div key={`template-char-${char.id || index}`} className="flex items-center space-x-2 text-sm">
                      <Badge variant="outline" className="text-xs">{char.group_name}</Badge>
                      <span>{char.label}</span>
                    </div>
                  ))}
                </div>
                {productCharacteristics.length === 0 && (
                  <p className="text-sm text-gray-500">Нет характеристик для сохранения</p>
                )}
              </div>
              <Button
                type="button"
                onClick={handleSaveTemplate}
                disabled={saving || productCharacteristics.length === 0}
                className="w-full"
              >
                {saving ? 'Сохранение...' : 'Сохранить шаблон'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )

  const renderGroupConfigDialog = () => (
    <Dialog open={isGroupConfigDialogOpen} onOpenChange={setIsGroupConfigDialogOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5" />
            <span>Настройка группы: {configuringGroup?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Выберите характеристики для товара из доступных в группе. Вы можете включить/выключить нужные характеристики и создать новые.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Доступные характеристики группы */}
          {configuringGroup?.enum_values && configuringGroup.enum_values.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">Доступные характеристики</h4>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Включить все характеристики
                      configuringGroup.enum_values?.forEach(enumValue => {
                        const existingChar = productCharacteristics.find(char =>
                          char.group_id === Number(configuringGroup.id) &&
                          char.selected_enum_id === enumValue.id
                        )
                        if (!existingChar) {
                          handleAddEnumCharacteristic(enumValue)
                        }
                      })
                    }}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Все
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Убрать все характеристики этой группы
                      const toRemove = productCharacteristics.filter(char =>
                        char.group_id === Number(configuringGroup.id)
                      )
                      toRemove.forEach(char => {
                        if (char.id) handleDeleteCharacteristic(char.id)
                      })
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Очистить
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto border rounded-lg p-4">
                {configuringGroup.enum_values.map((enumValue) => {
                  const isSelected = productCharacteristics.some(char =>
                    char.group_id === Number(configuringGroup.id) &&
                    char.selected_enum_id === enumValue.id
                  )

                  return (
                    <div
                      key={enumValue.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          // Удалить характеристику
                          const charToRemove = productCharacteristics.find(char =>
                            char.group_id === Number(configuringGroup.id) &&
                            char.selected_enum_id === enumValue.id
                          )
                          if (charToRemove?.id) {
                            handleDeleteCharacteristic(charToRemove.id)
                          }
                        } else {
                          // Добавить характеристику
                          handleAddEnumCharacteristic(enumValue)
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 border-2 rounded ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        } flex items-center justify-center`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {enumValue.value}
                          </p>
                          {enumValue.display_name && enumValue.display_name !== enumValue.value && (
                            <p className="text-xs text-gray-500 truncate">
                              {enumValue.display_name}
                            </p>
                          )}
                        </div>
                        {enumValue.color_value && (
                          <div
                            className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                            style={{ background: getColorForValue(enumValue.value) }}
                            title={`Цвет: ${enumValue.color_value}`}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300"/>
              <div className="text-lg font-medium mb-2">Нет доступных характеристик</div>
              <div className="text-sm mb-4">В этой группе пока нет настроенных характеристик</div>
            </div>
          )}

          {/* Создание новой характеристики */}
          <div className="border-t pt-6">
            <h4 className="font-medium text-gray-900 mb-4">Создать новую характеристику</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                 <Label>Тип характеристики</Label>
                 <Select
                   value={characteristicForm.type}
                   onValueChange={(value: 'text' | 'numeric' | 'select' | 'boolean' | 'color') =>
                     setCharacteristicForm(prev => ({ ...prev, type: value }))
                   }
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="text">Текст</SelectItem>
                     <SelectItem value="numeric">Число</SelectItem>
                     <SelectItem value="boolean">Да/Нет</SelectItem>
                     <SelectItem value="color">Цвет</SelectItem>
                   </SelectContent>
                 </Select>
               </div>

              <div>
                <Label>Название характеристики</Label>
                <Input
                  value={characteristicForm.label}
                  onChange={(e) => setCharacteristicForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Введите название"
                />
              </div>

              {characteristicForm.type === 'text' && (
                <div>
                  <Label>Значение по умолчанию</Label>
                  <Input
                    value={characteristicForm.value_text}
                    onChange={(e) => setCharacteristicForm(prev => ({ ...prev, value_text: e.target.value }))}
                    placeholder="Введите значение"
                  />
                </div>
              )}

                             {characteristicForm.type === 'numeric' && (
                 <div>
                   <Label>Числовое значение</Label>
                   <Input
                     type="number"
                     value={characteristicForm.value_numeric || ''}
                     onChange={(e) => setCharacteristicForm(prev => ({ ...prev, value_numeric: Number(e.target.value) }))}
                     placeholder="Введите число"
                   />
                 </div>
               )}

               {characteristicForm.type === 'color' && (
                 <div>
                   <Label>Цвет</Label>
                   <div className="flex gap-3 items-center">
                     <div className="flex-1">
                       <Input
                         value={characteristicForm.value_color}
                         onChange={(e) => setCharacteristicForm(prev => ({ ...prev, value_color: e.target.value }))}
                         placeholder="#FF5733, rgba(255,87,51,0.8), rgb(255,87,51)"
                       />
                       <p className="text-xs text-gray-500 mt-1">
                         Введите HEX (#FF5733), RGB/RGBA или названия цветов
                       </p>
                     </div>
                     <input
                       type="color"
                       value={characteristicForm.value_color.startsWith('#') ? characteristicForm.value_color : '#000000'}
                       onChange={(e) => setCharacteristicForm(prev => ({ ...prev, value_color: e.target.value }))}
                       className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                       title="Выбрать цвет"
                     />
                     <div
                       className="w-10 h-10 rounded border-2 border-gray-300 flex-shrink-0"
                       style={{
                         background: characteristicForm.value_color || '#E5E7EB',
                         boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                       }}
                       title="Предпросмотр цвета"
                     />
                   </div>
                 </div>
               )}

              <div className="md:col-span-2 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={characteristicForm.is_required}
                    onCheckedChange={(checked) => setCharacteristicForm(prev => ({ ...prev, is_required: checked }))}
                  />
                  <Label>Обязательная</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={characteristicForm.is_primary}
                    onCheckedChange={(checked) => setCharacteristicForm(prev => ({ ...prev, is_primary: checked }))}
                  />
                  <Label>Основная</Label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => handleAddCharacteristic(e)}
                  disabled={!characteristicForm.label}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Создать
                </Button>
              </div>
            </div>
          </div>

          {/* Выбранные характеристики */}
          {productCharacteristics.filter(char => char.group_id === Number(configuringGroup?.id)).length > 0 && (
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-900 mb-4">
                Выбранные характеристики ({productCharacteristics.filter(char => char.group_id === Number(configuringGroup?.id)).length})
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {productCharacteristics
                  .filter(char => char.group_id === Number(configuringGroup?.id))
                  .map((char, index) => (
                    <div key={`selected-char-${char.id || index}`} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded text-sm">
                      <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="font-medium">{char.label}</span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          {char.characteristic_type}
                        </Badge>
                        {char.selected_enum_value && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                            {char.selected_enum_value}
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => char.id && handleDeleteCharacteristic(char.id)}
                        className="p-1 h-6 w-6"
                      >
                        <X className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsGroupConfigDialogOpen(false)}
          >
            Готово
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  function startEditLabel(char: ProductCharacteristic) {
    setEditingLabelId(char.id || '')
    setEditingLabelValue(char.label)
  }

  function commitEditLabel() {
    if (!editingLabelId) return
    handleUpdateCharacteristic(editingLabelId, { label: editingLabelValue })
    setEditingLabelId(null)
    setEditingLabelValue('')
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка характеристик...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Отладочная информация
  if (process.env.NODE_ENV === 'development') {
    // Current component state logged
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Характеристики товара</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderStepIndicator()}

        {activeStep === 'groups' && renderGroupsStep()}
        {activeStep === 'configure' && renderConfigureStep()}
        {activeStep === 'manage' && renderManageStep()}

        {renderTemplateDialog()}
        {renderGroupConfigDialog()}
      </CardContent>
    </Card>
  )
}