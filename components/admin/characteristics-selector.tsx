'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Plus, ChevronDown, ChevronRight, Folder, FolderOpen, Tag, Search, Loader2, Package, Check, X } from 'lucide-react'

// Интерфейсы для иерархической структуры
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

interface SelectedCharacteristic {
  groupId: number
  groupName: string
  enumValue?: SpecEnum
  customValue?: string
  type: 'group' | 'enum'
}

interface CharacteristicsSelectorProps {
  onCharacteristicsSelect: (characteristics: SelectedCharacteristic[]) => void
  selectedCharacteristics?: SelectedCharacteristic[]
}

const CharacteristicsSelectorComponent = ({
  onCharacteristicsSelect,
  selectedCharacteristics = []
}: CharacteristicsSelectorProps) => {
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<SpecGroup[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedEnums, setExpandedEnums] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [localSelected, setLocalSelected] = useState<SelectedCharacteristic[]>([])
  const initializedRef = useRef(false)

  // Загрузка иерархических данных
  const loadSpecGroups = useCallback(async () => {
    try {
      setLoading(true)

      const res = await fetch("/api/specifications")

      if (res.ok) {
        const apiResponse = await res.json()
        const data = apiResponse.data || apiResponse

        // Преобразуем иерархические данные
        const hierarchicalGroups = processHierarchicalGroups(data)

        setGroups(hierarchicalGroups)
      } else {
        throw new Error('Ошибка загрузки характеристик')
      }
    } catch (error) {
      console.error('Ошибка загрузки характеристик:', error)
      toast.error('Ошибка загрузки характеристик')
    } finally {
      setLoading(false)
    }
  }, [])

  // Обработка иерархических данных
  const processHierarchicalGroups = (groups: any[]): SpecGroup[] => {
    const processGroup = (group: any): SpecGroup => {
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        enum_count: group.enum_count || 0,
        enum_values: group.enum_values || group.enums || [],
        parent_id: group.parent_id,
        level: group.level || 0,
        children: group.children ? group.children.map(processGroup) : [],
        source_type: group.source_type || 'spec_group',
        original_id: group.original_id || group.id,
        enums: group.enums || [],
        ordering: group.ordering || 0
      }
    }

    return groups.map(processGroup)
  }

  // Инициализация при загрузке
  useEffect(() => {
    loadSpecGroups()

    // Инициализируем localSelected
    if (!initializedRef.current) {
      setLocalSelected(selectedCharacteristics ? [...selectedCharacteristics] : [])
      initializedRef.current = true
    }
  }, [loadSpecGroups])

  // Переключение раскрытия группы
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

  // Переключение раскрытия enum
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

  // Получение цвета для enum значения
  const getColorValue = (enumValue: SpecEnum): string => {
    if (enumValue.color_value) {
      return enumValue.color_value
    }

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

  // Проверка, выбрана ли характеристика
  const isCharacteristicSelected = (groupId: number, enumId?: number): boolean => {
    return localSelected.some(selected =>
      selected.groupId === groupId &&
      (enumId ? selected.enumValue?.id === enumId : !selected.enumValue)
    )
  }

  // Выбор/отмена выбора характеристики
  const toggleCharacteristicSelection = (group: SpecGroup, enumValue?: SpecEnum) => {
    const groupId = typeof group.id === 'string' ? parseInt(group.id.replace(/^\D+/,'') || '0') : group.id

    setLocalSelected(prev => {
      const newSelected = [...prev]

      // Проверяем, выбрана ли уже эта характеристика
      const existingIndex = newSelected.findIndex(selected =>
        selected.groupId === groupId &&
        (enumValue ? selected.enumValue?.id === enumValue.id : !selected.enumValue)
      )

      if (existingIndex >= 0) {
        // Убираем выбор
        newSelected.splice(existingIndex, 1)
      } else {
        // Добавляем выбор
        const characteristic: SelectedCharacteristic = {
          groupId,
          groupName: group.name,
          enumValue,
          type: enumValue ? 'enum' : 'group'
        }
        newSelected.push(characteristic)
      }

      return newSelected
    })
  }

  // Подсчет характеристик в группе
  const getTotalCharacteristicsCount = (group: SpecGroup): number => {
    let count = 0
    if (group.enum_values && group.enum_values.length > 0) {
      count += group.enum_values.length
    }
    if (group.children && group.children.length > 0) {
      count += group.children.reduce((sum, child) => sum + getTotalCharacteristicsCount(child), 0)
    }
    return count
  }

  // Рендер дерева групп
  const renderGroupTree = (groups: SpecGroup[], level = 0) => {
    return groups.map((group) => {
      const hasChildren = group.children && group.children.length > 0
      const hasEnums = group.enum_values && group.enum_values.length > 0
      const groupExpanded = expandedGroups.has(String(group.id))
      const totalCharacteristicsCount = getTotalCharacteristicsCount(group)
      const groupId = typeof group.id === 'string' ? parseInt(group.id.replace(/^\D+/,'') || '0') : group.id

      return (
        <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden mb-2" style={{ marginLeft: `${level * 20}px` }}>
          <div
            className="flex items-center gap-2 p-3 hover:bg-gray-50 cursor-pointer select-none transition-colors"
            onClick={() => (hasChildren || hasEnums) && toggleGroupExpansion(group.id)}
          >
            {/* Треугольник раскрытия */}
            <div className="flex items-center justify-center w-5 h-5">
              {(hasChildren || hasEnums) ? (
                groupExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-600"/>
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-600"/>
                )
              ) : (
                <span className="w-3 h-3"></span>
              )}
            </div>

            {/* Иконка уровня */}
            <div className="flex items-center justify-center w-4 h-4 text-gray-500">
              {level === 0 ? (
                groupExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
              ) : level === 1 ? (
                <Package className="w-4 h-4" />
              ) : (
                <Tag className="w-4 h-4" />
              )}
            </div>

            {/* Название группы */}
            <div className="flex-1">
              <span className="font-medium text-gray-900">{group.name}</span>
              {group.description && (
                <span className="ml-2 text-sm text-gray-500">— {group.description}</span>
              )}
            </div>

            {/* Счетчики и выбор */}
            <div className="flex items-center gap-2">
              {totalCharacteristicsCount > 0 && (
                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                  {totalCharacteristicsCount}
                </span>
              )}

              {/* Кнопка выбора группы целиком (если нет enum значений) */}
              {!hasEnums && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleCharacteristicSelection(group)
                  }}
                  className={`h-7 px-2 ${isCharacteristicSelected(groupId) ? 'bg-green-100 text-green-700' : ''}`}
                >
                  {isCharacteristicSelected(groupId) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>

          {/* Содержимое группы */}
          {groupExpanded && (
            <div className="border-t border-gray-100 bg-gray-50">
              {/* Подгруппы */}
              {hasChildren && (
                <div className="p-2">
                  {renderGroupTree(group.children!, level + 1)}
                </div>
              )}

              {/* Enum значения */}
              {hasEnums && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-700">Характеристики:</span>
                  </div>
                  {renderEnumTree(group.enum_values!, groupId)}
                </div>
              )}
            </div>
          )}
        </div>
      )
    })
  }

  // Рендер дерева enum значений
  const renderEnumTree = (enums: SpecEnum[], groupId: number) => {
    const rootEnums = enums.filter(e => !e.parent_id)
    const childEnums = enums.filter(e => e.parent_id)

    const childrenMap = new Map<number, SpecEnum[]>()
    childEnums.forEach(child => {
      if (!childrenMap.has(child.parent_id!)) {
        childrenMap.set(child.parent_id!, [])
      }
      childrenMap.get(child.parent_id!)!.push(child)
    })

    const renderEnumItem = (enumValue: SpecEnum, level = 0) => {
      const children = childrenMap.get(enumValue.id) || []
      const hasChildren = children.length > 0
      const isExpanded = expandedEnums.has(enumValue.id)
      const isSelected = isCharacteristicSelected(groupId, enumValue.id)

      return (
        <div key={enumValue.id}>
          <div
            className={`group flex items-center gap-3 py-2 px-3 bg-white rounded border border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-green-50 border-green-300' : ''}`}
            style={{ marginLeft: `${level * 20}px` }}
          >
            {/* Треугольник раскрытия */}
            <div className="flex items-center justify-center w-4 h-4">
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleEnumExpansion(enumValue.id)
                  }}
                  className="hover:bg-gray-200 rounded p-0.5"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-gray-500"/>
                  ) : (
                    <ChevronRight className="w-3 h-3 text-gray-500"/>
                  )}
                </button>
              ) : (
                <span className="w-3 h-3"></span>
              )}
            </div>

            {/* Иконка уровня */}
            <span className="text-sm">
              {level === 0 ? '🎯' : '↳'}
            </span>

            {/* Цвет (если есть) */}
            {enumValue.color_value && (
              <div
                className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: getColorValue(enumValue) }}
                title={`Цвет: ${enumValue.value}`}
              />
            )}

            {/* Название */}
            <div className="flex-1">
              <span className="font-medium text-gray-900">{enumValue.value}</span>
            </div>

            {/* Кнопка выбора */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                const group = groups.find(g =>
                  (typeof g.id === 'string' ? parseInt(g.id.replace(/^\D+/,'') || '0') : g.id) === groupId
                )
                if (group) {
                  toggleCharacteristicSelection(group, enumValue)
                }
              }}
              className={`h-6 w-6 p-0 ${isSelected ? 'bg-green-100 text-green-700' : ''}`}
            >
              {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </Button>
          </div>

          {/* Подзначения */}
          {hasChildren && isExpanded && (
            <div className="ml-4 mt-2 space-y-1">
              {children.map(child => renderEnumItem(child, level + 1))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {rootEnums.map(enumValue => renderEnumItem(enumValue))}
      </div>
    )
  }

  // Фильтрация групп по поиску
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups

    const term = searchTerm.toLowerCase().trim()
    const filterGroup = (group: SpecGroup): SpecGroup | null => {
      const matchesName = group.name.toLowerCase().includes(term)
      const matchesDescription = group.description && group.description.toLowerCase().includes(term)
      const matchesEnum = group.enum_values && group.enum_values.some(e => e.value.toLowerCase().includes(term))

      if (matchesName || matchesDescription || matchesEnum) {
        return group
      }

      if (group.children && group.children.length > 0) {
        const filteredChildren = group.children.map(filterGroup).filter(Boolean) as SpecGroup[]
        if (filteredChildren.length > 0) {
          return { ...group, children: filteredChildren }
        }
      }

      return null
    }

    return groups.map(filterGroup).filter(Boolean) as SpecGroup[]
  }, [groups, searchTerm])

  // Сохранение выбранных характеристик
  const handleSave = () => {
    onCharacteristicsSelect(localSelected)
    toast.success(`Выбрано ${localSelected.length} характеристик`)
  }

  // Очистка выбора
  const handleClear = () => {
    setLocalSelected([])
  }

  // Удаление отдельной характеристики
  const handleRemoveCharacteristic = (characteristicToRemove: SelectedCharacteristic) => {
    setLocalSelected(prev =>
      prev.filter(item =>
        !(item.groupId === characteristicToRemove.groupId &&
          (item.enumValue?.id || null) === (characteristicToRemove.enumValue?.id || null))
      )
    )
  }

  return (
    <div className="space-y-4">
      {/* Поиск */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Поиск характеристик..."
          className="pl-10"
        />
      </div>

      {/* Выбранные характеристики */}
      {localSelected.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-green-800 flex items-center justify-between">
              <span>Выбрано характеристик: {localSelected.length}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-green-600 hover:text-green-700"
              >
                <X className="w-4 h-4 mr-1" />
                Очистить
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {localSelected.map((selected, index) => {
              const uniqueKey = `${selected.groupId}-${selected.enumValue?.id || 'no-enum'}-${index}`
              return (
                <div key={uniqueKey} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                  <Tag className="w-4 h-4 text-green-600" />
                  <span className="font-medium">{selected.groupName}</span>
                  {selected.enumValue && (
                    <>
                      <span className="text-gray-500">→</span>
                      <span className="text-sm">{selected.enumValue.value}</span>
                      {selected.enumValue.color_value && (
                        <div
                          className="w-3 h-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: getColorValue(selected.enumValue) }}
                        />
                      )}
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCharacteristic(selected)}
                    className="ml-auto h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Дерево характеристик */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Загрузка характеристик...</span>
        </div>
      ) : (
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {filteredGroups.length > 0 ? (
              renderGroupTree(filteredGroups)
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>Характеристики не найдены</p>
                {searchTerm && (
                  <p className="text-sm">Попробуйте изменить поисковый запрос</p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Кнопки действий */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-gray-500">
          {localSelected.length > 0 && `Выбрано: ${localSelected.length}`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={localSelected.length === 0}
          >
            Очистить
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={localSelected.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            Применить выбор
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CharacteristicsSelectorComponent