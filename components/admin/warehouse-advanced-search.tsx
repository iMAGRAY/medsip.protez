"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Search,
  Filter,
  X,
  Calendar as CalendarIcon,
  Warehouse,
  TrendingUp,
  Clock,
  Save,
  Star,
  History,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// Интерфейсы
interface SearchFilter {
  id: string
  type: 'text' | 'select' | 'range' | 'date' | 'boolean'
  field: string
  label: string
  value: any
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
  placeholder?: string
}

interface SavedSearch {
  id: string
  name: string
  filters: SearchFilter[]
  created_at: string
  is_favorite: boolean
  usage_count: number
}

interface QuickFilter {
  id: string
  label: string
  icon: React.ReactNode
  filters: Partial<SearchFilter>[]
  count?: number
}

interface SearchSuggestion {
  id: string
  text: string
  type: 'recent' | 'popular' | 'suggestion'
  count?: number
}

interface WarehouseAdvancedSearchProps {
  onSearch: (filters: SearchFilter[]) => void
  onFiltersChange: (filters: SearchFilter[]) => void
  savedSearches?: SavedSearch[]
  onSaveSearch: (name: string, filters: SearchFilter[]) => void
  onLoadSearch: (searchId: string) => void
  onDeleteSearch: (searchId: string) => void
  loading?: boolean
  resultCount?: number
}

