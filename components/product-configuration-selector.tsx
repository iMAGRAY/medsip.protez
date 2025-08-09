"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Settings, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ConfigurableCharacteristic {
  value_id: number
  value_name: string
  group_id: number
  group_name: string
  additional_value: string
  color_hex?: string
}

interface ProductConfigurationSelectorProps {
  configurableCharacteristics: ConfigurableCharacteristic[]
  onChange?: (configuration: Record<string, any>) => void
  className?: string
  hasError?: boolean
}

export function ProductConfigurationSelector({ 
  configurableCharacteristics, 
  onChange,
  className = '',
  hasError = false
}: ProductConfigurationSelectorProps) {
  const [configuration, setConfiguration] = useState<Record<string, any>>({})

  console.log('🎨 ProductConfigurationSelector: Получено характеристик:', configurableCharacteristics.length, configurableCharacteristics)

  // Группируем характеристики по группам
  const groupedCharacteristics = configurableCharacteristics.reduce((acc, char) => {
    if (!acc[char.group_id]) {
      acc[char.group_id] = {
        group_name: char.group_name,
        characteristics: []
      }
    }
    acc[char.group_id].characteristics.push(char)
    return acc
  }, {} as Record<number, { group_name: string; characteristics: ConfigurableCharacteristic[] }>)

  // Обновляем конфигурацию при изменении характеристики
  const updateConfiguration = (groupId: number, value: any) => {
    const group = groupedCharacteristics[groupId]
    const newConfig = {
      ...configuration,
      [groupId]: {
        ...value,
        characteristic_name: group?.group_name || '',
        characteristic_id: groupId
      }
    }
    setConfiguration(newConfig)
    onChange?.(newConfig)
  }

  if (configurableCharacteristics.length === 0) {
    return null
  }

  return (
    <Card 
      data-config-selector
      className={`${className} bg-gradient-to-br from-cyan-50/30 to-blue-50/20 border-2 transition-all duration-300 ${
        hasError 
          ? 'border-red-500 shadow-lg shadow-red-200/50' 
          : 'border-cyan-200/40'
      }`}
    >
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className={`w-5 h-5 ${hasError ? 'text-red-600' : 'text-cyan-600'}`} />
          <span className={hasError ? 'text-red-700' : ''}>Конфигурация товара</span>
          {hasError && (
            <span className="text-sm text-red-600 font-normal ml-auto">
              Обязательно для выбора
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedCharacteristics).map(([groupId, group]) => {
          const isBooleanGroup = group.characteristics.length === 1 && 
            (group.characteristics[0].value_name.toLowerCase() === 'да' || 
             group.characteristics[0].value_name.toLowerCase() === 'есть')

          if (isBooleanGroup) {
            // Отображаем как переключатель
            const char = group.characteristics[0]
            return (
              <div key={groupId} className={`flex items-center justify-between p-3 bg-white/60 rounded-lg border-2 transition-all duration-300 ${
                hasError && !configuration[groupId] 
                  ? 'border-red-500 shadow-md shadow-red-200/30' 
                  : 'border-cyan-200/30'
              }`}>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`config-${groupId}`} className="text-sm font-medium cursor-pointer">
                    {group.group_name}
                  </Label>
                  {char.additional_value && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-cyan-600" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">{char.additional_value}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Switch
                  id={`config-${groupId}`}
                  checked={configuration[groupId]?.selected === true}
                  onCheckedChange={(checked) => updateConfiguration(Number(groupId), {
                    selected: checked,
                    value_id: char.value_id,
                    value_name: char.value_name,
                    additional_value: char.additional_value
                  })}
                />
              </div>
            )
          } else {
            // Отображаем как выпадающий список
            return (
              <div key={groupId} className="space-y-2">
                <Label className="text-sm font-medium">{group.group_name}</Label>
                <Select
                  value={configuration[groupId]?.value_id?.toString() || ''}
                  onValueChange={(value) => {
                    const selectedChar = group.characteristics.find(c => c.value_id.toString() === value)
                    if (selectedChar) {
                      updateConfiguration(Number(groupId), {
                        value_id: selectedChar.value_id,
                        value_name: selectedChar.value_name,
                        additional_value: selectedChar.additional_value,
                        color_hex: selectedChar.color_hex
                      })
                    }
                  }}
                >
                  <SelectTrigger className={`w-full bg-white/80 hover:bg-white/90 transition-colors ${
                    hasError && !configuration[groupId] 
                      ? 'border-red-500 border-2' 
                      : 'border-cyan-200/40'
                  }`}>
                    <SelectValue placeholder="Выберите вариант" />
                  </SelectTrigger>
                  <SelectContent>
                    {group.characteristics.map((char) => (
                      <SelectItem key={char.value_id} value={char.value_id.toString()}>
                        <div className="flex items-center gap-2">
                          {char.color_hex && (
                            <div
                              className="w-4 h-4 rounded-full border border-gray-300"
                              style={{ backgroundColor: char.color_hex }}
                            />
                          )}
                          <span>{char.value_name}</span>
                          {char.additional_value && (
                            <span className="text-sm text-gray-500">({char.additional_value})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }
        })}
        
        {/* Информация о выбранной конфигурации */}
        {Object.keys(configuration).length > 0 && (
          <div className="pt-3 border-t border-cyan-200/40">
            <p className="text-sm text-gray-600 mb-2">Выбранная конфигурация:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(configuration).map(([groupId, config]) => {
                const group = groupedCharacteristics[Number(groupId)]
                if (!group || !config) return null
                
                return (
                  <Badge key={groupId} variant="outline" className="bg-white/80">
                    <span className="text-xs font-medium">{group.group_name}:</span>
                    <span className="ml-1 text-xs">
                      {config.value_name}
                      {config.additional_value && ` (${config.additional_value})`}
                    </span>
                  </Badge>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}