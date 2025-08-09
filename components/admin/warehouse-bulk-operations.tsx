"use client"

import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  X,
  Edit,
  Filter,
  CheckSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Package,
  Warehouse,
  MapPin,
  Building2,
  Grid3x3
} from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

// Интерфейсы
interface BulkItem {
  id: string
  type: 'region' | 'city' | 'warehouse' | 'zone' | 'section' | 'inventory'
  name: string
  code?: string
  status: 'active' | 'inactive' | 'low_stock' | 'out_of_stock' | 'discontinued' | 'maintenance'
  parent?: string
  children_count?: number
  metrics?: {
    capacity?: number
    used?: number
    items_count?: number
  }
  can_edit: boolean
  can_delete: boolean
}

interface BulkOperation {
  id: string
  type: 'edit' | 'delete' | 'move' | 'copy' | 'status_change' | 'export'
  label: string
  icon: React.ReactNode
  color: 'default' | 'destructive' | 'secondary'
  confirmationRequired: boolean
}

interface BulkOperationProgress {
  total: number
  completed: number
  failed: number
  current_item?: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused'
  errors: Array<{
    item_id: string
    item_name: string
    error: string
  }>
}

interface WarehouseBulkOperationsProps {
  items: BulkItem[]
  operations: BulkOperation[]
  onBulkOperation: (operation: string, items: string[], params?: any) => Promise<any>
  onItemUpdate: (items: BulkItem[]) => void
  loading?: boolean
}