export const WarehouseAdvancedSearch: React.FC<WarehouseAdvancedSearchProps> = ({
  onSearch,
  onFiltersChange,
  savedSearches = [],
  onSaveSearch,
  onLoadSearch,
  onDeleteSearch,
  loading = false,
  resultCount = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')

  // Доступные фильтры
  const availableFilters: SearchFilter[] = [
    {
      id: 'type',
      type: 'select',
      field: 'type',
      label: 'Тип',
      value: 'all',
      options: [
        { value: 'all', label: 'Все типы' },
        { value: 'region', label: 'Регионы' },
        { value: 'city', label: 'Города' },
        { value: 'warehouse', label: 'Склады' },
        { value: 'zone', label: 'Зоны' },
        { value: 'section', label: 'Секции' }
      ]
    },
    {
      id: 'status',
      type: 'select',
      field: 'status',
      label: 'Статус',
      value: 'all',
      options: [
        { value: 'all', label: 'Все статусы' },
        { value: 'active', label: 'Активные' },
        { value: 'inactive', label: 'Неактивные' },
        { value: 'maintenance', label: 'Обслуживание' }
      ]
    },
    {
      id: 'capacity',
      type: 'range',
      field: 'capacity',
      label: 'Вместимость (м³)',
      value: [0, 10000],
      min: 0,
      max: 10000
    },
    {
      id: 'efficiency',
      type: 'range',
      field: 'efficiency',
      label: 'Эффективность (%)',
      value: [0, 100],
      min: 0,
      max: 100
    },
    {
      id: 'created_date',
      type: 'date',
      field: 'created_at',
      label: 'Дата создания',
      value: null
    },
    {
      id: 'has_alerts',
      type: 'boolean',
      field: 'has_alerts',
      label: 'Есть уведомления',
      value: false
    },
    {
      id: 'region',
      type: 'select',
      field: 'region_name',
      label: 'Регион',
      value: 'all',
      options: [
        { value: 'all', label: 'Все регионы' },
        { value: 'moscow', label: 'Московская область' },
        { value: 'spb', label: 'Санкт-Петербург' },
        { value: 'kzn', label: 'Казань' }
      ]
    }
  ]

  // Быстрые фильтры
  const quickFilters: QuickFilter[] = [
    {
      id: 'active_warehouses',
      label: 'Активные склады',
      icon: <Warehouse className="w-4 h-4" />,
      filters: [
        { id: 'type', value: 'warehouse' },
        { id: 'status', value: 'active' }
      ],
      count: 24
    },
    {
      id: 'high_efficiency',
      label: 'Высокая эффективность',
      icon: <TrendingUp className="w-4 h-4" />,
      filters: [
        { id: 'efficiency', value: [80, 100] }
      ],
      count: 12
    },
    {
      id: 'with_alerts',
      label: 'С уведомлениями',
      icon: <Clock className="w-4 h-4" />,
      filters: [
        { id: 'has_alerts', value: true }
      ],
      count: 5
    },
    {
      id: 'new_objects',
      label: 'Новые объекты',
      icon: <Star className="w-4 h-4" />,
      filters: [
        { id: 'created_date', value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      ],
      count: 8
    }
  ]

  // Предложения для поиска
  const searchSuggestions: SearchSuggestion[] = [
    { id: '1', text: 'склад москва', type: 'recent', count: 15 },
    { id: '2', text: 'активные регионы', type: 'popular', count: 23 },
    { id: '3', text: 'эффективность выше 80%', type: 'suggestion', count: 8 },
    { id: '4', text: 'зоны с низкой загрузкой', type: 'recent', count: 12 }
  ]

  // Обновление фильтра
  const updateFilter = useCallback((filterId: string, value: any) => {
    setActiveFilters(prev => {
      const existingIndex = prev.findIndex(f => f.id === filterId)
      const baseFilter = availableFilters.find(f => f.id === filterId)

      if (!baseFilter) return prev

      const updatedFilter = { ...baseFilter, value }

      if (existingIndex >= 0) {
        if (value === '' || value === 'all' || value === null || (Array.isArray(value) && value.length === 0) || value === false) {
          // Убираем фильтр если значение пустое или "all"
          return prev.filter((_, index) => index !== existingIndex)
        } else {
          // Обновляем существующий фильтр
          const newFilters = [...prev]
          newFilters[existingIndex] = updatedFilter
          return newFilters
        }
      } else {
        // Добавляем новый фильтр
        if (value !== '' && value !== 'all' && value !== null && value !== false) {
          return [...prev, updatedFilter]
        }
        return prev
      }
    })
  }, [availableFilters])

  // Применение быстрого фильтра
  const applyQuickFilter = useCallback((quickFilter: QuickFilter) => {
    const newFilters = quickFilter.filters.map(partialFilter => {
      const baseFilter = availableFilters.find(f => f.id === partialFilter.id)
      return baseFilter ? { ...baseFilter, ...partialFilter } : null
    }).filter(Boolean) as SearchFilter[]

    setActiveFilters(newFilters)
    onFiltersChange(newFilters)
  }, [availableFilters, onFiltersChange])

  // Очистка всех фильтров
  const clearAllFilters = useCallback(() => {
    setActiveFilters([])
    setSearchText('')
    onFiltersChange([])
  }, [onFiltersChange])

  // Удаление конкретного фильтра
  const removeFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== filterId))
  }, [])

  // Сохранение поиска
  const saveCurrentSearch = useCallback(() => {
    if (saveSearchName.trim() && activeFilters.length > 0) {
      onSaveSearch(saveSearchName.trim(), activeFilters)
      setSaveSearchName('')
      setShowSaveDialog(false)
    }
  }, [saveSearchName, activeFilters, onSaveSearch])

  // Эффект для отправки изменений фильтров
  useEffect(() => {
    onFiltersChange(activeFilters)
  }, [activeFilters, onFiltersChange])

  // Компонент фильтра
  const FilterComponent: React.FC<{ filter: SearchFilter }> = ({ filter }) => {
    const currentFilter = activeFilters.find(f => f.id === filter.id)
    const value = currentFilter?.value ?? filter.value

    switch (filter.type) {
      case 'text':
        return (
          <Input
            placeholder={filter.placeholder}
            value={value}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
          />
        )

      case 'select':
        return (
          <Select value={value} onValueChange={(val) => updateFilter(filter.id, val)}>
            <SelectTrigger>
              <SelectValue placeholder={`Выберите ${filter.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'range':
        return (
          <div className="space-y-3">
            <Slider
              value={value}
              onValueChange={(val) => updateFilter(filter.id, val)}
              min={filter.min}
              max={filter.max}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{value[0]}</span>
              <span>{value[1]}</span>
            </div>
          </div>
        )

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(value, 'PPP', { locale: ru }) : 'Выберите дату'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value}
                onSelect={(date) => updateFilter(filter.id, date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value}
              onCheckedChange={(checked) => updateFilter(filter.id, checked)}
            />
            <Label className="text-sm">{value ? 'Да' : 'Нет'}</Label>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Основная строка поиска */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Поиск по названию, коду, адресу..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-10"
              />

              {/* Предложения поиска */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <Card className="absolute top-full left-0 right-0 z-10 mt-1">
                  <CardContent className="p-2">
                    <div className="space-y-1">
                      {searchSuggestions.map(suggestion => (
                        <button
                          key={suggestion.id}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm flex items-center justify-between"
                          onClick={() => {
                            setSearchText(suggestion.text)
                            setShowSuggestions(false)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {suggestion.type === 'recent' && <History className="w-3 h-3 text-gray-400" />}
                            {suggestion.type === 'popular' && <TrendingUp className="w-3 h-3 text-blue-500" />}
                            {suggestion.type === 'suggestion' && <Search className="w-3 h-3 text-green-500" />}
                            <span>{suggestion.text}</span>
                          </div>
                          {suggestion.count && (
                            <Badge variant="secondary" className="text-xs">
                              {suggestion.count}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Фильтры
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {activeFilters.length > 0 && (
                <Badge variant="default" className="ml-1">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>

            <Button onClick={() => onSearch(activeFilters)} disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Быстрые фильтры */}
      <div className="flex flex-wrap gap-2">
        {quickFilters.map(filter => (
          <Button
            key={filter.id}
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter(filter)}
            className="flex items-center gap-2"
          >
            {filter.icon}
            {filter.label}
            {filter.count && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {filter.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Активные фильтры */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600">Активные фильтры:</span>
          {activeFilters.map(filter => (
            <Badge key={filter.id} variant="default" className="flex items-center gap-1">
              {filter.label}: {
                typeof filter.value === 'boolean' ? (filter.value ? 'Да' : 'Нет') :
                Array.isArray(filter.value) ? `${filter.value[0]}-${filter.value[1]}` :
                filter.value
              }
              <button
                onClick={() => removeFilter(filter.id)}
                className="ml-1 hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Очистить все
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(true)}>
            <Save className="w-4 h-4 mr-1" />
            Сохранить поиск
          </Button>
        </div>
      )}

      {/* Результаты поиска */}
      {resultCount > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Найдено результатов: {resultCount}</span>
          <div className="flex items-center gap-2">
            <span>Время поиска: 0.12 сек</span>
          </div>
        </div>
      )}

      {/* Расширенные фильтры */}
      {isExpanded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Дополнительные фильтры</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableFilters.map(filter => (
                <div key={filter.id} className="space-y-2">
                  <Label className="text-sm font-medium">{filter.label}</Label>
                  <FilterComponent filter={filter} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Сохраненные поиски */}
      {savedSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5" />
              Сохраненные поиски
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedSearches.map(search => (
                <div key={search.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {search.is_favorite && <Star className="w-4 h-4 text-orange-500" />}
                    <div>
                      <p className="font-medium">{search.name}</p>
                      <p className="text-sm text-gray-500">
                        {search.filters.length} фильтров • Использован {search.usage_count} раз
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onLoadSearch(search.id)}>
                      Загрузить
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteSearch(search.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Диалог сохранения поиска */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Сохранить поиск</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Название поиска</Label>
                <Input
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  placeholder="Введите название для сохранения"
                />
              </div>
              <p className="text-sm text-gray-600">
                Будет сохранено {activeFilters.length} фильтров
              </p>
            </CardContent>
            <div className="flex gap-2 p-6 pt-0">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Отмена
              </Button>
              <Button onClick={saveCurrentSearch} disabled={!saveSearchName.trim()}>
                Сохранить
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
