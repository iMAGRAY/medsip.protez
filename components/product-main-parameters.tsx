import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Star, Zap } from 'lucide-react'
import {
  extractMainParameters,
  getTopMainParameters,
  isImportantValue,
  formatParametersInline,
  groupParametersByType,
  type CharacteristicGroup
} from '@/lib/main-parameters-utils'

interface ProductMainParametersProps {
  groups: CharacteristicGroup[]
  variant?: 'card' | 'inline' | 'detailed' | 'compact'
  maxParameters?: number
  showIcons?: boolean
  className?: string
}

export default function ProductMainParameters({
  groups,
  variant = 'card',
  maxParameters = 3,
  showIcons = true,
  className = ''
}: ProductMainParametersProps) {

  if (!groups || groups.length === 0) {
    return null
  }

  const allMainParams = extractMainParameters(groups)

  if (allMainParams.length === 0) {
    return null
  }

  // Компактный вариант - только текст в одну строку
  if (variant === 'compact') {
    const topParams = getTopMainParameters(groups, maxParameters)
    const inlineText = formatParametersInline(topParams, ' • ')

    return (
      <div className={`text-sm text-slate-600 ${className}`}>
        {inlineText}
      </div>
    )
  }

  // Inline вариант - параметры в строку с бейджами
  if (variant === 'inline') {
    const topParams = getTopMainParameters(groups, maxParameters)

    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {topParams.map((param) => (
          <Badge
            key={param.id}
            variant="secondary"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <span className="font-medium">{param.display_name}:</span>
            <span className="ml-1">{param.value}</span>
          </Badge>
        ))}
      </div>
    )
  }

  // Detailed вариант - все основные параметры с группировкой
  if (variant === 'detailed') {
    const groupedParams = groupParametersByType(allMainParams)

    return (
      <div className={`space-y-4 ${className}`}>
        {/* Критически важные параметры */}
        {groupedParams.critical.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              {showIcons && <Star className="w-4 h-4" />}
              Ключевые параметры
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {groupedParams.critical.map((param) => (
                <div key={param.id} className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-3 border border-emerald-200/50">
                  <div className="text-xs font-medium text-emerald-600 mb-1">{param.display_name}</div>
                  <div className="text-sm font-semibold text-slate-800">{param.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Важные параметры */}
        {groupedParams.important.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-700">
              {showIcons && <Zap className="w-4 h-4" />}
              Важные характеристики
            </div>
            <div className="flex flex-wrap gap-2">
              {groupedParams.important.map((param) => (
                <Badge
                  key={param.id}
                  variant="outline"
                  className="bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100"
                >
                  {param.display_name}: {param.value}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Дополнительные параметры */}
        {groupedParams.additional.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-600">Дополнительно</div>
            <div className="flex flex-wrap gap-1">
              {groupedParams.additional.map((param) => (
                <Badge
                  key={param.id}
                  variant="secondary"
                  className="bg-slate-100 text-slate-600 text-xs"
                >
                  {param.display_name}: {param.value}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Card вариант (по умолчанию) - красивые карточки с основными параметрами
  const topParams = getTopMainParameters(groups, maxParameters)

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Заголовок с иконкой */}
      {showIcons && (
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <Star className="w-4 h-4" />
          Основные параметры
        </div>
      )}

      {/* Параметры в карточках */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {topParams.map((param, index) => {
          const isImportant = isImportantValue(param.value)
          const isFirst = index === 0

          return (
            <div
              key={param.id}
              className={`
                rounded-lg p-3 border transition-all duration-200 hover:shadow-md
                ${isFirst
                  ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60 hover:border-emerald-300'
                  : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200/60 hover:border-slate-300'
                }
              `}
            >
              {/* Название параметра */}
              <div className={`text-xs font-medium mb-1 ${isFirst ? 'text-emerald-600' : 'text-slate-600'}`}>
                {param.display_name}
              </div>

              {/* Значение */}
              <div className={`text-sm font-semibold ${isImportant ? 'text-emerald-700' : 'text-slate-800'}`}>
                {param.value}
              </div>

              {/* Индикатор важности */}
              {isImportant && (
                <div className="mt-1">
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5">
                    Важно
                  </Badge>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Показываем количество дополнительных параметров */}
      {allMainParams.length > maxParameters && (
        <div className="text-xs text-slate-500 italic">
          +{allMainParams.length - maxParameters} дополнительных параметров
        </div>
      )}
    </div>
  )
}