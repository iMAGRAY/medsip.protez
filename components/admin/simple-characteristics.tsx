'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Package, Tag } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

// #ДОДЕЛАТЬ - Добавить поддержку цветовых характеристик с hex кодами
// #ПРОДОЛЖИТЬ - Реализовать bulk operations для массового выбора

interface SimpleCharacteristicsProps {
  productId: number
  onSave?: (characteristics: any[]) => void
  readonly?: boolean
}

interface CharacteristicGroup {
  group_id: number
  group_name: string
  group_sort_order: number
  values: CharacteristicValue[]
}

interface CharacteristicValue {
  id: number
  value: string
  color_hex?: string
  sort_order: number
  is_selected: boolean
}

interface SelectedCharacteristic {
  value_id: number
  value_name: string
  additional_value: string
  color_hex?: string
}

interface CharacteristicSection {
  section_id: number
  section_name: string
  section_ordering?: number
  section_description?: string
  groups: {
    group_id: number
    group_name: string
    group_ordering?: number
    characteristics: SelectedCharacteristic[]
  }[]
}

export function SimpleCharacteristics({ productId, onSave, readonly = false }: SimpleCharacteristicsProps) {
  const [availableCharacteristics, setAvailableCharacteristics] = useState<CharacteristicGroup[]>([])
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<SelectedCharacteristic[]>([])
  const [characteristicSections, setCharacteristicSections] = useState<CharacteristicSection[]>([])
  const [loading, setLoading] = useState(true)

  // Загрузка характеристик с API
  useEffect(() => {
    loadCharacteristics()
  }, [productId])

  const loadCharacteristics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}/characteristics-simple`)

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // Обрабатываем новую структуру с разделами и группами
        if (data.data.available_characteristics) {
        setAvailableCharacteristics(data.data.available_characteristics || [])
        }

        // Преобразуем выбранные характеристики из новой структуры разделы -> группы -> характеристики
        const sections = data.data.sections || []
        const flatSelected: SelectedCharacteristic[] = []

        // Сохраняем структуру разделов для readonly отображения
        setCharacteristicSections(sections)

        sections.forEach((section: any) => {
          section.groups?.forEach((group: any) => {
            group.characteristics?.forEach((char: any) => {
              // Логируем для отладки
              if (!char.value_name && !char.additional_value) {
                console.warn('Характеристика без значения:', {
                  sectionName: section.section_name,
                  groupName: group.group_name,
                  char: char
                });
              }
              
              flatSelected.push({
                value_id: char.value_id,
                value_name: char.value_name || '',
                additional_value: char.additional_value || '',
                color_hex: char.color_hex
              })
            })
          })
        })

        setSelectedCharacteristics(flatSelected)

      } else {
        throw new Error(data.error || 'Неизвестная ошибка')
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки характеристик:', error)
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить характеристики",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Переключение выбора характеристики
  const toggleCharacteristic = (value: CharacteristicValue, groupName: string) => {
    const isCurrentlySelected = selectedCharacteristics.some(c => c.value_id === value.id)

    if (isCurrentlySelected) {
      // Удаляем характеристику
      setSelectedCharacteristics(prev => prev.filter(c => c.value_id !== value.id))
    } else {
      // Добавляем характеристику
      setSelectedCharacteristics(prev => [...prev, {
        value_id: value.id,
        value_name: value.value,
        additional_value: '',
        color_hex: value.color_hex
      }])
    }
  }

  // Обновление дополнительного значения
  const updateAdditionalValue = (valueId: number, additionalValue: string) => {
    setSelectedCharacteristics(prev =>
      prev.map(char =>
        char.value_id === valueId
          ? { ...char, additional_value: additionalValue }
          : char
      )
    )
  }

  // Удаление характеристики
  const removeCharacteristic = (valueId: number) => {
    setSelectedCharacteristics(prev => prev.filter(c => c.value_id !== valueId))
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 animate-spin" />
            <span>Загрузка характеристик...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="w-5 h-5" />
          Характеристики товара
          <Badge variant="secondary">{selectedCharacteristics.length}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Характеристики товара */}
        {readonly && characteristicSections.length > 0 ? (
          <div className="space-y-8">
            {characteristicSections
              .sort((a, b) => (a.section_ordering || 999) - (b.section_ordering || 999))
              .map(section => (
                <div key={section.section_id} className="space-y-6">
                  {/* Заголовок раздела */}
                  <div className="border-b border-slate-200 pb-4">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                      <Package className="w-6 h-6 text-cyan-600" />
                      {section.section_name}
                    </h3>
                    {section.section_description && (
                      <p className="text-sm text-slate-600 mt-2">{section.section_description}</p>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
                      {section.groups.length} груп{section.groups.length === 1 ? 'па' : section.groups.length < 5 ? 'пы' : 'п'} характеристик
                    </div>
                  </div>

                  {/* Группы в разделе */}
                  <div className="space-y-4">
                    {section.groups
                      .filter(group => group.characteristics && group.characteristics.length > 0 && 
                        group.characteristics.some((char: any) => char.value_name || char.additional_value))
                      .sort((a, b) => (a.group_ordering || 999) - (b.group_ordering || 999))
                      .map(group => (
                        <div key={group.group_id} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 overflow-hidden shadow-sm">
                          {/* Заголовок группы */}
                          <div className="bg-gradient-to-r from-slate-50 to-slate-100/80 px-6 py-4 border-b border-slate-200/50">
                            <h4 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                              <Tag className="w-5 h-5 text-slate-600" />
                              {group.group_name}
                            </h4>
                          </div>

                          {/* Характеристики группы в табличном формате */}
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <tbody className="divide-y divide-slate-200/50">
                                {group.characteristics && group.characteristics.length > 0 ? (
                                  group.characteristics.map((char, index) => {
                                    // Проверяем, что у характеристики есть значение
                                    const hasValue = char.value_name || char.additional_value;
                                    if (!hasValue) {
                                      console.warn('Пустая характеристика:', char);
                                      return null;
                                    }
                                    
                                    return (
                                      <tr key={char.value_id || index} className={`${index % 2 === 0 ? 'bg-white/60' : 'bg-slate-50/30'} hover:bg-slate-50/60 transition-colors duration-200`}>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-700 border-r border-slate-200/30 w-1/3">
                                          <div className="flex items-center gap-2">
                                            {char.color_hex && (
                                              <div
                                                className="w-3 h-3 rounded-full border border-slate-300"
                                                style={{ backgroundColor: char.color_hex }}
                                                title={`Цвет: ${char.color_hex}`}
                                              />
                                            )}
                                            {char.value_name || '-'}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-900">
                                          <span className="font-medium">
                                            {char.additional_value || char.value_name || '-'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  }).filter(Boolean)
                                ) : (
                                  <tr>
                                    <td colSpan={2} className="px-6 py-4 text-sm text-slate-500 text-center">
                                      Нет характеристик
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        ) : selectedCharacteristics.length > 0 ? (
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Выбранные характеристики
            </Label>
            <div className="space-y-2">
              {selectedCharacteristics.map(char => (
                <div key={char.value_id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{char.value_name}</span>
                      {char.color_hex && (
                        <div
                          className="w-4 h-4 rounded border border-gray-300"
                          style={{ backgroundColor: char.color_hex }}
                          title={char.color_hex}
                        />
                      )}
                    </div>
                      <Input
                        value={char.additional_value}
                        onChange={(e) => updateAdditionalValue(char.value_id, e.target.value)}
                        placeholder="Дополнительное значение (необязательно)"
                        className="h-8 text-sm"
                      />
                  </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCharacteristic(char.value_id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                    <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              ))}
            </div>
          </div>
        ) : readonly ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">У этого товара пока нет настроенных характеристик</p>
          </div>
        ) : null}

        {/* Доступные характеристики для выбора - только в режиме редактирования */}
        {!readonly && (
          <>
            <div>
              <Label className="text-sm font-medium mb-3 block">Доступные характеристики</Label>
              <div className="space-y-4">
                {availableCharacteristics.map(group => (
                  <div key={group.group_id} className="border rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-3">{group.group_name}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {group.values.map(value => {
                        const isSelected = selectedCharacteristics.some(c => c.value_id === value.id)
                        return (
                          <div key={value.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`char-${value.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleCharacteristic(value, group.group_name)}
                            />
                            <label
                              htmlFor={`char-${value.id}`}
                              className="text-sm cursor-pointer flex items-center gap-2"
                            >
                              {value.value}
                              {value.color_hex && (
                                <div
                                  className="w-3 h-3 rounded border border-gray-300"
                                  style={{ backgroundColor: value.color_hex }}
                                />
                              )}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </>
        )}
      </CardContent>
    </Card>
  )
}