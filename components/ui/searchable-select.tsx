import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { FixedSizeList as List } from 'react-window'

export interface SelectOption {
  value: string | number
  label: string
}

interface SearchableSelectProps {
  options: SelectOption[]
  value?: string | number
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  includeNoneOption?: boolean
  noneOptionText?: string
  noneValue?: string
  maxHeight?: string
  searchPlaceholder?: string
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Выберите...',
  className,
  disabled = false,
  includeNoneOption = false,
  noneOptionText = 'Не выбрано',
  noneValue = 'none',
  maxHeight = '300px',
  searchPlaceholder = 'Поиск...',
}: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
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
    }
  }, [isOpen])

  const filteredOptions = useMemo(() => {
    if (!debouncedTerm.trim()) return options
    const lower = debouncedTerm.toLowerCase()
    return options.filter((opt) => {
      const label = opt.label.toLowerCase()
      const value = opt.value.toString().toLowerCase()
      return label.includes(lower) || value.includes(lower)
    })
  }, [options, debouncedTerm])

  const selected = options.find((opt) => opt.value.toString() === value?.toString())

  // Размер строки для виртуализации
  const ITEM_HEIGHT = 32

  const renderOptions = () => {
    if (filteredOptions.length === 0) {
      return (
        <div className="px-3 py-2 text-sm text-gray-500 text-center">
          {debouncedTerm ? 'Ничего не найдено' : 'Нет доступных вариантов'}
        </div>
      )
    }

    // Если немного опций — рендерим напрямую
    if (filteredOptions.length < 100) {
      return filteredOptions.map((opt) => (
        <SelectItem key={opt.value} value={opt.value.toString()}>
          {opt.label}
        </SelectItem>
      ))
    }

    // Виртуализированный список для больших массивов
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const opt = filteredOptions[index]
      return (
        <div style={style}>
          <SelectItem value={opt.value.toString()}>{opt.label}</SelectItem>
        </div>
      )
    }

    return (
      <List
        height={Math.min(ITEM_HEIGHT * 8, ITEM_HEIGHT * filteredOptions.length)}
        itemCount={filteredOptions.length}
        itemSize={ITEM_HEIGHT}
        width="100%"
      >
        {Row}
      </List>
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

        <div className="max-h-[250px] overflow-y-auto">
          {includeNoneOption && (
            <SelectItem value={noneValue}>{noneOptionText}</SelectItem>
          )}
          {renderOptions()}
        </div>
      </SelectContent>
    </Select>
  )
}

// Вспомогательная функция для преобразования простых строк в опции
export function createSelectOptions(
  items: string[] | { value: string; label: string; description?: string }[],
  valueKey?: string,
  labelKey?: string
): SelectOption[] {
  if (Array.isArray(items) && items.length > 0) {
    if (typeof items[0] === 'string') {
      // Массив строк
      return (items as string[]).map(item => ({
        value: item,
        label: item
      }))
    } else {
      // Массив объектов
      return (items as any[]).map(item => ({
        value: valueKey ? item[valueKey] : item.value || item.id?.toString(),
        label: labelKey ? item[labelKey] : item.label || item.name,
        description: item.description
      }))
    }
  }
  return []
}