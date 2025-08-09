'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Plus, CheckSquare, Square, Loader2, Database, ChevronDown, ChevronRight, Folder, FolderOpen, Package } from 'lucide-react'

// @ts-nocheck

interface SpecGroupItem {
  id: string
  name: string
  description?: string
  parent_id?: string | null
  level: number
  ordering: number
  source_type: string
  original_id: number
  enums: Array<{
    id: number
    value: string
    display_name: string
    color_hex?: string | null
    ordering: number
  }>
  children?: SpecGroupItem[]
  children_count: string
  has_children: boolean
}

interface SpecificationsTemplatesProps {
  productId: number
  onSpecificationsAdded: () => void
}

export function SpecificationsTemplates({ productId, onSpecificationsAdded }: SpecificationsTemplatesProps) {
  const [open, setOpen] = useState(false)
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [specGroups, setSpecGroups] = useState<SpecGroupItem[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Загрузка групп характеристик
  useEffect(() => {
    if (open) {
      loadSpecGroups()
    }
  }, [open])

  const loadSpecGroups = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/specifications?hierarchical=true')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setSpecGroups(data.data)
          // Автоматически раскрываем корневые группы для удобства
          const rootGroupIds = data.data.map((group: SpecGroupItem) => group.id)
          setExpandedGroups(new Set(rootGroupIds))
        }
      }
    } catch (error) {
      console.error('Error loading spec groups:', error)
      toast.error('Ошибка загрузки групп характеристик')
    } finally {
      setLoading(false)
    }
  }

  // Переключение выбора группы/подгруппы
  const toggleGroup = (groupId: string, includeChildren = false) => {
    const newSelected = new Set(selectedGroups)

    if (newSelected.has(groupId)) {
      newSelected.delete(groupId)

      // Также убираем всех детей
      if (includeChildren) {
        const removeChildren = (group: SpecGroupItem) => {
          if (group.children) {
            group.children.forEach(child => {
              newSelected.delete(child.id)
              removeChildren(child)
            })
          }
        }

        const findGroup = (groups: SpecGroupItem[], targetId: string): SpecGroupItem | null => {
          for (const group of groups) {
            if (group.id === targetId) return group
            if (group.children) {
              const found = findGroup(group.children, targetId)
              if (found) return found
            }
          }
          return null
        }

        const group = findGroup(specGroups, groupId)
        if (group) removeChildren(group)
      }
    } else {
      newSelected.add(groupId)
    }

    setSelectedGroups(newSelected)
  }

  // Переключение раскрытия группы
  const toggleExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  // Выбрать/снять все видимые группы
  const toggleSelectAll = () => {
    if (selectedGroups.size > 0) {
      setSelectedGroups(new Set())
    } else {
      // Выбираем все группы с enum'ами
      const allGroupsWithEnums = new Set<string>()

      const collectGroupsWithEnums = (groups: SpecGroupItem[]) => {
        groups.forEach(group => {
          if (group.enums && group.enums.length > 0) {
            allGroupsWithEnums.add(group.id)
          }
          if (group.children) {
            collectGroupsWithEnums(group.children)
          }
        })
      }

      collectGroupsWithEnums(specGroups)
      setSelectedGroups(allGroupsWithEnums)
    }
  }

  // Функция для добавления характеристики в товар
  const addSpec = async (productId: number, spec: any) => {
    const response = await fetch(`/api/products/${productId}/characteristics-simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ characteristics: [spec] }),
    })

    if (!response.ok) {
      throw new Error('Failed to add specification')
    }

    return response.json()
  }

  // Функция для массового добавления характеристик
  const addGroupSpecs = async (productId: number, specs: any[]) => {
    const response = await fetch(`/api/products/${productId}/characteristics-simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ characteristics: specs }),
    })

    if (!response.ok) {
      throw new Error('Failed to add group specifications')
    }

    return response.json()
  }

  // Добавление выбранных групп
  const handleAddSelected = async () => {
    if (selectedGroups.size === 0) {
      toast.error('Выберите группы характеристик для добавления')
      return
    }

    setAdding(true)
    let successCount = 0
    let errorCount = 0

    try {
      // Добавляем группы с их enum значениями
      const addGroupSpecs = async (group: SpecGroupItem) => {
        // Если у группы есть enums, добавляем их как характеристики
        if (group.enums && group.enums.length > 0) {
          for (const enumItem of group.enums) {
            try {
              const requestData = {
                productId: productId,
                specName: group.name,
                specValue: enumItem.display_name || enumItem.value,
                specType: 'enum',
                unit: null,
                numericValue: null,
                isPrimary: false,
                sortOrder: enumItem.ordering || 0
              }

              const response = await addSpec(productId, requestData)

              if (response.success) {
                successCount++
              } else {
                errorCount++
              }
            } catch (error) {
              errorCount++
            }
          }
        } else {
          // Если enum'ов нет, добавляем саму группу как характеристику
          try {
            const requestData = {
              productId: productId,
              specName: group.name,
              specValue: 'Да',
              specType: 'text',
              unit: null,
              numericValue: null,
              isPrimary: false,
              sortOrder: group.ordering || 0
            }

            const response = await addSpec(productId, requestData)

            if (response.success) {
              successCount++
            } else {
              errorCount++
            }
          } catch (error) {
            errorCount++
          }
        }
      }

      // Находим и обрабатываем выбранные группы
      const findAndProcessGroup = (groups: SpecGroupItem[], targetId: string): any => {
        for (const group of groups) {
          if (group.id === targetId) {
            return addGroupSpecs(group)
          }
          if (group.children) {
            const result: any = findAndProcessGroup(group.children, targetId)
            if (result) return result
          }
        }
        return null
      }

      for (const groupId of selectedGroups) {
        await findAndProcessGroup(specGroups, groupId)
      }

      if (successCount > 0) {
        toast.success(`Добавлено ${successCount} характеристик`)
        onSpecificationsAdded()
        setSelectedGroups(new Set())
        setOpen(false)
      }

      if (errorCount > 0) {
        toast.error(`Ошибка добавления ${errorCount} характеристик`)
      }

    } catch (error) {
      console.error('Error adding specifications:', error)
      toast.error('Ошибка добавления характеристик')
    } finally {
      setAdding(false)
    }
  }

  // Рендер группы характеристик
  const renderSpecGroup = (group: SpecGroupItem, level = 0) => {
    const isExpanded = expandedGroups.has(group.id)
    const isSelected = selectedGroups.has(group.id)
    const hasEnums = group.enums && group.enums.length > 0
    const hasChildren = group.children && group.children.length > 0

    return (
      <div key={group.id} className={`border rounded-lg ${level === 0 ? 'mb-3' : 'mb-2'}`}>
        <div className={`p-3 ${level === 0 ? 'bg-blue-50' : level === 1 ? 'bg-gray-50' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasChildren && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-6 w-6"
                  onClick={() => toggleExpanded(group.id)}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleGroup(group.id, true)}
                />

                {level === 0 ? (
                  <Folder className="w-4 h-4 text-blue-600" />
                ) : level === 1 ? (
                  <FolderOpen className="w-4 h-4 text-gray-600" />
                ) : (
                  <Package className="w-4 h-4 text-green-600" />
                )}

                <div>
                  <div className="font-medium">{group.name}</div>
                  {group.description && (
                    <div className="text-sm text-gray-500">{group.description}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {hasEnums && (
                <Badge variant="secondary" className="text-xs">
                  {group.enums.length} вариантов
                </Badge>
              )}
              {hasChildren && (
                <Badge variant="outline" className="text-xs">
                  {group.children_count} подгрупп
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Уровень {group.level}
              </Badge>
            </div>
          </div>

          {/* Показываем enum значения */}
          {hasEnums && isSelected && (
            <div className="mt-2 pt-2 border-t">
              <div className="text-sm text-gray-600 mb-1">Доступные значения:</div>
              <div className="flex flex-wrap gap-1">
                {group.enums.slice(0, 10).map(enumItem => (
                  <Badge key={enumItem.id} variant="outline" className="text-xs">
                    {enumItem.display_name || enumItem.value}
                  </Badge>
                ))}
                {group.enums.length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{group.enums.length - 10} еще
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Дочерние элементы */}
        {hasChildren && isExpanded && (
          <div className="pl-4 pb-2">
            {group.children!.map(child => renderSpecGroup(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // Подсчет групп с enum'ами для статистики
  const getGroupsWithEnumsCount = () => {
    let count = 0
    const countGroupsWithEnums = (groups: SpecGroupItem[]) => {
      groups.forEach(group => {
        if (group.enums && group.enums.length > 0) {
          count++
        }
        if (group.children) {
          countGroupsWithEnums(group.children)
        }
      })
    }
    countGroupsWithEnums(specGroups)
    return count
  }

  const totalSelected = selectedGroups.size
  const groupsWithEnums = getGroupsWithEnumsCount()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Database className="w-4 h-4 mr-2" />
          Группы характеристик
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Группы характеристик из каталога</DialogTitle>
          <DialogDescription>
            Выберите группы характеристик из структурированного каталога для быстрого добавления
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            Доступно {groupsWithEnums} групп с характеристиками
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            disabled={loading || groupsWithEnums === 0}
          >
            {selectedGroups.size > 0 ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Снять выбор
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4 mr-2" />
                Выбрать все
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Загрузка групп характеристик...</span>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            {specGroups.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Группы характеристик не найдены
              </div>
            ) : (
              <div className="space-y-2">
                {specGroups.map(group => renderSpecGroup(group))}
              </div>
            )}
          </ScrollArea>
        )}

        <Separator />

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Выбрано: {totalSelected} групп
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedGroups(new Set())}
              disabled={totalSelected === 0}
            >
              Очистить выбор
            </Button>
            <Button
              onClick={handleAddSelected}
              disabled={totalSelected === 0 || adding}
            >
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Добавление...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить выбранные ({totalSelected})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}