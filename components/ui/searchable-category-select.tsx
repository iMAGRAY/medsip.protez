import React, { useState, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface Category {
  id: number | string
  name: string
  level?: number
  full_path?: string
  display_name?: string
  description?: string
  isActive?: boolean
  children?: Category[]
}

interface SearchableCategorySelectProps {
  categories: Category[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  includeNoneOption?: boolean
  noneOptionText?: string
  noneValue?: string
  maxHeight?: string
}

export function SearchableCategorySelect({
  categories,
  value,
  onValueChange,
  placeholder = "Выберите категорию",
  className,
  disabled = false,
  includeNoneOption = true,
  noneOptionText = "Выберите категорию",
  noneValue = "none",
  maxHeight = "300px"
}: SearchableCategorySelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [_isOpen, setIsOpen] = useState(false)

  // Фильтрация категорий по поисковому запросу
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories

    return categories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (category.full_path && category.full_path.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [categories, searchTerm])

  // Найти выбранную категорию для отображения
  const selectedCategory = categories.find(cat => cat.id.toString() === value)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setSearchTerm('') // Сбрасываем поиск при закрытии
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const renderCategoryItem = (category: Category) => {
    const level = category.level || 0
    const isRoot = level === 0

    return (
      <SelectItem key={category.id} value={category.id.toString()}>
        <div className="flex items-center w-full">
          <span
            className="text-sm flex items-center w-full"
            style={{
              paddingLeft: `${level * 20}px`,
              minWidth: 'fit-content'
            }}
          >
            {/* Визуальный индикатор уровня */}
            {level > 0 && (
              <span className="text-gray-400 mr-2 text-xs">
                {'├─ '}
              </span>
            )}

            {/* Цветовое кодирование уровней */}
            <span className={
              isRoot
                ? 'font-bold text-gray-900'
                : level === 1
                  ? 'font-medium text-gray-800'
                  : level === 2
                    ? 'font-normal text-gray-700'
                    : 'font-light text-gray-600'
            }>
              {category.name}
            </span>

            {/* Индикатор уровня */}
            {level > 0 && (
              <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-1 rounded">
                L{level}
              </span>
            )}
          </span>
        </div>
      </SelectItem>
    )
  }

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      onOpenChange={handleOpenChange}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedCategory ? (
            <span className="flex items-center">
              {selectedCategory.level && selectedCategory.level > 0 && (
                <span className="text-xs text-gray-500 mr-2">
                  L{selectedCategory.level}
                </span>
              )}
              {selectedCategory.full_path || selectedCategory.name}
            </span>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent style={{ maxHeight }} className="overflow-hidden">
        {/* Поле поиска */}
        <div className="flex items-center border-b px-3 pb-2 mb-2">
          <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
          <Input
            placeholder="Поиск категорий..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Список категорий */}
        <div className="max-h-[400px] overflow-y-auto">
          {includeNoneOption && (
            <SelectItem value={noneValue}>
              {noneOptionText}
            </SelectItem>
          )}

          {filteredCategories.length > 0 ? (
            <>
              {/* Показываем статистику если много категорий */}
              {!searchTerm && filteredCategories.length > 10 && (
                <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b">
                  Всего категорий: {filteredCategories.length}
                  {/* Показываем статистику по уровням */}
                  {(() => {
                    const levelStats = filteredCategories.reduce((acc, cat) => {
                      const level = cat.level || 0
                      acc[level] = (acc[level] || 0) + 1
                      return acc
                    }, {} as Record<number, number>)

                    return Object.keys(levelStats).length > 1 ? (
                      <span className="ml-2">
                        ({Object.entries(levelStats)
                          .map(([level, count]) => `L${level}: ${count}`)
                          .join(', ')})
                      </span>
                    ) : null
                  })()}
                </div>
              )}

              {filteredCategories.map(renderCategoryItem)}
            </>
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              {searchTerm ? 'Категории не найдены' : 'Нет доступных категорий'}
            </div>
          )}
        </div>
      </SelectContent>
    </Select>
  )
}