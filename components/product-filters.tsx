"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"

interface ProductFiltersProps {
  availableCharacteristics: any[]
  isLoadingCharacteristics: boolean
  appliedFilters: {
    characteristics: Record<string, string[]>
  }
  onCharacteristicFilterChange: (charName: string, value: string, checked: boolean) => void
  onClearCharacteristicFilters: () => void
  totalProducts?: number
}

export function ProductFilters({
  availableCharacteristics,
  isLoadingCharacteristics,
  appliedFilters,
  onCharacteristicFilterChange,
  onClearCharacteristicFilters,
  totalProducts = 0
}: ProductFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const activeFiltersCount = Object.values(appliedFilters.characteristics).flat().length

  // Автоматически раскрываем фильтры при первом применении
  useEffect(() => {
    if (activeFiltersCount > 0 && !isExpanded) {
      setIsExpanded(true)
    }
  }, [activeFiltersCount, isExpanded])

  const toggleGroupExpansion = (groupName: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName)
    } else {
      newExpanded.add(groupName)
    }
    setExpandedGroups(newExpanded)
  }

  if (isLoadingCharacteristics) {
    return (
      <div className="relative mb-6">
        <div className="bg-white/90 backdrop-blur-lg rounded-lg border border-cyan-200/40 p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-16 bg-gradient-to-r from-cyan-200/50 to-blue-200/50 rounded animate-pulse"></div>
            <div className="h-3 w-32 bg-gradient-to-r from-cyan-100/50 to-blue-100/50 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!availableCharacteristics || availableCharacteristics.length === 0) {
    return (
      <div className="relative mb-6">
        <div className="bg-white/90 backdrop-blur-lg rounded-lg border border-cyan-200/40 p-4">
          <div className="text-sm text-gray-500 text-center">
            Выберите категорию для отображения фильтров
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mb-6">
      <div className="bg-white/90 backdrop-blur-lg rounded-lg border border-cyan-200/40 shadow-sm overflow-hidden">
        {/* Компактный заголовок */}
        <div className="px-4 py-3 bg-gradient-to-r from-cyan-50/80 to-blue-50/60 border-b border-cyan-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800 transition-colors"
              >
                Фильтры
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeFiltersCount > 0 && (
                <span className="text-xs bg-cyan-500 text-white px-2 py-1 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
              {totalProducts > 0 && (
                <span className="text-xs text-cyan-600/70 bg-cyan-100/40 px-2 py-1 rounded-full">
                  найдено: {totalProducts}
                </span>
              )}
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={onClearCharacteristicFilters}
                className="text-xs text-cyan-600 hover:text-cyan-700 font-medium px-3 py-1 rounded-full bg-cyan-100/50 hover:bg-cyan-200/50 transition-all duration-200"
              >
                Очистить ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {/* Активные фильтры */}
        {activeFiltersCount > 0 && (
          <div className="px-4 py-2 bg-cyan-50/30 border-b border-cyan-200/20">
            <div className="flex flex-wrap gap-2">
              {Object.entries(appliedFilters.characteristics).map(([charName, values]) =>
                values.map((value) => (
                  <button
                    key={`${charName}-${value}`}
                    onClick={() => onCharacteristicFilterChange(charName, value, false)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-cyan-100 text-cyan-700 rounded-full hover:bg-cyan-200 transition-colors"
                  >
                    {charName}: {value}
                    <X className="w-3 h-3" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Контент фильтров */}
        {isExpanded && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {availableCharacteristics.slice(0, 12).map((characteristic) => (
                <div key={characteristic.name} className="border border-cyan-200/30 rounded-lg p-3 bg-white/50">
                  <button
                    onClick={() => toggleGroupExpansion(characteristic.name)}
                    className="flex items-center justify-between w-full text-left mb-2"
                  >
                    <h4 className="text-sm font-medium text-slate-700">{characteristic.name}</h4>
                    {expandedGroups.has(characteristic.name) ?
                      <ChevronUp className="w-3 h-3 text-cyan-600" /> :
                      <ChevronDown className="w-3 h-3 text-cyan-600" />
                    }
                  </button>

                  {expandedGroups.has(characteristic.name) && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(characteristic.values || []).slice(0, 8).map((valueObj: any, index: number) => (
                        <label
                          key={`${characteristic.name}-${index}`}
                          className="flex items-center gap-2 text-xs cursor-pointer hover:text-cyan-700 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={appliedFilters.characteristics[characteristic.name]?.includes(valueObj.value) || false}
                            onChange={(e) => onCharacteristicFilterChange(characteristic.name, valueObj.value, e.target.checked)}
                            className="h-3 w-3 text-cyan-600 border-cyan-300 rounded focus:ring-cyan-500 focus:ring-1"
                          />
                          <span className="flex-1 truncate">{valueObj.value}</span>
                          <span className="text-cyan-500/70 bg-cyan-100/40 px-1 py-0.5 rounded text-xs">
                            {valueObj.productCount}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {!expandedGroups.has(characteristic.name) && (
                    <div className="flex flex-wrap gap-1">
                      {(characteristic.values || []).slice(0, 3).map((valueObj: any, index: number) => (
                        <button
                          key={`${characteristic.name}-${index}`}
                          onClick={() => onCharacteristicFilterChange(
                            characteristic.name,
                            valueObj.value,
                            !appliedFilters.characteristics[characteristic.name]?.includes(valueObj.value)
                          )}
                          className={`text-xs px-2 py-1 rounded-full border transition-all ${
                            appliedFilters.characteristics[characteristic.name]?.includes(valueObj.value)
                              ? 'bg-cyan-500 text-white border-cyan-500'
                              : 'bg-white border-cyan-200 text-slate-600 hover:border-cyan-300 hover:bg-cyan-50'
                          }`}
                        >
                          {valueObj.value}
                        </button>
                      ))}
                      {(characteristic.values || []).length > 3 && (
                        <button
                          onClick={() => toggleGroupExpansion(characteristic.name)}
                          className="text-xs px-2 py-1 text-cyan-600 hover:text-cyan-700"
                        >
                          +{(characteristic.values || []).length - 3}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}