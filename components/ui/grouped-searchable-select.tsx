import React, { useState, useMemo, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface GroupedSelectOption {
  value: string | number
  label: string
  group?: string
}

interface GroupedSearchableSelectProps {
  options: GroupedSelectOption[]
  value?: string | number
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxHeight?: string
  searchPlaceholder?: string
}

export function GroupedSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Выберите...',
  className,
  disabled = false,
  maxHeight = '400px',
  searchPlaceholder = 'Поиск...',
}: GroupedSearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Debounce input (150 мс)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 150)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Автоматический фокус на поле поиска при открытии
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    } else if (!isOpen) {
      // Очищаем поиск при закрытии
      setSearchTerm('')
      setExpandedGroups(new Set())
    }
  }, [isOpen])

  // Группируем опции
  const groupedOptions = useMemo(() => {
    const groups: Record<string, GroupedSelectOption[]> = {}

    options.forEach(option => {
      const group = option.group || 'Без группы'
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push(option)
    })

    return groups
  }, [options])

  // Фильтруем опции по поиску
  const filteredGroupedOptions = useMemo(() => {
    if (!debouncedTerm.trim()) return groupedOptions

    const lower = debouncedTerm.toLowerCase()
    const filtered: Record<string, GroupedSelectOption[]> = {}

    Object.entries(groupedOptions).forEach(([group, groupOptions]) => {
      const filteredGroup = groupOptions.filter(opt => {
        const label = opt.label.toLowerCase()
        const value = opt.value.toString().toLowerCase()
        const groupName = group.toLowerCase()
        return label.includes(lower) || value.includes(lower) || groupName.includes(lower)
      })

      if (filteredGroup.length > 0) {
        filtered[group] = filteredGroup
      }
    })

    return filtered
  }, [groupedOptions, debouncedTerm])

  const selected = options.find((opt) => opt.value.toString() === value?.toString())

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(group)) {
        newSet.delete(group)
      } else {
        newSet.add(group)
      }
      return newSet
    })
  }

  const expandAllGroups = () => {
    setExpandedGroups(new Set(Object.keys(filteredGroupedOptions)))
  }

  const collapseAllGroups = () => {
    setExpandedGroups(new Set())
  }

  const renderOptions = () => {
    const groups = Object.keys(filteredGroupedOptions)

    if (groups.length === 0) {
      return (
        <div className="px-3 py-2 text-sm text-gray-500 text-center">
          {debouncedTerm ? 'Ничего не найдено' : 'Нет доступных вариантов'}
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {/* Кнопки управления группами */}
        {!debouncedTerm && groups.length > 1 && (
          <div className="flex gap-1 px-3 pb-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={expandAllGroups}
              className="h-6 text-xs"
            >
              Развернуть все
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={collapseAllGroups}
              className="h-6 text-xs"
            >
              Свернуть все
            </Button>
          </div>
        )}

        {/* Группы */}
        {groups.map(group => {
          const groupOptions = filteredGroupedOptions[group]
          const isExpanded = expandedGroups.has(group) || debouncedTerm.trim() !== ''

          return (
            <div key={group} className="space-y-1">
              {/* Заголовок группы */}
              <div className="flex items-center px-3 py-1 bg-gray-50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleGroup(group)}
                  className="h-6 p-0 hover:bg-transparent"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
                <span className="ml-1 text-xs font-medium text-gray-600">
                  {group} ({groupOptions.length})
                </span>
              </div>

              {/* Опции группы */}
              {isExpanded && (
                <div className="ml-4 space-y-0">
                  {groupOptions.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Select
      value={value?.toString()}
      onValueChange={onValueChange}
      disabled={disabled}
      onOpenChange={setIsOpen}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>{selected?.label || placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent style={{ maxHeight }} className="overflow-hidden">
        {/* Поиск */}
        <div className="flex items-center border-b px-3 pb-2 mb-2">
          <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setSearchTerm('')
              }
            }}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {renderOptions()}
        </div>
      </SelectContent>
    </Select>
  )
}