export const WarehouseBulkOperations: React.FC<WarehouseBulkOperationsProps> = ({
  items,
  operations,
  onBulkOperation,
  onItemUpdate,
  loading = false
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['region', 'city', 'warehouse', 'zone', 'section']))
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<{
    operation: BulkOperation
    params?: any
  } | null>(null)
  const [operationProgress, setOperationProgress] = useState<BulkOperationProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    status: 'idle',
    errors: []
  })
  const [showProgressDialog, setShowProgressDialog] = useState(false)
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false)
  const [bulkEditForm, setBulkEditForm] = useState({
    status: '',
    description: '',
    notes: ''
  })
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false)

  // Фильтрация элементов
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Фильтр по поиску
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!item.name.toLowerCase().includes(query) &&
            !item.code?.toLowerCase().includes(query)) {
          return false
        }
      }

      // Фильтр по типам (множественный выбор)
      if (selectedTypes.size > 0 && !selectedTypes.has(item.type)) {
        return false
      }

      // Фильтр по статусу
      if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false
      }

      return true
    })
  }, [items, searchQuery, selectedTypes, filterStatus])

  // Функции для работы с фильтрами типов
  const toggleTypeFilter = useCallback((type: string) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }, [])

  const selectAllTypes = useCallback(() => {
    setSelectedTypes(new Set(['region', 'city', 'warehouse', 'zone', 'section']))
  }, [])

  const clearAllTypes = useCallback(() => {
    setSelectedTypes(new Set())
  }, [])

  // Функции для работы с выбором
  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedItems(new Set(filteredItems.map(item => item.id)))
  }, [filteredItems])

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  const isAllSelected = useMemo(() => {
    return filteredItems.length > 0 && filteredItems.every(item => selectedItems.has(item.id))
  }, [filteredItems, selectedItems])

  const isPartiallySelected = useMemo(() => {
    return selectedItems.size > 0 && !isAllSelected
  }, [selectedItems.size, isAllSelected])

  // Получение иконки по типу
  const getTypeIcon = (type: string) => {
    const iconProps = { className: "w-4 h-4" }
    switch (type) {
      case 'region': return <MapPin {...iconProps} />
      case 'city': return <Building2 {...iconProps} />
      case 'warehouse': return <Warehouse {...iconProps} />
      case 'zone': return <Package {...iconProps} />
      case 'section': return <Grid3x3 {...iconProps} />
      default: return <Package {...iconProps} />
    }
  }

  // Получение названия типа
  const getTypeLabel = (type: string) => {
    const labels = {
      region: 'Регион',
      city: 'Город',
      warehouse: 'Склад',
      zone: 'Зона',
      section: 'Секция'
    }
    return labels[type as keyof typeof labels] || type
  }

  // Получение доступных статусов для типа объекта
  const getAvailableStatuses = (type: string) => {
    switch (type) {
      case 'inventory':
        return [
          { value: 'active', label: 'Активен', color: 'bg-green-100 text-green-800' },
          { value: 'low_stock', label: 'Мало на складе', color: 'bg-yellow-100 text-yellow-800' },
          { value: 'out_of_stock', label: 'Нет в наличии', color: 'bg-red-100 text-red-800' },
          { value: 'discontinued', label: 'Снят с производства', color: 'bg-gray-100 text-gray-800' }
        ]
      case 'region':
      case 'city':
      case 'warehouse':
      case 'zone':
      case 'section':
        return [
          { value: 'active', label: 'Активен', color: 'bg-green-100 text-green-800' },
          { value: 'inactive', label: 'Неактивен', color: 'bg-gray-100 text-gray-800' },
          { value: 'maintenance', label: 'Обслуживание', color: 'bg-yellow-100 text-yellow-800' }
        ]
      default:
        return [
          { value: 'active', label: 'Активен', color: 'bg-green-100 text-green-800' },
          { value: 'inactive', label: 'Неактивен', color: 'bg-gray-100 text-gray-800' }
        ]
    }
  }

  // Получение отображаемого статуса
  const getStatusDisplay = (status: string, type: string) => {
    const statuses = getAvailableStatuses(type)
    const statusInfo = statuses.find(s => s.value === status)
    return statusInfo || { value: status, label: status, color: 'bg-gray-100 text-gray-800' }
  }

  // Группировка выбранных элементов по типам
  const groupSelectedByType = () => {
    const groups: Record<string, string[]> = {}
    selectedItems.forEach(itemId => {
      const item = items.find(i => i.id === itemId)
      if (item) {
        if (!groups[item.type]) groups[item.type] = []
        groups[item.type].push(itemId)
      }
    })
    return groups
  }

  // Выполнение массовой операции
  const executeBulkOperation = async (operation: BulkOperation, params?: any) => {
    if (selectedItems.size === 0) return

    const selectedItemsArray = Array.from(selectedItems)

    if (operation.confirmationRequired) {
      setPendingOperation({ operation, params })
      setShowConfirmDialog(true)
      return
    }

    await performBulkOperation(operation, selectedItemsArray, params)
  }

  const performBulkOperation = async (operation: BulkOperation, itemIds: string[], params?: any) => {
    setOperationProgress({
      total: itemIds.length,
      completed: 0,
      failed: 0,
      status: 'running',
      errors: [],
      current_item: 'Подготовка к выполнению...'
    })
    setShowProgressDialog(true)

    try {
      // Выполняем операцию через родительский компонент
      const results = await onBulkOperation(operation.type, itemIds, params)

      // Обрабатываем результаты если они переданы
      if (Array.isArray(results)) {
        const successful = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length
        const errors = results
          .filter(r => !r.success)
          .map(r => ({
            item_id: r.itemId || '',
            item_name: r.itemId ? getItemNameById(r.itemId) : 'Неизвестный элемент',
            error: r.error || 'Неизвестная ошибка'
          }))

        setOperationProgress({
          total: itemIds.length,
          completed: successful,
          failed: failed,
          status: failed > 0 ? 'failed' : 'completed',
          errors: errors
        })
      } else {
        // Если результаты не переданы - считаем операцию успешной
        setOperationProgress({
          total: itemIds.length,
          completed: itemIds.length,
          failed: 0,
          status: 'completed',
          errors: []
        })
      }

      clearSelection()
    } catch (error) {
      setOperationProgress({
        total: itemIds.length,
        completed: 0,
        failed: itemIds.length,
        status: 'failed',
        errors: [{
          item_id: '',
          item_name: 'Общая ошибка',
          error: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }]
      })
    }
  }

  // Вспомогательная функция для получения названия элемента по ID
  const getItemNameById = (itemId: string): string => {
    const item = items.find(i => i.id === itemId)
    return item ? item.name : itemId
  }

  // Компонент элемента списка
  const BulkItemRow: React.FC<{ item: BulkItem }> = ({ item }) => {
    const isSelected = selectedItems.has(item.id)

    return (
      <div
        className={`
          flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer
          ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
        `}
        onClick={() => toggleItemSelection(item.id)}
      >
        <Checkbox
          checked={isSelected}
          onChange={() => toggleItemSelection(item.id)}
          onClick={(e) => e.stopPropagation()}
        />

        <div className="flex items-center gap-2">
          {getTypeIcon(item.type)}
          <Badge variant="outline" className="text-xs">
            {getTypeLabel(item.type)}
          </Badge>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {item.code && (
              <Badge variant="secondary" className="text-xs">
                {item.code}
              </Badge>
            )}
          </div>

          {item.metrics && (
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {item.metrics.capacity && (
                <span>Вместимость: {item.metrics.capacity} м³</span>
              )}
              {item.metrics.items_count && (
                <span>Товаров: {item.metrics.items_count}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={item.status === 'active' ? 'default' :
                    item.status === 'low_stock' ? 'secondary' :
                    item.status === 'out_of_stock' ? 'destructive' :
                    item.status === 'discontinued' ? 'outline' : 'secondary'}
            className="text-xs"
          >
            {getStatusDisplay(item.status, item.type).label}
          </Badge>

          {item.children_count && item.children_count > 0 && (
            <Badge variant="outline" className="text-xs">
              {item.children_count} дочерних
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!item.can_edit && (
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Нельзя редактировать</p>
              </TooltipContent>
            </Tooltip>
          )}
          {!item.can_delete && (
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Нельзя удалить</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    )
  }

  // Диалог прогресса операции
  const ProgressDialog: React.FC = () => (
    <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {operationProgress.status === 'running' && <Clock className="w-5 h-5 animate-pulse" />}
            {operationProgress.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {operationProgress.status === 'failed' && <AlertTriangle className="w-5 h-5 text-red-600" />}
            Выполнение операции
          </DialogTitle>
          <DialogDescription>
            Отслеживание прогресса выполнения массовой операции над выбранными элементами складской системы.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Прогресс</span>
              <span>{operationProgress.completed} из {operationProgress.total}</span>
            </div>
            <Progress
              value={(operationProgress.completed / operationProgress.total) * 100}
              className="h-2"
            />
          </div>

          {operationProgress.current_item && (
            <p className="text-sm text-gray-600">
              Обрабатывается: {operationProgress.current_item}
            </p>
          )}

          {operationProgress.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-600">Ошибки:</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {operationProgress.errors.map((error, index) => (
                  <div key={index} className="text-xs p-2 bg-red-50 rounded border border-red-200">
                    <p className="font-medium">{error.item_name}</p>
                    <p className="text-red-600">{error.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {operationProgress.status === 'completed' || operationProgress.status === 'failed' ? (
            <Button onClick={() => setShowProgressDialog(false)}>
              Закрыть
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setShowProgressDialog(false)}>
              Скрыть
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // Диалог массового редактирования
  const BulkEditDialog: React.FC = () => {
    const [selectedStatus, setSelectedStatus] = useState<string>("")
    const [description, setDescription] = useState("")

    // Определяем, какие типы объектов выбраны
    const selectedTypes = Array.from(new Set(
      Array.from(selectedItems).map(itemId => {
        const item = items.find(i => i.id === itemId)
        return item?.type || ''
      }).filter(Boolean)
    ))

    // Определяем доступные статусы (пересечение всех типов)
    const getCommonStatuses = () => {
      if (selectedTypes.length === 0) return []

      const allStatuses = selectedTypes.map(type => getAvailableStatuses(type))
      const commonValues = allStatuses[0].filter(status =>
        allStatuses.every(typeStatuses =>
          typeStatuses.some(s => s.value === status.value)
        )
      )

      return commonValues
    }

    const commonStatuses = getCommonStatuses()

    const handleSave = () => {
      const updates: any = {}

      if (selectedStatus && selectedStatus !== "no_change") {
        updates.status = selectedStatus
      }

      if (description.trim()) {
        updates.description = description.trim()
      }

      if (Object.keys(updates).length === 0) {
        toast.error("Выберите хотя бы одно поле для изменения")
        return
      }

      executeBulkOperation(
        operations.find(op => op.type === 'edit')!,
        updates
      )

      setShowBulkEditDialog(false)
      setSelectedStatus("")
      setDescription("")
    }

    return (
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Массовое редактирование</DialogTitle>
            <DialogDescription>
              Измените свойства для {selectedItems.size} выбранных элементов.
              Пустые поля останутся без изменений.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Статус */}
            {commonStatuses.length > 0 && (
              <div className="space-y-2">
                <Label>Статус</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите статус..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_change">Не изменять</SelectItem>
                    {commonStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${status.color.split(' ')[0]}`} />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Описание */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                placeholder="Новое описание (оставьте пустым, чтобы не изменять)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Информация о выбранных типах */}
            {selectedTypes.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-1">
                  Выбранные типы объектов:
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedTypes.map(type => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {getTypeLabel(type)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkEditDialog(false)}
            >
              Отмена
            </Button>
            <Button onClick={handleSave}>
              Применить изменения
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Диалог изменения статуса
  const StatusChangeDialog: React.FC = () => {
    const [newStatus, setNewStatus] = useState<string>("")

    // Определяем, какие типы объектов выбраны
    const selectedTypes = Array.from(new Set(
      Array.from(selectedItems).map(itemId => {
        const item = items.find(i => i.id === itemId)
        return item?.type || ''
      }).filter(Boolean)
    ))

    // Определяем доступные статусы для выбранных типов
    const getAvailableStatusesForSelection = () => {
      if (selectedTypes.length === 0) return []

      // Если выбраны объекты разных типов, показываем общие статусы
      if (selectedTypes.length === 1) {
        return getAvailableStatuses(selectedTypes[0])
      } else {
        // Пересечение статусов разных типов
        const allStatuses = selectedTypes.map(type => getAvailableStatuses(type))
        return allStatuses[0].filter(status =>
          allStatuses.every(typeStatuses =>
            typeStatuses.some(s => s.value === status.value)
          )
        )
      }
    }

    const availableStatuses = getAvailableStatusesForSelection()

    const handleStatusChange = () => {
      if (!newStatus) {
        toast.error("Выберите новый статус")
        return
      }

      executeBulkOperation(
        operations.find(op => op.type === 'status_change')!,
        { status: newStatus }
      )

      setShowStatusChangeDialog(false)
      setNewStatus("")
    }

    return (
      <Dialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить статус</DialogTitle>
            <DialogDescription>
              Измените статус для {selectedItems.size} выбранных элементов.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Новый статус</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите статус..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${status.color.split(' ')[0]}`} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Информация о выбранных типах */}
            {selectedTypes.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-1">
                  Выбранные типы объектов:
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedTypes.map(type => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {getTypeLabel(type)}
                    </Badge>
                  ))}
                </div>
                {selectedTypes.length > 1 && (
                  <div className="text-xs text-blue-700 mt-1">
                    Доступны только общие статусы для всех типов
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStatusChangeDialog(false)}
            >
              Отмена
            </Button>
            <Button onClick={handleStatusChange}>
              Изменить статус
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-6">
      {/* Панель фильтров и поиска */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Основная строка поиска и быстрых фильтров */}
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Поиск по названию или коду..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="active">Активные</SelectItem>
                  <SelectItem value="inactive">Неактивные</SelectItem>
                  <SelectItem value="maintenance">Обслуживание</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Типы объектов
                <Badge variant="secondary" className="ml-1">
                  {selectedTypes.size}
                </Badge>
              </Button>
            </div>

            {/* Расширенные фильтры типов */}
            {showAdvancedFilters && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">Типы объектов для отображения:</Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllTypes}>
                      Выбрать все
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAllTypes}>
                      Очистить
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { type: 'region', label: 'Регионы', icon: <MapPin className="w-4 h-4" />, color: 'text-blue-600' },
                    { type: 'city', label: 'Города', icon: <Building2 className="w-4 h-4" />, color: 'text-green-600' },
                    { type: 'warehouse', label: 'Склады', icon: <Warehouse className="w-4 h-4" />, color: 'text-purple-600' },
                    { type: 'zone', label: 'Зоны', icon: <Package className="w-4 h-4" />, color: 'text-orange-600' },
                    { type: 'section', label: 'Секции', icon: <Grid3x3 className="w-4 h-4" />, color: 'text-indigo-600' }
                  ].map(({ type, label, icon, color }) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filter-${type}`}
                        checked={selectedTypes.has(type)}
                        onCheckedChange={() => toggleTypeFilter(type)}
                      />
                      <label
                        htmlFor={`filter-${type}`}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <span className={color}>{icon}</span>
                        {label}
                      </label>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-gray-600">
                  Выберите типы объектов, которые должны отображаться в списке массовых операций
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Панель массовых действий */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Массовые операции
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                Выбрано: {selectedItems.size} из {filteredItems.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isAllSelected ? clearSelection : selectAll}
                >
                  {isAllSelected ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
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
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Кнопки массовых операций */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkEditDialog(true)}
              disabled={selectedItems.size === 0}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Редактировать
            </Button>

            {operations.map(operation => (
              <Button
                key={operation.id}
                variant={operation.color === 'destructive' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => executeBulkOperation(operation)}
                disabled={selectedItems.size === 0}
              >
                {operation.icon}
                <span className="ml-2">
                  {operation.label} ({selectedItems.size})
                </span>
              </Button>
            ))}
          </div>

          {/* Список элементов */}
          <div className="border rounded-lg">
            <div className="flex items-center gap-3 p-3 border-b border-gray-200 bg-gray-50">
              <Checkbox
                checked={isAllSelected}
                onChange={isAllSelected ? clearSelection : selectAll}
              />
              <span className="text-sm font-medium">Название</span>
              <div className="flex-1" />
              <span className="text-sm font-medium">Статус</span>
            </div>

            <ScrollArea className="max-h-96">
              <div className="space-y-1 p-2">
                {filteredItems.map(item => (
                  <BulkItemRow key={item.id} item={item} />
                ))}

                {filteredItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Нет элементов для отображения</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Диалоги */}
      <ProgressDialog />
      <BulkEditDialog />
      <StatusChangeDialog />

      {/* Диалог подтверждения */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение операции</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите выполнить операцию &quot;{pendingOperation?.operation.label}&quot;
              для {selectedItems.size} элементов?
              {pendingOperation?.operation.type === 'delete' && (
                <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-sm">
                  <strong>Внимание:</strong> Это действие нельзя отменить.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingOperation(null)}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingOperation) {
                  performBulkOperation(
                    pendingOperation.operation,
                    Array.from(selectedItems),
                    pendingOperation.params
                  )
                }
                setShowConfirmDialog(false)
                setPendingOperation(null)
              }}
            >
              Выполнить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}