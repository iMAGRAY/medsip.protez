'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Trash2, Package, Tag, Layers, Plus, Loader2, Check, X, Search } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface CompactCharacteristicsProps {
  productId: number | undefined
  onSave?: (characteristics: any[]) => void
  readonly?: boolean
  initialCharacteristics?: any[]
  isActive?: boolean
  mode?: 'characteristics' | 'configurable' // Режим работы компонента
}

interface CharacteristicSection {
  section_id: number
  section_name: string
  section_ordering: number
  section_description: string
  groups: CharacteristicGroup[]
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
  group_id: number
  group_name: string
  additional_value: string
  color_hex?: string
  value?: string
  text_value?: string
  enum_value_name?: string
}

interface DropdownPosition {
  top: number
  left: number
  width: number
}

function CompactCharacteristicsComponent({ productId, onSave, readonly = false, initialCharacteristics, isActive = true, mode = 'characteristics' }: CompactCharacteristicsProps) {

  const [availableCharacteristics, setAvailableCharacteristics] = useState<CharacteristicGroup[]>([])
  const [characteristicSections, setCharacteristicSections] = useState<CharacteristicSection[]>([])
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<SelectedCharacteristic[]>(initialCharacteristics || [])
  
  // Логирование для отладки
  useEffect(() => {
    if (mode === 'configurable') {
      console.log('🔍 CompactCharacteristics (configurable mode):', {
        productId,
        initialCharacteristics,
        selectedCharacteristics
      })
    }
  }, [mode, productId, initialCharacteristics, selectedCharacteristics])
  const [loading, setLoading] = useState(true)

  const [openDropdownGroup, setOpenDropdownGroup] = useState<number | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null)
  const [dropdownSearchTerm, setDropdownSearchTerm] = useState<string>('')
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [editingCharacteristic, setEditingCharacteristic] = useState<number | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  const previousCharacteristicsRef = useRef<SelectedCharacteristic[]>([])
  const selectedCharacteristicsRef = useRef<SelectedCharacteristic[]>([])
  const isInitialLoadRef = useRef(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [openAddDropdownGroup, setOpenAddDropdownGroup] = useState<number | null>(null)
  const [addDropdownPosition, setAddDropdownPosition] = useState<DropdownPosition | null>(null)
  const addDropdownRef = useRef<HTMLDivElement>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createGroupName, setCreateGroupName] = useState('')
  const [createGroupId, setCreateGroupId] = useState<number>(0)
  const [newCharacteristicValue, setNewCharacteristicValue] = useState('')

  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [groupDialogError, setGroupDialogError] = useState('')
  const [groupDialogLoading, setGroupDialogLoading] = useState(false)
  const [groupDialogParent, setGroupDialogParent] = useState<number | null>(null)
  const [groupDialogSectionName, setGroupDialogSectionName] = useState('')

  const [isValueDialogOpen, setIsValueDialogOpen] = useState(false)
  const [newValueName, setNewValueName] = useState('')
  const [newValueColor, setNewValueColor] = useState('')
  const [valueDialogError, setValueDialogError] = useState('')
  const [valueDialogLoading, setValueDialogLoading] = useState(false)
  const [valueDialogGroup, setValueDialogGroup] = useState<number | null>(null)

  const loadCharacteristics = useCallback(async () => {
    // Не загружаем, если данные уже загружены и вкладка не активна
    if (!isActive && characteristicSections.length > 0) {
      return
    }

    setLoading(true)

    try {
      // В режиме конфигурируемых характеристик всегда загружаем все характеристики
      const endpoint = mode === 'configurable'
        ? '/api/characteristics'
        : (productId
          ? `/api/products/${productId}/characteristics-simple`
          : '/api/characteristics')

      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Ошибка загрузки характеристик')

      const result = await response.json()

              // console.log('🔍 CompactCharacteristics: Получены данные от API:', result)

      if (result.success && result.data) {
        // Обрабатываем разделы характеристик
        const sections = (result.data.sections || []).map((section: any) => ({
          section_id: section.section_id,
          section_name: section.section_name,
          section_ordering: section.section_ordering,
          section_description: section.section_description,
          groups: section.groups || []
        }))

        // console.log('🔍 CompactCharacteristics: Обработанные разделы:', sections)

        const availableGroups = (result.data.available_characteristics || []).map((group: any) => ({
          group_id: group.group_id,
          group_name: group.group_name,
          group_sort_order: group.group_sort_order,
          values: (group.values || []).map((v: any) => ({
            id: v.id,
            value: v.value,
            color_hex: v.color_hex,
            sort_order: v.sort_order,
            is_selected: !!v.is_selected
          }))
        }))

        // Для существующих товаров загружаем выбранные характеристики
        const initiallySelected: SelectedCharacteristic[] = []
        
        if (mode === 'configurable') {
          // В режиме конфигурируемых характеристик используем только переданные характеристики
          if (initialCharacteristics && initialCharacteristics.length > 0) {
            initiallySelected.push(...initialCharacteristics)
          }
        } else {
          // В обычном режиме загружаем характеристики товара
          if (productId && result.data.selected_characteristics) {
            result.data.selected_characteristics.forEach((group: any) => {
              (group.characteristics || []).forEach((char: any) => {
                const selectedChar = {
                  value_id: char.value_id,
                  value_name: char.value_name || char.value || '-',
                  group_id: char.group_id || group.group_id,
                  group_name: group.group_name,
                  additional_value: char.additional_value || '',
                  color_hex: char.color_hex
                };
                initiallySelected.push(selectedChar);
              })
            })
          } else if (initialCharacteristics && initialCharacteristics.length > 0) {
            // Для новых товаров используем переданные характеристики
            initiallySelected.push(...initialCharacteristics)
          }
        }

        // помечаем выбранные
        const augmentGroups = availableGroups.map((group: any) => ({
          ...group,
          values: group.values.map((v: any) => ({
            ...v,
            is_selected: initiallySelected.some(s => s.value_id === v.id)
          }))
        }))

        // console.log('🔍 CompactCharacteristics: Устанавливаем состояние:')
        // console.log('  - sections:', sections.length)
        // console.log('  - augmentGroups:', augmentGroups.length)
        // console.log('  - initiallySelected:', initiallySelected.length)

        setCharacteristicSections(sections)
        setAvailableCharacteristics(augmentGroups)

        // Устанавливаем выбранные характеристики только если их еще нет
        setSelectedCharacteristics(prev => {
          if (prev.length === 0) {
            return initiallySelected
          }
          return prev
        })
      } else {
        // console.log('🔍 CompactCharacteristics: Нет данных, очищаем состояние')
        setCharacteristicSections([])
        setAvailableCharacteristics([])
        setSelectedCharacteristics([])
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки характеристик:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить характеристики",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [productId, initialCharacteristics, isActive, characteristicSections.length, mode])

  useEffect(() => {
    // Загружаем характеристики только если:
    // 1. В режиме configurable - всегда
    // 2. В обычном режиме - только если есть productId или данные еще не загружены
    if (mode === 'configurable' || productId !== undefined || !characteristicSections.length) {
      loadCharacteristics()
    }
  }, [productId, characteristicSections.length, loadCharacteristics, mode])

  // Синхронизируем selectedCharacteristics с initialCharacteristics при их изменении
  useEffect(() => {
    if (initialCharacteristics && initialCharacteristics.length > 0) {
      // Проверяем, действительно ли изменились характеристики, чтобы избежать лишних обновлений
      setSelectedCharacteristics(prev => {
        if (JSON.stringify(prev) === JSON.stringify(initialCharacteristics)) {
          return prev
        }
        return initialCharacteristics
      })
    }
  }, [initialCharacteristics])

  // Используем разделы напрямую из API, так как они уже содержат правильную структуру
  const availableSections = useMemo(() => characteristicSections.map(section => {
    const sectionGroups = section.groups.map(sectionGroup => {
      // Если у группы уже есть values (из API), используем их
      if (sectionGroup.values) {
        return {
          group_id: sectionGroup.group_id,
          group_name: sectionGroup.group_name,
          group_sort_order: sectionGroup.group_sort_order,
          values: sectionGroup.values
        }
      }

      // Иначе ищем в availableCharacteristics
      const availableGroup = Array.isArray(availableCharacteristics) ? availableCharacteristics.find(ag => ag.group_name === sectionGroup.group_name) : null
      if (availableGroup) {
        return {
          group_id: availableGroup.group_id,
          group_name: availableGroup.group_name,
          group_sort_order: availableGroup.group_sort_order,
          values: availableGroup.values
        }
      }

      // Если не найдено, все равно показываем группу с пустыми values
      return {
        group_id: sectionGroup.group_id,
        group_name: sectionGroup.group_name,
        group_sort_order: sectionGroup.group_sort_order,
        values: []
      }
    })

    return {
      ...section,
      groups: sectionGroups
    }
  }), [characteristicSections, availableCharacteristics]) // Показываем все разделы, включая пустые

  // console.log('🔍 CompactCharacteristics: availableSections:', availableSections)

  // Обновляем ref при изменении selectedCharacteristics
  useEffect(() => {
    selectedCharacteristicsRef.current = selectedCharacteristics
  }, [selectedCharacteristics])

  // Уведомляем родительский компонент об изменениях характеристик
  useEffect(() => {
    // Пропускаем первоначальную загрузку
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      previousCharacteristicsRef.current = selectedCharacteristics
      return
    }

    // Проверяем, действительно ли изменились характеристики
    const hasChanged = JSON.stringify(previousCharacteristicsRef.current) !== JSON.stringify(selectedCharacteristics)

    if (hasChanged) {
      // Вызываем onSave асинхронно, чтобы избежать обновления компонента во время рендера
      setTimeout(() => {
        onSave?.(selectedCharacteristics)
      }, 0)
      previousCharacteristicsRef.current = selectedCharacteristics
    }
  }, [selectedCharacteristics, onSave])

  // Закрытие выпадающего меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownGroup(null)
        setDropdownPosition(null)
        setDropdownSearchTerm('')
      }
    }

    if (openDropdownGroup !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => { } // Пустая функция очистки если условие не выполнено
  }, [openDropdownGroup])

  // Отмена редактирования при клике вне области редактирования
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Проверяем, что клик не по элементам редактирования
      const target = event.target as HTMLElement
      const isEditingArea = target.closest('.editing-area') ||
        target.closest('input') ||
        target.closest('button')

      if (editingCharacteristic !== null && !isEditingArea) {
        cancelEditing()
      }
    }

    if (editingCharacteristic !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => { } // Пустая функция очистки если условие не выполнено
  }, [editingCharacteristic])

  // Закрытие выпадающего меню добавления при клике вне области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setOpenAddDropdownGroup(null)
        setAddDropdownPosition(null)
      }
    }

    if (openAddDropdownGroup !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => { } // Пустая функция очистки если условие не выполнено
  }, [openAddDropdownGroup])

  // Фокус на поле поиска при открытии выпадающего меню
  useEffect(() => {
    if (openDropdownGroup !== null && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [openDropdownGroup])

  // Очистка таймера при размонтировании компонента

  const toggleCharacteristic = (value: CharacteristicValue, group: CharacteristicGroup) => {
    const isSelected = Array.isArray(selectedCharacteristics) && selectedCharacteristics.some(c => c.value_id === value.id)

    if (isSelected) {
      setSelectedCharacteristics(prev => {
        const filtered = prev.filter(c => c.value_id !== value.id)
        // Проверяем, действительно ли что-то изменилось
        return filtered.length !== prev.length ? filtered : prev
      })
    } else {
      const newChar: SelectedCharacteristic = {
        value_id: value.id,
        value_name: value.value,
        group_id: group.group_id,
        group_name: group.group_name,
        additional_value: '',
        color_hex: value.color_hex
      }
      setSelectedCharacteristics(prev => {
        // Проверяем, не добавлена ли уже эта характеристика
        if (prev.some(c => c.value_id === value.id)) {
          return prev
        }
        return [...prev, newChar]
      })
    }
  }

  const toggleGroupDropdown = (groupId: number, event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()

    if (openDropdownGroup === groupId) {
      setOpenDropdownGroup(null)
      setDropdownPosition(null)
      setDropdownSearchTerm('')
    } else {
      const rect = event.currentTarget.getBoundingClientRect()
      const containerRect = event.currentTarget.closest('.space-y-4')?.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const dropdownHeight = 300 // Примерная высота выпадающего меню

      // Определяем, показывать ли меню сверху или снизу
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      setDropdownPosition({
        top: showAbove
          ? rect.top - (containerRect?.top || 0) - dropdownHeight - 8
          : rect.bottom - (containerRect?.top || 0) + 8,
        left: rect.left - (containerRect?.left || 0),
        width: rect.width
      })
      setOpenDropdownGroup(groupId)
      setDropdownSearchTerm('')
    }
  }

  const toggleAddDropdown = (groupId: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (openAddDropdownGroup === groupId) {
      setOpenAddDropdownGroup(null)
      setAddDropdownPosition(null)
    } else {
      const rect = event.currentTarget.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const dropdownHeight = 300

      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      const position = {
        top: showAbove
          ? rect.top - dropdownHeight - 8
          : rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 280)
      }

      setAddDropdownPosition(position)
      setOpenAddDropdownGroup(groupId)
    }
  }

  const _updateAdditionalValue = useCallback((valueId: number, additionalValue: string) => {
    // Если сейчас идет inline-редактирование, пропускаем
    if (editingCharacteristic !== null) {
      return
    }

    // Обновляем локальное состояние немедленно
    setSelectedCharacteristics(prev => {
      const updated = prev.map(char =>
        char.value_id === valueId ? { ...char, additional_value: additionalValue } : char
      )

      return updated
    })

            // Для новых товаров (без productId) сохраняем только в локальное состояние
    // Сохранение в БД произойдет при создании товара
  }, [productId, editingCharacteristic])

  const removeCharacteristic = (valueId: number) => {
    setSelectedCharacteristics(prev => {
      const filtered = prev.filter(c => c.value_id !== valueId)
      // Проверяем, действительно ли что-то изменилось
      return filtered.length !== prev.length ? filtered : prev
    })
  }

  const startEditing = (valueId: number, currentValue: string) => {
    setEditingCharacteristic(valueId)
    setEditValue(currentValue || '')
  }

  const cancelEditing = () => {
    setEditingCharacteristic(null)
    setEditValue('')
  }

  const saveEdit = (valueId: number) => {
    // Обновляем только локальное состояние без сохранения в БД
    if (!Array.isArray(selectedCharacteristics)) {
      setEditingCharacteristic(null)
      setEditValue('')
      return
    }

    const updatedCharacteristics = selectedCharacteristics.map(char =>
      char.value_id === valueId ? { ...char, additional_value: editValue } : char
    )

        // Проверяем, действительно ли что-то изменилось
    const hasChanged = Array.isArray(selectedCharacteristics) && selectedCharacteristics.some(char =>
      char.value_id === valueId && char.additional_value !== editValue
    )

    if (hasChanged) {
      setSelectedCharacteristics(updatedCharacteristics)
    }
    setEditingCharacteristic(null)
    setEditValue('')
  }

  const createNewCharacteristic = async () => {
    if (!newCharacteristicValue.trim() || !createGroupName) {
      toast({
        title: "Ошибка",
        description: "Введите название характеристики",
        variant: "destructive"
      })
      return
    }

    try {
      // Создаем новую характеристику с временным ID (отрицательное число)
      const tempId = -Date.now() // Временный ID для UI (отрицательный)
      const newChar: SelectedCharacteristic = {
        value_id: tempId,
        value_name: newCharacteristicValue.trim(),
        group_id: createGroupId,
        group_name: createGroupName,
        additional_value: '',
        color_hex: undefined
      }

      // Добавляем в выбранные характеристики
      setSelectedCharacteristics(prev => {
        // Проверяем, не добавлена ли уже эта характеристика
        if (prev.some(c => c.value_id === tempId)) {
          return prev
        }
        return [...prev, newChar]
      })

      // Закрываем диалог и очищаем поля
      setShowCreateDialog(false)
      setNewCharacteristicValue('')
      setCreateGroupName('')
      setCreateGroupId(0)

      toast({
        title: "Успешно",
        description: `Характеристика "${newCharacteristicValue}" добавлена в группу "${createGroupName}"`
      })
    } catch (error) {
      console.error('Ошибка создания характеристики:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось создать характеристику",
        variant: "destructive"
      })
    }
  }

  // Открыть диалог создания группы в разделе
  const openGroupDialog = (sectionId: number, sectionName: string) => {
    setGroupDialogParent(sectionId)
    setGroupDialogSectionName(sectionName)
    setIsGroupDialogOpen(true)
    setNewGroupName('')
    setNewGroupDesc('')
    setGroupDialogError('')
  }

  // Создать группу
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setGroupDialogError('Название обязательно')
      return
    }

    // Проверяем, что создаем группу в разделе (не в другой группе)
    if (groupDialogParent) {
      const parentSection = Array.isArray(characteristicSections) ? characteristicSections.find(s => s.section_id === groupDialogParent) : null
      if (!parentSection) {
        setGroupDialogError('Родительский раздел не найден')
        return
      }
      // Дополнительная проверка: убеждаемся, что parent_id указывает на раздел
      // console.log('Создаем группу в разделе:', groupDialogParent, 'Название раздела:', parentSection.section_name)
    } else {
      // console.log('Создаем корневую группу (без родителя)')
    }

    setGroupDialogLoading(true)
    setGroupDialogError('')
    try {
      const res = await fetch('/api/characteristics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || undefined,
          parent_id: groupDialogParent,
          is_section: false
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsGroupDialogOpen(false)
        setNewGroupName('')
        setNewGroupDesc('')
        setGroupDialogParent(null)
        setGroupDialogSectionName('')
        await loadCharacteristics()
        toast({ title: 'Группа создана', description: data.message || '' })
      } else {
        setGroupDialogError(data.error || 'Ошибка создания группы')
      }
    } catch (_e) {
      setGroupDialogError('Ошибка соединения с сервером')
    } finally {
      setGroupDialogLoading(false)
    }
  }

  // Открыть диалог создания значения для группы
  const openValueDialog = (groupId: number) => {
    setValueDialogGroup(groupId)
    setIsValueDialogOpen(true)
    setNewValueName('')
    setNewValueColor('')
    setValueDialogError('')
  }

  // Создать значение
  const handleCreateValue = async () => {
    if (!newValueName.trim() || !valueDialogGroup) {
      setValueDialogError('Название и группа обязательны')
      return
    }

    // Проверяем, что создаем значение в группе (не в разделе)
    const targetGroup = Array.isArray(availableCharacteristics) ? availableCharacteristics.find(g => g.group_id === valueDialogGroup) : null
    if (!targetGroup) {
      setValueDialogError('Группа не найдена')
      return
    }

    setValueDialogLoading(true)
    setValueDialogError('')
    try {
      const res = await fetch('/api/characteristics/values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: valueDialogGroup,
          value: newValueName.trim(),
          color_hex: newValueColor.trim() || null
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsValueDialogOpen(false)
        setNewValueName('')
        setNewValueColor('')
        setValueDialogGroup(null)
        await loadCharacteristics()
        toast({ title: 'Характеристика создана', description: data.message || '' })
      } else {
        setValueDialogError(data.error || 'Ошибка создания характеристики')
      }
    } catch (_e) {
      setValueDialogError('Ошибка соединения с сервером')
    } finally {
      setValueDialogLoading(false)
    }
  }

  // Группируем выбранные характеристики по разделам и группам
  const sectionsWithSelected = useMemo(() => {
    return characteristicSections.map(section => {
      const sectionGroups = section.groups.map(group => {
        const groupCharacteristics = Array.isArray(selectedCharacteristics) ? selectedCharacteristics.filter(char => char.group_id === group.group_id) : []
        return {
          ...group,
          characteristics: groupCharacteristics
        }
      }).filter(group => group.characteristics.length > 0)

      return {
        ...section,
        groups: sectionGroups
      }
    }).filter(section => section.groups.length > 0)
  }, [characteristicSections, selectedCharacteristics])

  const _groupedSelected = useMemo(() => Array.isArray(selectedCharacteristics) ? selectedCharacteristics.reduce((acc, char) => {
    const groupName = char.group_name
    if (!acc[groupName]) acc[groupName] = []
    acc[groupName].push(char)
    return acc
  }, {} as Record<string, SelectedCharacteristic[]>) : {}, [selectedCharacteristics])

  if (loading) {
    return (
      <div className="text-center py-8 space-y-2">
        <div className="w-6 h-6 animate-spin mx-auto border-2 border-primary border-t-transparent rounded-full"></div>
        <div className="text-sm text-muted-foreground">Загрузка характеристик...</div>
      </div>
    )
  }

  // Если вкладка не активна и данные еще не загружены, показываем минимальный контент
  if (!isActive && !characteristicSections.length) {
    return (
      <div className="text-center py-8 space-y-2">
        <div className="text-sm text-muted-foreground">Переключитесь на вкладку для загрузки характеристик</div>
      </div>
    )
  }

          // Для новых товаров (без productId) показываем интерфейс, но с ограниченной функциональностью
  const isNewProduct = !productId

  return (
    <div className="space-y-6">
              {/* Информационное сообщение */}
      {mode === 'configurable' ? (
        <div className="border rounded-lg bg-purple-50 border-purple-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Tag className="w-3 h-3 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-purple-900 text-sm mb-1">Настройка конфигурируемых характеристик</h4>
              <p className="text-purple-700 text-xs leading-relaxed">
                Выберите характеристики, которые покупатель сможет настроить при заказе товара. Эти характеристики будут отображаться в блоке конфигурации на странице товара.
              </p>
            </div>
          </div>
        </div>
      ) : isNewProduct ? (
        <div className="border rounded-lg bg-blue-50 border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Package className="w-3 h-3 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900 text-sm mb-1">Настройка характеристик для нового товара</h4>
              <p className="text-blue-700 text-xs leading-relaxed">
                Вы можете выбрать характеристики для нового товара. Они будут сохранены вместе с информацией при создании товара.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Панель выбранных характеристик */}
      {Array.isArray(selectedCharacteristics) && selectedCharacteristics.length > 0 && (
        <div className="border rounded-lg bg-card shadow-sm">
          <div className="border-b bg-muted/50 px-3 sm:px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Выбранные характеристики</h3>
                              <Badge variant="outline" className="text-xs">
                  {Array.isArray(selectedCharacteristics) ? selectedCharacteristics.length : 0} из {Array.isArray(availableCharacteristics) ? availableCharacteristics.reduce((acc, group) => acc + (group.values?.length || 0), 0) : 0}
                </Badge>
            </div>
          </div>
          

          <div className="p-3 sm:p-4 bg-muted/20">
            {/* Адаптивное отображение характеристик */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {sectionsWithSelected.map((section, sectionIndex) => (
                <div key={section.section_id} className="space-y-3">
                  {/* Заголовок раздела */}
                  <h4 className="font-semibold text-sm text-foreground border-b pb-2">
                    {section.section_name}:
                  </h4>

                  {/* Характеристики сгруппированные по группам */}
                  <div className="space-y-2">
                    {section.groups.map((group, groupIndex) => {
                      // Фильтруем характеристики для текущей группы из общего списка выбранных
                      const groupCharacteristics = selectedCharacteristics.filter(
                        char => char.group_id === group.group_id
                      )
                      
                      // Пропускаем пустые группы
                      if (!groupCharacteristics || groupCharacteristics.length === 0) {
                        return null
                      }

                      return (
                        <div key={`section-${sectionIndex}-group-${groupIndex}-${group.group_id}`} className="flex flex-col sm:flex-row sm:items-start gap-2 py-2 px-2 hover:bg-muted/40 rounded transition-colors">
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-xs sm:text-sm text-muted-foreground font-medium">{group.group_name}:</span>
                            {!readonly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => toggleAddDropdown(group.group_id, e)}
                                className="h-5 w-5 sm:h-4 sm:w-4 p-0 text-muted-foreground hover:text-primary"
                                title={`Добавить характеристику в группу "${group.group_name}"`}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                            {groupCharacteristics.map((char, index) => {
                              // Проверяем наличие значения
                              const displayValue = char.value_name || char.value || char.text_value || char.enum_value_name || '-';
                              
                              return (
                              <span key={`char-${char.value_id}-${index}`} className="inline-flex items-center gap-1">
                                {char.color_hex && (
                                  <div
                                    className="w-2 h-2 sm:w-3 sm:h-3 rounded-full border border-border flex-shrink-0"
                                    style={{ backgroundColor: char.color_hex }}
                                  />
                                )}
                                {editingCharacteristic === char.value_id ? (
                                  <div className="inline-flex items-center gap-1 bg-muted/70 px-2 py-1 rounded editing-area">
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      placeholder={char.value_name}
                                      className="h-7 sm:h-6 text-xs w-20 sm:w-24 min-w-0"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveEdit(char.value_id)
                                        } else if (e.key === 'Escape') {
                                          cancelEditing()
                                        }
                                      }}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => saveEdit(char.value_id)}
                                      className="h-6 w-6 sm:h-5 sm:w-5 p-0 text-green-600 hover:text-green-700"
                                    >
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeCharacteristic(char.value_id)}
                                      className="h-6 w-6 sm:h-5 sm:w-5 p-0 text-red-600 hover:text-red-700"
                                      title="Удалить характеристику"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelEditing}
                                      className="h-6 w-6 sm:h-5 sm:w-5 p-0 text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span
                                    className="text-xs sm:text-sm font-medium cursor-pointer hover:bg-muted/60 px-1.5 py-1 sm:px-1 sm:py-0.5 rounded transition-colors break-words"
                                    onClick={() => startEditing(char.value_id, char.additional_value)}
                                    onDoubleClick={() => removeCharacteristic(char.value_id)}
                                    title={`Клик - редактировать, двойной клик - удалить ${displayValue}`}
                                  >
                                    {displayValue}
                                    {char.additional_value && (
                                      <span className="text-muted-foreground"> ({char.additional_value})</span>
                                    )}
                                  </span>
                                )}
                                {index < groupCharacteristics.length - 1 && editingCharacteristic !== char.value_id && (
                                  <span className="text-xs text-muted-foreground">,</span>
                                )}
                              </span>
                            )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Панель выбора характеристик */}
      <div className="border rounded-lg bg-card shadow-sm">
        <div className="border-b bg-muted/50 px-3 sm:px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Добавить характеристики</h3>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-muted/20">
          <div className="space-y-4 relative">
            {availableSections.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Package className="w-8 h-8 text-muted-foreground mx-auto" />
                <div className="text-sm text-muted-foreground">Нет доступных характеристик</div>
                <div className="text-xs text-muted-foreground">Характеристики появятся после настройки шаблонов</div>
              </div>
            ) : (
              <div className="space-y-4">
                {availableSections.map((section, sectionIndex) => (
                  <div key={section.section_id} className="border rounded-lg bg-background">
                    <div className="text-sm py-3 px-3 sm:px-4 bg-muted/40 border-b">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Package className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-semibold truncate">{section.section_name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">{section.section_description}</div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {section.groups.reduce((acc, group) => acc + group.values.length, 0)} хар-к
                          </Badge>
                          {!readonly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openGroupDialog(section.section_id, section.section_name)
                              }}
                              className="h-7 w-7 sm:h-6 sm:w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title={`Создать новую группу в разделе "${section.section_name}"`}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-background">
                      {section.groups.length === 0 ? (
                        <div className="text-center py-8 space-y-4">
                          <Layers className="w-8 h-8 text-muted-foreground mx-auto" />
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">В этом разделе пока нет групп характеристик</div>
                            <div className="text-xs text-muted-foreground">Создайте первую группу для добавления характеристик</div>
                          </div>
                          {!readonly && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openGroupDialog(section.section_id, section.section_name)}
                              className="text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Создать группу
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {section.groups.map((group, groupIndex) => {
                            const selectedCount = group.values.filter(v => Array.isArray(selectedCharacteristics) && selectedCharacteristics.some(s => s.value_id === v.id)).length

                            return (
                              <div key={`section-${sectionIndex}-group-${groupIndex}-${group.group_id}`} className="relative">
                                <div
                                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer bg-card touch-manipulation"
                                  onClick={(e) => toggleGroupDropdown(group.group_id, e)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                      <span className="font-medium text-sm truncate">{group.group_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                      <Badge variant={selectedCount > 0 ? "default" : "outline"} className="text-xs whitespace-nowrap">
                                        {selectedCount}/{group.values.length}
                                      </Badge>
                                      {!readonly && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openValueDialog(group.group_id)
                                          }}
                                          className="h-6 w-6 sm:h-5 sm:w-5 p-0 text-blue-600 hover:text-blue-700 touch-manipulation"
                                          title={`Добавить характеристику в группу "${group.group_name}"`}
                                        >
                                          <Plus className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Выпадающее меню характеристик - адаптивное позиционирование */}
            {openDropdownGroup !== null && dropdownPosition && (
              <div
                ref={dropdownRef}
                className="absolute z-50 bg-background border rounded-lg shadow-lg"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  minWidth: Math.min(dropdownPosition.width, window.innerWidth - 32),
                  maxWidth: Math.min(400, window.innerWidth - 32),
                  right: dropdownPosition.left + 400 > window.innerWidth ? 16 : 'auto'
                }}
              >
                {(() => {
                  const group = availableCharacteristics.find(g => g.group_id === openDropdownGroup)
                  if (!group) return null

                  // Фильтруем характеристики по поисковому запросу
                  const filteredValues = group.values.filter(value =>
                    value.value.toLowerCase().includes(dropdownSearchTerm.toLowerCase())
                  )

                  return (
                    <div className="p-3 sm:p-4">
                      <div className="text-sm font-medium mb-3 border-b pb-2 truncate">
                        {group.group_name}
                      </div>

                      {/* Поле поиска */}
                      <div className="relative mb-3">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-3 sm:h-3 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          value={dropdownSearchTerm}
                          onChange={(e) => setDropdownSearchTerm(e.target.value)}
                          placeholder="Поиск характеристик..."
                          className="pl-8 sm:pl-7 h-9 sm:h-8 text-sm sm:text-xs"
                        />
                      </div>

                      {/* Список характеристик */}
                      <div className="space-y-2 max-h-60 sm:max-h-48 overflow-y-auto">
                        {filteredValues.length === 0 ? (
                          <div className="text-sm sm:text-xs text-muted-foreground text-center py-4">
                            {dropdownSearchTerm ? 'Ничего не найдено' : 'Нет характеристик'}
                          </div>
                        ) : (
                          filteredValues.map(value => {
                            const isSelected = Array.isArray(selectedCharacteristics) && selectedCharacteristics.some(c => c.value_id === value.id)

                            return (
                              <div key={`dropdown-value-${value.id}`} className="flex items-center space-x-2 text-sm sm:text-xs hover:bg-muted/30 p-2.5 sm:p-2 rounded touch-manipulation">
                                <Checkbox
                                  id={`dropdown-char-${value.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleCharacteristic(value, group)}
                                  className="h-4 w-4 sm:h-3 sm:w-3 flex-shrink-0"
                                  disabled={readonly}
                                />
                                <label
                                  htmlFor={`dropdown-char-${value.id}`}
                                  className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                                >
                                  {value.color_hex && (
                                    <div
                                      className="w-4 h-4 sm:w-3 sm:h-3 rounded-full border border-border flex-shrink-0"
                                      style={{ backgroundColor: value.color_hex }}
                                    />
                                  )}
                                  <span className={`truncate ${isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                    {value.value}
                                  </span>
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Выпадающее меню добавления характеристик - адаптивное позиционирование */}
            {openAddDropdownGroup !== null && addDropdownPosition && (
              <div
                ref={addDropdownRef}
                className="fixed z-50 bg-background border rounded-lg shadow-lg"
                style={{
                  top: addDropdownPosition.top,
                  left: Math.max(16, Math.min(addDropdownPosition.left, window.innerWidth - 320)),
                  minWidth: Math.min(addDropdownPosition.width, window.innerWidth - 32),
                  maxWidth: Math.min(400, window.innerWidth - 32),
                  right: addDropdownPosition.left + 400 > window.innerWidth ? 16 : 'auto'
                }}
              >
                {(() => {
                  // Найдем группу в доступных характеристиках
                  let targetGroup: CharacteristicGroup | null = null
                  let targetGroupName = ''

                  // Ищем группу ТОЛЬКО в правильно организованных разделах characteristicSections
                  // Это гарантирует, что мы найдем группу в правильном контексте раздела
                  for (const section of characteristicSections) {
                    for (const group of section.groups) {
                      if (group.group_id === openAddDropdownGroup) {
                        targetGroup = group
                        targetGroupName = group.group_name
                        break
                      }
                    }
                    if (targetGroup) break
                  }

                  // Fallback: если не найдено в sections, поищем в availableCharacteristics
                  if (!targetGroup) {
                    for (const group of availableCharacteristics) {
                      if (group.group_id === openAddDropdownGroup) {
                        targetGroup = group
                        targetGroupName = group.group_name
                        break
                      }
                    }
                  }

                  // Проверяем наличие характеристик в группе (может быть values или characteristics)
                  const groupValues = targetGroup?.values || (targetGroup as any)?.characteristics || []

                  if (!targetGroup || !Array.isArray(selectedCharacteristics)) {
                    return null
                  }

                  // Получаем характеристики, которые еще не выбраны
                  const availableValues = groupValues.filter((value: any) => {
                    const valueId = value.id || value.value_id || value.characteristic_id
                    const isSelected = Array.isArray(selectedCharacteristics) && selectedCharacteristics.some(selected => selected.value_id === valueId)
                    return !isSelected
                  })

                  // Показываем опцию создания новой характеристики даже если все уже добавлены
                  const hasAvailableValues = availableValues.length > 0

                  return (
                    <div className="p-3 max-h-80 overflow-y-auto">
                      <div className="text-sm font-medium mb-3 border-b pb-2">
                        Добавить в &quot;{targetGroupName}&quot;
                      </div>

                      <div className="space-y-1">
                        {/* Кнопка создания новой характеристики */}
                        <div
                          className="flex items-center gap-2 p-2 hover:bg-primary/10 rounded cursor-pointer transition-colors border border-dashed border-primary/30"
                          onClick={() => {
                            setCreateGroupName(targetGroupName)
                            setCreateGroupId(targetGroup?.group_id || 0)
                            setShowCreateDialog(true)
                            setTimeout(() => {
                              setOpenAddDropdownGroup(null)
                              setAddDropdownPosition(null)
                            }, 0)
                          }}
                        >
                          <Plus className="w-4 h-4 text-primary" />
                          <span className="text-sm text-primary font-medium">Создать новую характеристику</span>
                        </div>

                        {/* Разделитель если есть доступные характеристики */}
                        {hasAvailableValues && (
                          <div className="border-t pt-2 mt-2">
                            <div className="text-xs text-muted-foreground mb-2">Существующие характеристики:</div>
                          </div>
                        )}

                        {/* Существующие характеристики */}
                        {hasAvailableValues ? availableValues.map((value: any) => (
                          <div
                            key={value.id || value.value_id}
                            className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer transition-colors"
                            onClick={() => {
                              const charValue = {
                                id: value.id || value.value_id,
                                value: value.value || value.value_name,
                                color_hex: value.color_hex,
                                sort_order: value.sort_order || 0,
                                is_selected: false
                              }
                              toggleCharacteristic(charValue, targetGroup!)
                              setTimeout(() => {
                                setOpenAddDropdownGroup(null)
                                setAddDropdownPosition(null)
                              }, 0)
                            }}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              {value.color_hex && (
                                <div
                                  className="w-3 h-3 rounded-full border border-border flex-shrink-0"
                                  style={{ backgroundColor: value.color_hex }}
                                />
                              )}
                              <span className="text-sm truncate">{value.value || value.value_name}</span>
                            </div>
                            <Plus className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )) : (
                          <div className="text-xs text-muted-foreground text-center py-2">
                            Все характеристики уже добавлены
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

              {/* Информация для новых товаров */}
      {!readonly && isNewProduct && Array.isArray(selectedCharacteristics) && selectedCharacteristics.length > 0 && (
        <div className="flex items-center justify-center pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Package className="w-4 h-4" />
            <span>Характеристики будут сохранены при создании товара</span>
          </div>
        </div>
      )}

      {/* Диалог создания новой характеристики */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md max-w-[95vw] mx-4">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Создать новую характеристику</DialogTitle>
            <DialogDescription>
              Создание новой характеристики в выбранной группе
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Группа</label>
              <Input
                value={createGroupName}
                onChange={(e) => setCreateGroupName(e.target.value)}
                placeholder="Название группы"
                disabled
                className="bg-muted h-10 sm:h-9"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Название характеристики</label>
              <Input
                value={newCharacteristicValue}
                onChange={(e) => setNewCharacteristicValue(e.target.value)}
                placeholder="Введите название характеристики"
                autoFocus
                className="h-10 sm:h-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createNewCharacteristic()
                  }
                }}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setNewCharacteristicValue('')
                setCreateGroupName('')
                setCreateGroupId(0)
              }}
              className="h-10 sm:h-9"
            >
              Отмена
            </Button>
            <Button
              onClick={createNewCharacteristic}
              disabled={!newCharacteristicValue.trim()}
              className="h-10 sm:h-9"
            >
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог создания группы */}
      {isGroupDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-base sm:text-lg font-bold mb-2">Создать группу характеристик</h2>
            {groupDialogSectionName && (
              <p className="text-sm text-muted-foreground mb-4">
                В разделе: <span className="font-medium text-foreground">{groupDialogSectionName}</span>
              </p>
            )}
            <input
              className="border rounded px-3 py-2.5 sm:py-2 w-full mb-3 sm:mb-2 text-base sm:text-sm"
              placeholder="Название группы"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              disabled={groupDialogLoading}
            />
            <input
              className="border rounded px-3 py-2.5 sm:py-2 w-full mb-3 sm:mb-2 text-base sm:text-sm"
              placeholder="Описание (необязательно)"
              value={newGroupDesc}
              onChange={e => setNewGroupDesc(e.target.value)}
              disabled={groupDialogLoading}
            />
            {groupDialogError && <div className="text-red-600 text-sm mb-3 sm:mb-2">{groupDialogError}</div>}
            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsGroupDialogOpen(false)}
                disabled={groupDialogLoading}
                className="h-10 sm:h-9"
              >
                Отмена
              </Button>
              <Button
                onClick={handleCreateGroup}
                disabled={groupDialogLoading}
                className="h-10 sm:h-9"
              >
                {groupDialogLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Создание...
                  </>
                ) : (
                  'Создать'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Диалог создания значения */}
      {isValueDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-base sm:text-lg font-bold mb-2">Добавить характеристику</h2>
            <input
              className="border rounded px-3 py-2.5 sm:py-2 w-full mb-3 sm:mb-2 text-base sm:text-sm"
              placeholder="Название характеристики"
              value={newValueName}
              onChange={e => setNewValueName(e.target.value)}
              disabled={valueDialogLoading}
            />
            <input
              className="border rounded px-3 py-2.5 sm:py-2 w-full mb-3 sm:mb-2 text-base sm:text-sm"
              placeholder="HEX цвет (необязательно)"
              value={newValueColor}
              onChange={e => setNewValueColor(e.target.value)}
              disabled={valueDialogLoading}
            />
            {valueDialogError && <div className="text-red-600 text-sm mb-3 sm:mb-2">{valueDialogError}</div>}
            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsValueDialogOpen(false)}
                disabled={valueDialogLoading}
                className="h-10 sm:h-9"
              >
                Отмена
              </Button>
              <Button
                onClick={handleCreateValue}
                disabled={valueDialogLoading}
                className="h-10 sm:h-9"
              >
                {valueDialogLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Добавление...
                  </>
                ) : (
                  'Добавить'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Мемоизируем компонент для предотвращения лишних перерендеров
export const CompactCharacteristics = React.memo(CompactCharacteristicsComponent, (prevProps, nextProps) => {
  // Сравниваем только важные пропсы
  const propsEqual =
    prevProps.productId === nextProps.productId &&
    prevProps.readonly === nextProps.readonly &&
    prevProps.isActive === nextProps.isActive

  // Сравниваем характеристики только если основные пропсы равны
  if (!propsEqual) return false

  // Быстрое сравнение массивов характеристик
  const prevChars = prevProps.initialCharacteristics || []
  const nextChars = nextProps.initialCharacteristics || []

  if (prevChars.length !== nextChars.length) return false

  // Сравниваем только если массивы не пустые
  if (prevChars.length > 0) {
    return JSON.stringify(prevChars) === JSON.stringify(nextChars)
  }

  return true
})