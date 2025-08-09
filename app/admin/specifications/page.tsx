"use client";
import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { Plus, Edit, Trash2, Settings, Database, List, ChevronDown, ChevronRight, Zap, Edit2, Hash, Folder, FolderOpen, Package, Tag } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface SpecGroup {
  id: string | number
  name: string
  description?: string
  enum_count?: number
  enum_values?: SpecEnum[]
  sizes?: ProductSize[]
  parent_id?: string | number | null
  level?: number
  children?: SpecGroup[]
  source_type?: 'spec_group' | 'category'
  original_id?: number
  enums?: SpecEnum[]
  ordering?: number
  is_section?: boolean // Добавляем поле для определения раздела
  is_real_section?: boolean // Добавляем поле для определения реального раздела из БД
}

interface SpecEnum {
  id: number
  group_id: number
  value: string
  sort_order?: number
  ordering?: number  // Для обратной совместимости
  parent_id?: number
  color_value?: string   // Цвет характеристики (старое поле)
  color_hex?: string     // Новый цвет для API
  description?: string
  is_active?: boolean
}

interface ProductSize {
  id: number
  size_name: string
  size_value?: string
  sku?: string
  is_available: boolean
  product_name?: string
}

// Интерфейс для отображения характеристик
interface ProductCharacteristic {
  id: number
  product_id: number
  group_id: number
  characteristic_type: 'numeric' | 'text' | 'enum' | 'feature' | 'size'
  label?: string
  value_numeric?: number
  value_min?: number
  value_max?: number
  is_range?: boolean
  value_text?: string
  size_name?: string
  size_value?: string
  sku?: string
  feature_id?: number
  unit_id?: number
  created_at: string
  updated_at: string
  // Связанные данные
  unit_code?: string
  unit_name?: string
}

export default function SpecificationsAdmin() {
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([])
  const [productSizes, setProductSizes] = useState<ProductSize[]>([])
  const [productCharacteristics, setProductCharacteristics] = useState<ProductCharacteristic[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  // Диалоги
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [isEnumDialogOpen, setIsEnumDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SpecGroup | null>(null)
  const [editingEnum, setEditingEnum] = useState<SpecEnum | null>(null)
  const [isCreatingSection, setIsCreatingSection] = useState(false) // Флаг для создания раздела

  // Состояния для удаления
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteInfo, setDeleteInfo] = useState<any>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | number | null>(null)

  // Формы
  const [groupFormData, setGroupFormData] = useState({
    name: "",
    description: "",
    parent_id: undefined as number | undefined,
    is_section: false // Добавляем флаг раздела
  })

  // Форма для enum значений
  const [enumFormData, setEnumFormData] = useState({
    groupId: 0,
    value: "",
    ordering: 0,
    color_value: ""
  })

  // Состояние для раскрытых групп
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Добавляю новые состояния для управления отображением
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // В начало компонента
  const [forceDeleteInfo, setForceDeleteInfo] = useState<{id: number, usage: number} | null>(null)
  const [isForceDialogOpen, setIsForceDialogOpen] = useState(false)

  // Функция для получения цвета (приоритет - color_hex из БД)
  const getColorValue = (enumValue: SpecEnum): string => {
    // Если есть color_hex в БД - используем его
    if (enumValue.color_hex) {
      return enumValue.color_hex
    }

    // Фолбэк на старую карту цветов для совместимости
    const colorMap: { [key: string]: string } = {
      'телесный': '#D1D5DB',
      'черный матовый': '#1F1F1F',
      'белый глянцевый': '#FFFFFF',
      'серебристый металлик': '#B8B8B8',
      'синий': '#2563EB',
      'красный': '#6B7280',
      'зеленый': '#16A34A',
      'прозрачный': 'rgba(255,255,255,0.4)',
      'камуфляж': '#8B7355',
      'под заказ': 'linear-gradient(45deg, #E5E7EB, #F3F4F6, #F9FAFB, #E5E7EB, #D1D5DB)',
      'коричневый': '#8B4513',
      'желтый': '#9CA3AF',
      'фиолетовый': '#7C3AED',
      'оранжевый': '#9CA3AF',
      'розовый': '#9CA3AF',
      'серый': '#6B7280',
      'золотой': '#D4AF37',
      'серебряный': '#C0C0C0'
    }

    const normalizedName = enumValue.value.toLowerCase().trim()
    return colorMap[normalizedName] || '#E5E7EB' // По умолчанию серый
  }

  // Загрузка данных
  const loadSpecGroups = async () => {
    try {

      const res = await fetch("/api/characteristics")

      if (res.ok) {
        const apiResponse = await res.json()
        const data = apiResponse.data || apiResponse

        // Новая структура API: { sections: [], available_characteristics: [], groups: [] }
        if (data.sections && Array.isArray(data.sections)) {

          // Извлекаем все группы из разделов и создаем плоский список
          const allGroups: any[] = []

          data.sections.forEach((section: any) => {
// Добавляем сам раздел как группу
            allGroups.push({
              id: section.section_id,
              name: section.section_name,
              description: section.section_description,
              parent_id: null,
              is_section: true,
              ordering: section.section_ordering || 0,
              enums: [],
              enum_values: [],
              children: [],
              is_real_section: section.is_real_section !== false // Все разделы реальные, кроме "Дополнительных характеристик"
            })

            // Добавляем группы из раздела
            if (section.groups && Array.isArray(section.groups)) {
              section.groups.forEach((group: any) => {
allGroups.push({
                  id: group.group_id,
                  name: group.group_name,
                  description: group.description || '',
                  parent_id: section.section_id, // Привязываем к разделу
                  is_section: false,
                  ordering: group.group_ordering || 0,
                  enums: group.values || [],
                  enum_values: group.values || [],
                  children: []
                })
              })
            }
          })

          const hierarchicalGroups = processHierarchicalGroups(allGroups)
          setSpecGroups(hierarchicalGroups)

        } else if (Array.isArray(data)) {
          // Старая структура: плоский массив групп

          const hierarchicalGroups = processHierarchicalGroups(data)
          setSpecGroups(hierarchicalGroups)

        } else {
          console.error("❌ Unknown data structure:", data)
          toast({
            title: "Ошибка",
            description: "Неизвестная структура данных от API",
            variant: "destructive"
          })
        }
      } else {
        const errorText = await res.text()
        console.error("❌ Failed to load spec groups:", res.status, errorText)
        toast({
          title: "Ошибка",
          description: `Не удалось загрузить группы характеристик: ${res.status}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("💥 Ошибка загрузки групп:", error)
      toast({
        title: "Ошибка",
        description: "Ошибка сетевого соединения при загрузке групп",
        variant: "destructive"
      })
    }
  }

  // Функция для обработки данных из API characteristics
  const processHierarchicalGroups = (groups: any[]): SpecGroup[] => {
    const processGroup = (group: any): SpecGroup => {
      // API возвращает "enums", но мы используем "enum_values" в интерфейсе
      const enumValues = group.enums || group.enum_values || []
      const enumCount = group.enum_values_count || enumValues.length || 0

      const processedGroup: SpecGroup = {
        id: group.id,
        name: group.name,
        description: group.description,
        enum_count: enumCount,
        enum_values: enumValues, // Используем данные из API
        enums: enumValues,       // Дублируем для совместимости
        parent_id: group.parent_id,
        level: 0, // Будет вычислен в buildHierarchy
        source_type: 'spec_group',
        original_id: typeof group.id === 'string' && group.id.startsWith('section_') ? group.id : group.id,
        ordering: group.ordering || 0,
        children: [],
        is_section: group.is_section || false // Добавляем флаг для определения раздела
      }

      return processedGroup
    }

    const processedGroups = groups.map(processGroup)

    // Строим иерархическую структуру из плоского списка
    return buildHierarchy(processedGroups)
  }

  // Функция для построения иерархической структуры
  const buildHierarchy = (flatGroups: SpecGroup[]): SpecGroup[] => {

    // Логируем все группы для отладки
    flatGroups.forEach(group => {
})

    // Создаем карту групп по ID для быстрого поиска
    const groupMap = new Map<string | number, SpecGroup>()
    flatGroups.forEach(group => {
      groupMap.set(group.id, { ...group, children: [] })
    })

    const rootGroups: SpecGroup[] = []

    // Строим дерево, устанавливая связи parent-child
    flatGroups.forEach(group => {
      const currentGroup = groupMap.get(group.id)!

      if (group.parent_id && groupMap.has(group.parent_id)) {
        // Это дочерняя группа
        const parentGroup = groupMap.get(group.parent_id)!
        if (!parentGroup.children) {
          parentGroup.children = []
        }
        parentGroup.children.push(currentGroup)
} else {
        // Это корневая группа
        rootGroups.push(currentGroup)
}
    })

    // Сортируем группы по ordering
    const sortGroups = (groups: SpecGroup[]) => {
      groups.sort((a, b) => (a.ordering || 0) - (b.ordering || 0))
      groups.forEach(group => {
        if (group.children && group.children.length > 0) {
          sortGroups(group.children)
        }
      })
    }

    sortGroups(rootGroups)

    // Устанавливаем уровни рекурсивно
    const setLevels = (groups: SpecGroup[], level: number = 0) => {
      groups.forEach(group => {
        group.level = level

        if (group.children && group.children.length > 0) {
          setLevels(group.children, level + 1)
        }
      })
    }

    setLevels(rootGroups)

    // Логируем финальную структуру
    const logHierarchy = (groups: SpecGroup[], indent = '') => {
      groups.forEach(group => {
if (group.children && group.children.length > 0) {
          logHierarchy(group.children, indent + '  ')
        }
      })
    }

    logHierarchy(rootGroups)

    return rootGroups
  }

  const loadProductSizes = async () => {
    try {
      const res = await fetch("/api/product-sizes")
      if (res.ok) {
        const data = await res.json()
        setProductSizes(data)
      }
    } catch (error) {
      console.error("Ошибка загрузки размеров:", error)
    }
  }

  const loadProductCharacteristics = async () => {
    try {
      // API больше не используется, так как кастомные характеристики удалены
      setProductCharacteristics([])
    } catch (error) {
              console.error("Ошибка загрузки характеристик товаров:", error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        loadSpecGroups(),
        loadProductSizes(),
        loadProductCharacteristics()
      ])
      setLoading(false)
    }
    loadData()
  }, [])

  const resetGroupForm = () => {
    setEditingGroup(null)
    setIsCreatingSection(false)
    setGroupFormData({ name: "", description: "", parent_id: undefined, is_section: false })
  }

  // Функция для создания раздела
  const handleAddSection = () => {
    setEditingGroup(null)
    setIsCreatingSection(true)
    setGroupFormData({
      name: "",
      description: "",
      parent_id: undefined,
      is_section: true
    })
    setIsGroupDialogOpen(true)
  }

  // Функция для создания подгруппы
  const handleAddSubgroup = (parentGroup: SpecGroup) => {
    // Проверяем, что родительский элемент является разделом
    if (!parentGroup.is_section) {
      toast({
        title: "Ошибка",
        description: "Группы характеристик можно создавать только в разделах",
        variant: "destructive"
      })
      return
    }

    setEditingGroup(null)
    setIsCreatingSection(false)
    setGroupFormData({
      name: "",
      description: "",
      parent_id: typeof parentGroup.original_id === 'number'
        ? parentGroup.original_id
        : Number(parentGroup.id),
      is_section: false
    })
    setIsGroupDialogOpen(true)
  }

  const handleGroupSave = async () => {
    if (!groupFormData.name.trim()) {
      toast({
        title: "Ошибка",
        description: "Название группы обязательно",
        variant: "destructive"
      })
      return
    }

    try {
      const method = editingGroup ? "PUT" : "POST"

      // Определяем правильный ID и URL для запроса
      let editingId = null
      let url = "/api/characteristics"

      if (editingGroup) {
        if (editingGroup.is_section && editingGroup.id === 999999) {
          // Это раздел "Дополнительные характеристики" - не можем редактировать
          toast({
            title: "Ошибка",
            description: "Раздел 'Дополнительные характеристики' нельзя редактировать",
            variant: "destructive"
          })
          return
        } else if (typeof editingGroup.id === 'string' && editingGroup.id.startsWith('spec_')) {
          editingId = parseInt(editingGroup.id.replace('spec_', ''))
        } else {
          editingId = editingGroup.id
        }
        url = `/api/characteristics?id=${editingId}`
      }

      // Добавляем детальное логирование

      const requestBody = {
        name: groupFormData.name,
        description: groupFormData.description,
        parent_id: groupFormData.parent_id,
        is_section: groupFormData.is_section
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      })

      if (res.ok) {
        const responseData = await res.json()

        const isSubgroup = groupFormData.parent_id !== undefined
        const isSection = groupFormData.is_section
        toast({
          title: "Успешно",
          description: editingGroup
            ? (isSection ? "Раздел обновлен" : "Группа обновлена")
            : isSection
              ? "Раздел создан"
              : isSubgroup
                ? "Подгруппа создана"
                : "Группа создана"
        })
        setIsGroupDialogOpen(false)
        resetGroupForm()
        await loadSpecGroups()
      } else {
        const error = await res.json()

        toast({
          title: "Ошибка",
          description: error.error || "Ошибка сохранения",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("❌ Frontend: catch error:", error)
      toast({
        title: "Ошибка",
        description: "Ошибка сохранения группы",
        variant: "destructive"
      })
    }
  }

  const handleGroupEdit = (group: SpecGroup) => {
    setEditingGroup(group)
    setIsCreatingSection(group.is_section || false)
    setGroupFormData({
      name: group.name,
      description: group.description || "",
      parent_id: group.parent_id ? (typeof group.parent_id === 'string' && group.parent_id.startsWith('spec_')
        ? parseInt(group.parent_id.replace('spec_', ''))
        : typeof group.parent_id === 'number' ? group.parent_id : undefined
      ) : undefined,
      is_section: group.is_section || false
    })
    setIsGroupDialogOpen(true)
  }

  const handleGroupDelete = async (groupId: string | number) => {
    try {
      // Найдем группу, чтобы определить, можно ли её удалить
      const findGroupInHierarchy = (groups: SpecGroup[], id: string | number): SpecGroup | null => {
        for (const group of groups) {
          if (group.id === id) return group
          if (group.children) {
            const found = findGroupInHierarchy(group.children, id)
            if (found) return found
          }
        }
        return null
      }

      const groupToDelete = findGroupInHierarchy(specGroups, groupId)

      if (groupToDelete?.is_section && groupId === 999999) {
        // Это раздел "Дополнительные характеристики" - не можем удалить
        toast({
          title: "Ошибка",
          description: "Раздел 'Дополнительные характеристики' нельзя удалять",
          variant: "destructive"
        })
        return
      }

      // Получаем информацию о том, что будет удалено
      let actualId = groupId
      if (typeof groupId === 'string' && groupId.startsWith('spec_')) {
        actualId = parseInt(groupId.replace('spec_', ''))
      }

      const infoRes = await fetch(`/api/characteristics/delete-info?id=${actualId}`)
      if (!infoRes.ok) {
        const error = await infoRes.json()
        toast({
          title: "Ошибка",
          description: error.error || "Ошибка получения информации об удалении",
          variant: "destructive"
        })
        return
      }

      const info = await infoRes.json()

      // Если нет ничего, что может помешать удалению, удаляем сразу
      if (info.data.warnings.length === 0) {
        await performDelete(actualId, false)
        return
      }

      // Иначе показываем диалог с предупреждением
      setDeleteInfo(info.data)
      setDeletingGroupId(actualId)
      setIsDeleteDialogOpen(true)

    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка получения информации об удалении",
        variant: "destructive"
      })
    }
  }

  // Функция для фактического удаления
  const performDelete = async (groupId: string | number, force: boolean = false) => {
    try {
      const res = await fetch(`/api/characteristics?id=${groupId}${force ? '&force=true' : ''}`, {
        method: "DELETE"
      })

      if (res.ok) {
        const result = await res.json()
        toast({
          title: "Успешно",
          description: result.message || "Группа удалена"
        })
        await loadSpecGroups()
        setIsDeleteDialogOpen(false)
        setDeleteInfo(null)
        setDeletingGroupId(null)
      } else {
        const error = await res.json()
        toast({
          title: "Ошибка",
          description: error.error || "Ошибка удаления группы",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка удаления группы",
        variant: "destructive"
      })
    }
  }

  const toggleGroupExpansion = (groupId: string | number) => {
    const newExpanded = new Set(expandedGroups)
    const id = String(groupId)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedGroups(newExpanded)
  }

  // Функции для работы с enum значениями
  const resetEnumForm = () => {
    setEnumFormData({
      groupId: 0,
      value: "",
      ordering: 0,
      color_value: ""
    })
    setEditingEnum(null)
  }

  const handleEnumEdit = (enumValue: SpecEnum) => {
    setEnumFormData({
      groupId: enumValue.group_id,
      value: enumValue.value,
      ordering: enumValue.sort_order || enumValue.ordering || 0,
      color_value: enumValue.color_hex || ""
    })
    setEditingEnum(enumValue)
    setIsEnumDialogOpen(true)
  }

  const handleEnumSave = async () => {
    if (!enumFormData.value.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите значение характеристики",
        variant: "destructive"
      })
      return
    }

    try {
      const url = editingEnum
        ? `/api/characteristics/values?id=${editingEnum.id}`
        : "/api/characteristics/values"

      const method = editingEnum ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: enumFormData.groupId,
          value: enumFormData.value.trim(),
          sort_order: enumFormData.ordering,
          color_hex: enumFormData.color_value || null,
          description: enumFormData.value.trim()
        })
      })

      if (res.ok) {
        const response = await res.json()
        toast({
          title: "Успешно",
          description: response.message || (editingEnum ? "Характеристика обновлена" : "Характеристика создана")
        })
        setIsEnumDialogOpen(false)
        resetEnumForm()
        await loadSpecGroups()
      } else {
        const error = await res.json()
        toast({
          title: "Ошибка",
          description: error.error || "Ошибка сохранения",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка сохранения характеристики",
        variant: "destructive"
      })
    }
  }

  const handleEnumDelete = async (enumId: number) => {
    if (!confirm("Удалить эту характеристику?")) return

    try {
      const res = await fetch(`/api/characteristics/values?id=${enumId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        const response = await res.json()
        toast({
          title: "Успешно",
          description: response.message || "Характеристика удалена"
        })
        await loadSpecGroups()
      } else {
        const error = await res.json()
        if (error.can_force_delete && error.usage_count) {
          setForceDeleteInfo({id: enumId, usage: error.usage_count})
          setIsForceDialogOpen(true)
        } else {
          toast({
            title: "Ошибка",
            description: error.error || "Ошибка удаления",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка удаления характеристики",
        variant: "destructive"
      })
    }
  }

  const handleForceDelete = async () => {
    if (!forceDeleteInfo) return
    setIsForceDialogOpen(false)
    try {
      const res = await fetch(`/api/characteristics/values?id=${forceDeleteInfo.id}&force=true`, {
        method: "DELETE"
      })
      if (res.ok) {
        const response = await res.json()
        toast({
          title: "Успешно",
          description: response.message || "Характеристика и все связи удалены"
        })
        setForceDeleteInfo(null)
        await loadSpecGroups()
      } else {
        const error = await res.json()
        toast({
          title: "Ошибка",
          description: error.error || "Ошибка удаления",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка удаления характеристики",
        variant: "destructive"
      })
    }
  }

  // Функция для переключения сворачивания разделов
  const toggleSectionCollapse = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections)
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId)
    } else {
      newCollapsed.add(sectionId)
    }
    setCollapsedSections(newCollapsed)
  }

  // Notion-style табличное представление с иерархической структурой
  const renderTableView = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Количество
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Порядок
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {renderHierarchicalRows(filteredGroups, 0)}
            </tbody>
          </table>
        </div>

        {filteredGroups.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-4 text-gray-300"/>
            <div className="text-lg font-medium mb-2">Нет групп характеристик</div>
            <div className="text-sm mb-4">Создайте первую группу для организации характеристик товаров</div>
          </div>
        )}
      </div>
    )
  }

  // Рендер иерархических строк в стиле Notion
  const renderHierarchicalRows = (groups: SpecGroup[], level: number): React.ReactNode[] => {
    const rows: React.ReactNode[] = []

    groups.forEach(group => {
      // Добавляем строку группы
      rows.push(renderGroupRow(group, level))

      // Если группа развернута, добавляем её характеристики
      const isExpanded = expandedGroups.has(String(group.id))
      if (isExpanded && group.enum_values && group.enum_values.length > 0) {
        group.enum_values
          .sort((a, b) => {
            const orderA = a.sort_order || a.ordering || 0
            const orderB = b.sort_order || b.ordering || 0
            return orderA - orderB || a.value.localeCompare(b.value)
          })
          .forEach(enumValue => {
            rows.push(renderCharacteristicRow(enumValue, group, group.id))
          })
      }

      // Если группа развернута и у неё есть дочерние группы, рендерим их рекурсивно
      if (isExpanded && group.children && group.children.length > 0) {
        rows.push(...renderHierarchicalRows(group.children, level + 1))
      }
    })

    return rows
  }

  // Рендер строки группы в стиле Notion
  const renderGroupRow = (group: SpecGroup, level: number) => {
    const hasChildren = (group.children && group.children.length > 0) || (group.enum_values && group.enum_values.length > 0)
    const isExpanded = expandedGroups.has(String(group.id))
    const totalCharacteristicsCount = getTotalCharacteristicsCount(group)
    const totalSubgroupsCount = getTotalSubgroupsCount(group)

    // Используем уровень из самой группы, если он есть, иначе переданный параметр
    const actualLevel = group.level !== undefined ? group.level : level

    // Определяем отступы как в IDE - каждый уровень четко смещен
    let paddingLeft = 12 // Базовый отступ для корневых элементов
    if (actualLevel > 0) {
      paddingLeft += actualLevel * 24 // 24px на каждый уровень вложенности (как в VS Code)
    }

    // Определяем, является ли элемент разделом
    const isSection = group.is_section === true

          return (
        <tr
          key={`group-${group.id}`}
          className={`hover:bg-gray-50/80 transition-colors group ${isSection ? 'bg-gray-100/50' : ''}`}
        >
        <td className="py-2 pr-3" style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-2">
            {/* Стрелочка раскрытия */}
            {hasChildren ? (
              <button
                onClick={() => toggleGroupExpansion(group.id)}
                className="flex items-center justify-center w-4 h-4 rounded hover:bg-gray-200 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-600" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                )}
              </button>
            ) : (
              <div className="w-4 h-4"></div>
            )}

            {/* Иконка и название */}
            <div className="flex items-center gap-2">
              {/* Улучшенные иконки с учетом типа */}
              {isSection ? (
                // Иконки для разделов - серый цвет
                isExpanded && hasChildren ?
                  <FolderOpen className="w-4 h-4 text-gray-600" /> :
                  <Folder className="w-4 h-4 text-gray-600" />
              ) : actualLevel === 1 || (actualLevel === 0 && group.parent_id) ? (
                // Иконки для групп в разделах
                <Package className="w-4 h-4 text-slate-600" />
              ) : actualLevel === 0 && !group.parent_id ? (
                // Иконки для независимых групп
                <Hash className="w-4 h-4 text-amber-600" />
              ) : (
                // Иконки для подгрупп
                <Tag className="w-4 h-4 text-gray-500" />
              )}

              <span className={`text-sm font-medium ${isSection ? 'text-gray-800' : 'text-gray-900'}`}>
                {group.name}
              </span>

              {/* Независимая группа индикатор */}
              {!group.is_section && !group.parent_id && actualLevel === 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  Независимая
                </span>
              )}
            </div>
          </div>

          {/* Описание под названием */}
          {group.description && (
            <div
              className={`text-xs mt-1 ${isSection ? 'text-gray-600' : 'text-gray-500'}`}
              style={{ paddingLeft: `${24}px` }}
            >
              {group.description}
            </div>
          )}
        </td>

        <td className="px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-2">
            {totalCharacteristicsCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {totalCharacteristicsCount} хар-к
              </span>
            )}
            {totalSubgroupsCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {totalSubgroupsCount} подгрупп
              </span>
            )}
            {totalCharacteristicsCount === 0 && totalSubgroupsCount === 0 && (
              <span className="text-gray-400 text-xs">пусто</span>
            )}
          </div>
        </td>

        <td className="px-3 py-2 text-center">
          <span className="text-sm text-gray-600">
            {group.ordering || 0}
          </span>
        </td>

        <td className="px-3 py-2">
          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Разные кнопки для разделов и групп */}
            {group.is_section ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Дополнительная проверка, что это раздел
                  if (!group.is_section) {
                    toast({
                      title: "Ошибка",
                      description: "Группы можно создавать только в разделах",
                      variant: "destructive"
                    })
                    return
                  }

                  // Создаем группу в разделе
                  setEditingGroup(null)
                  setIsCreatingSection(false)
                  setGroupFormData({
                    name: "",
                    description: "",
                    parent_id: typeof group.id === 'number' ? group.id : Number(group.id),
                    is_section: false
                  })
                  setIsGroupDialogOpen(true)
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-green-600"
                title="Добавить группу в раздел"
              >
                <Package className="w-3 h-3"/>
              </Button>
            ) : (
              // Кнопка "Добавить подгруппу" показывается только для разделов
              group.is_section && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddSubgroup(group)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-purple-600"
                  title="Добавить подгруппу"
                >
                  <Package className="w-3 h-3"/>
                </Button>
              )
            )}
            {/* Кнопка "Добавить характеристику" показывается только для групп (не разделов) */}
            {!group.is_section && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Дополнительная проверка, что это группа, а не раздел
                  if (group.is_section) {
                    toast({
                      title: "Ошибка",
                      description: "Характеристики можно создавать только в группах, а не в разделах",
                      variant: "destructive"
                    })
                    return
                  }

                  // Устанавливаем группу для создания характеристики
                  const groupId = typeof group.id === 'string' && group.id.startsWith('spec_')
                    ? parseInt(group.id.replace('spec_', ''))
                    : typeof group.id === 'number' ? group.id : 0;
                  setEnumFormData(prev => ({ ...prev, groupId }));
                  setIsEnumDialogOpen(true);
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-green-600"
                title="Добавить характеристику"
              >
                <Plus className="w-3 h-3"/>
              </Button>
            )}
            {/* Кнопка редактирования - для всех кроме "Дополнительных характеристик" */}
            {group.id !== 999999 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGroupEdit(group)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                title={group.is_section ? "Редактировать раздел" : "Редактировать группу"}
              >
                <Edit className="w-3 h-3"/>
              </Button>
            )}
            {/* Кнопка удаления - для всех кроме "Дополнительных характеристик" */}
            {group.id !== 999999 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGroupDelete(group.id)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                title={group.is_section ? "Удалить раздел" : "Удалить группу"}
              >
                <Trash2 className="w-3 h-3"/>
              </Button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  // Рендер строки характеристики в стиле Notion
  const renderCharacteristicRow = (enumValue: SpecEnum, parentGroup: SpecGroup, groupId: string | number) => {
    // Отступы для характеристик как в IDE - на один уровень больше чем у родительской группы
    const groupLevel = parentGroup.level !== undefined ? parentGroup.level : 0
    let paddingLeft = 12 + (groupLevel + 1) * 24 // Базовый + (уровень группы + 1) * 24px как в VS Code

    return (
      <tr
        key={`enum-${enumValue.id}`}
        className="hover:bg-emerald-50/30 transition-colors group"
      >
        <td className="py-1.5 pr-3" style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4"></div> {/* Пустое место для стрелочки */}

            <div className="flex items-center gap-2">
              {/* Цветовой квадратик для группы "Цвет" */}
              {(typeof groupId === 'number' && groupId === 17) || (typeof groupId === 'string' && groupId === '17') ? (
                <div
                  className="w-3 h-3 rounded border flex-shrink-0 shadow-sm"
                  style={{
                    background: getColorValue(enumValue),
                    border: enumValue.value.toLowerCase().includes('белый') ? '1px solid #D1D5DB' : '1px solid #9CA3AF'
                  }}
                  title={`Цвет: ${enumValue.value}`}
                />
              ) : (
                <div className="w-3 h-3 rounded border border-emerald-300 bg-emerald-100 flex-shrink-0" />
              )}

              <span className="text-sm text-gray-700">
                {enumValue.value}
              </span>
            </div>
          </div>
        </td>

        <td className="px-3 py-1.5 text-center">
          <span className="text-xs text-gray-500">—</span>
        </td>

        <td className="px-3 py-1.5 text-center">
          <span className="text-sm text-gray-600">
            {enumValue.sort_order || enumValue.ordering || 0}
          </span>
        </td>

        <td className="px-3 py-1.5">
          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEnumEdit(enumValue)}
              className="h-5 w-5 p-0 text-gray-400 hover:text-emerald-600"
              title="Редактировать характеристику"
            >
              <Edit className="w-2.5 h-2.5"/>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEnumDelete(enumValue.id)}
              className="h-5 w-5 p-0 text-gray-400 hover:text-red-600"
              title="Удалить характеристику"
            >
              <Trash2 className="w-2.5 h-2.5"/>
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  // Фильтрация данных с поддержкой иерархии
  const filteredGroups = (() => {
    if (!search.trim()) return specGroups;

    const filterGroup = (group: SpecGroup): SpecGroup | null => {
      const matchesSearch = group.name.toLowerCase().includes(search.toLowerCase());
      const filteredChildren = group.children ? group.children.map(filterGroup).filter(Boolean) as SpecGroup[] : [];

      if (matchesSearch || filteredChildren.length > 0) {
        return {
          ...group,
          children: filteredChildren
        };
      }

      return null;
    };

    return specGroups.map(filterGroup).filter(Boolean) as SpecGroup[];
  })();

  // Рендер иерархических групп
  // Функция для подсчета общего количества подгрупп в группе
  const getTotalSubgroupsCount = (group: SpecGroup): number => {
    let count = 0;
    if (group.children && group.children.length > 0) {
      count += group.children.length;
      // Рекурсивно считаем подгруппы в дочерних группах
      group.children.forEach(child => {
        count += getTotalSubgroupsCount(child);
      });
    }
    return count;
  };

  // Функция для подсчета общего количества характеристик в группе и ее подгруппах
  const getTotalCharacteristicsCount = (group: SpecGroup): number => {
    let count = group.enum_values?.length || 0;

    // Добавляем характеристики из дочерних групп
    if (group.children && group.children.length > 0) {
      group.children.forEach(child => {
        count += getTotalCharacteristicsCount(child);
      });
    }

    return count;
  };

  // Рендер интерфейса
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Загрузка характеристик...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600"/>
            Управление характеристиками
          </h1>
          <p className="text-slate-600">Управление группами характеристик товаров</p>
        </div>

        <div className="mb-6 space-y-4">
          {/* Поиск и фильтры */}
          <div className="flex items-center gap-4">
            <Input
              placeholder="Поиск по названию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />

            {/* Кнопки управления деревом */}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedGroups(new Set())}
                className="text-xs"
              >
                <ChevronRight className="w-3 h-3 mr-1"/>
                Свернуть все
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allGroupIds = new Set<string>()
                  const collectIds = (groups: SpecGroup[]) => {
                    groups.forEach(group => {
                      allGroupIds.add(String(group.id))
                      if (group.children) {
                        collectIds(group.children)
                      }
                    })
                  }
                  collectIds(specGroups)
                  setExpandedGroups(allGroupIds)
                }}
                className="text-xs"
              >
                <ChevronDown className="w-3 h-3 mr-1"/>
                Развернуть все
              </Button>
            </div>
          </div>
        </div>

          {/* Группы характеристик */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5"/>
                    Разделы характеристик ({filteredGroups.length})
                  </CardTitle>
                  <Dialog open={isGroupDialogOpen} onOpenChange={(open) => {
                    setIsGroupDialogOpen(open)
                    if (!open) resetGroupForm()
                  }}>
                    <Button
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={handleAddSection}
                    >
                      <Plus className="w-4 h-4 mr-2"/>
                      Добавить раздел
                    </Button>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>
                          {editingGroup
                            ? (groupFormData.is_section ? "Редактировать раздел" : "Редактировать группу")
                            : (groupFormData.is_section ? "Новый раздел характеристик" : "Новая группа характеристик")
                          }
                        </DialogTitle>
                        <DialogDescription>
                          {editingGroup
                            ? (groupFormData.is_section ? "Изменение существующего раздела характеристик" : "Изменение существующей группы характеристик")
                            : (groupFormData.is_section ? "Создание нового раздела для организации групп характеристик" : "Создание новой группы характеристик товаров")
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="groupName">
                            {groupFormData.is_section ? "Название раздела *" : "Название группы *"}
                          </Label>
                          <Input
                            id="groupName"
                            value={groupFormData.name}
                            onChange={(e) => setGroupFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder={groupFormData.is_section
                              ? "например: Общие параметры"
                              : "например: Физические параметры"
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="groupDescription">Описание</Label>
                          <Textarea
                            id="groupDescription"
                            value={groupFormData.description}
                            onChange={(e) => setGroupFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder={groupFormData.is_section
                              ? "Описание раздела характеристик"
                              : "Описание группы характеристик"
                            }
                            rows={3}
                          />
                        </div>

                        {/* Поле выбора родительской группы - скрываем для разделов */}
                        {!groupFormData.is_section && (
                        <div>
                          <Label htmlFor="parentGroup">Родительская группа</Label>
                          <Select
                            value={groupFormData.parent_id?.toString() || "root"}
                            onValueChange={(value) => setGroupFormData(prev => ({
                              ...prev,
                              parent_id: value === "root" ? undefined : parseInt(value)
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите родительскую группу..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="root">Корневая группа</SelectItem>
                              {(() => {
                                // Функция для получения всех доступных групп (исключая текущую и её дочерние)
                                const getAllAvailableGroups = (groups: SpecGroup[], currentGroupId?: string | number): SpecGroup[] => {
                                  const result: SpecGroup[] = [];

                                  const addGroup = (group: SpecGroup, level = 0) => {
                                    // Исключаем текущую группу и её дочерние элементы
                                    if (editingGroup && (group.id === editingGroup.id)) {
                                      return;
                                    }

                                    // Проверяем, не является ли группа дочерней для редактируемой
                                    if (editingGroup && isChildOf(group, editingGroup)) {
                                      return;
                                    }

                                    result.push({
                                      ...group,
                                      level: level,
                                      name: "  ".repeat(level) + group.name
                                    });

                                    if (group.children) {
                                      group.children.forEach(child => addGroup(child, level + 1));
                                    }
                                  };

                                  groups.forEach(group => addGroup(group));
                                  return result;
                                };

                                // Функция проверки, является ли группа дочерней
                                const isChildOf = (potentialChild: SpecGroup, potentialParent: SpecGroup): boolean => {
                                  if (!potentialParent.children) return false;

                                  for (const child of potentialParent.children) {
                                    if (child.id === potentialChild.id) return true;
                                    if (isChildOf(potentialChild, child)) return true;
                                  }
                                  return false;
                                };

                                const availableGroups = getAllAvailableGroups(specGroups, editingGroup?.id);

                                return availableGroups.map(group => {
                                  const originalId = typeof group.id === 'string' && group.id.startsWith('spec_')
                                    ? parseInt(group.id.replace('spec_', ''))
                                    : typeof group.id === 'number' ? group.id : 0;

                                  return (
                                    <SelectItem key={group.id} value={originalId.toString()}>
                                      {group.name}
                                    </SelectItem>
                                  );
                                });
                              })()}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500 mt-1">
                            Выберите родительскую группу для создания иерархии
                          </p>
                        </div>
                        )}
                        <div className="flex gap-2 pt-4">
                          <Button onClick={handleGroupSave} className="bg-blue-500 hover:bg-blue-600">
                            {editingGroup
                              ? "Обновить"
                              : groupFormData.is_section
                                ? "Создать раздел"
                                : "Создать группу"
                            }
                          </Button>
                          <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {renderTableView()}
              </CardContent>
            </Card>

        {/* Диалог создания/редактирования характеристики */}
        <Dialog open={isEnumDialogOpen} onOpenChange={(open) => {
          setIsEnumDialogOpen(open)
          if (!open) resetEnumForm()
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingEnum
                  ? "Редактировать характеристику"
                  : "Новая характеристика"
                }
              </DialogTitle>
              <DialogDescription>
                {editingEnum
                  ? "Изменение параметров существующей характеристики товара"
                  : "Создание новой характеристики для классификации товаров"
                }
              </DialogDescription>
              {/* Показываем к какой группе добавляется характеристика */}
              {!editingEnum && enumFormData.groupId > 0 && (() => {
                // Ищем группу по ID для отображения названия
                const findGroupById = (groups: SpecGroup[], id: number): SpecGroup | null => {
                  for (const group of groups) {
                    if (group.id === id || (typeof group.id === 'string' && group.id.endsWith(`_${id}`))) {
                      return group;
                    }
                    if (group.children) {
                      const found = findGroupById(group.children, id);
                      if (found) return found;
                    }
                  }
                  return null;
                };

                const targetGroup = findGroupById(specGroups, enumFormData.groupId);
                return targetGroup ? (
                  <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                    <span className="font-medium">Добавление в группу:</span> {targetGroup.name}
                  </div>
                ) : null;
              })()}
            </DialogHeader>
            <div className="space-y-4">
                                      <div>
                          <Label htmlFor="enumValue">Значение характеристики *</Label>
                          <Input
                            id="enumValue"
                            value={enumFormData.value}
                            onChange={(e) => setEnumFormData(prev => ({
                              ...prev,
                              value: e.target.value
                            }))}
                            placeholder="Например: Водонепроницаемость, Левая сторона..."
                          />
                        </div>
              <div>
                <Label htmlFor="enumOrdering">Порядок сортировки</Label>
                <Input
                  id="enumOrdering"
                  type="number"
                  value={enumFormData.ordering}
                  onChange={(e) => setEnumFormData(prev => ({
                    ...prev,
                    ordering: parseInt(e.target.value) || 0
                  }))}
                  placeholder="1, 2, 3..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Определяет порядок отображения в списке
                </p>
              </div>

              {/* Поле цвета для группы "Цветовая гамма" */}
              {enumFormData.groupId === 17 && (
                <div>
                  <Label htmlFor="colorValue">Цвет *</Label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <Input
                        id="colorValue"
                        value={enumFormData.color_value}
                        onChange={(e) => setEnumFormData(prev => ({
                          ...prev,
                          color_value: e.target.value
                        }))}
                        placeholder="#FF5733, rgba(255,87,51,0.8), linear-gradient(...)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Введите HEX (#FF5733), RGB/RGBA или CSS градиент
                      </p>
                    </div>
                    <input
                      type="color"
                      value={enumFormData.color_value.startsWith('#') ? enumFormData.color_value : '#E5E7EB'}
                      onChange={(e) => setEnumFormData(prev => ({
                        ...prev,
                        color_value: e.target.value
                      }))}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                      title="Выбрать цвет"
                    />
                    <div
                      className="w-10 h-10 rounded border-2 border-gray-300 flex-shrink-0"
                      style={{
                        background: enumFormData.color_value || '#E5E7EB',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                      title="Предпросмотр цвета"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleEnumSave} className="bg-amber-500 hover:bg-amber-600">
                  {editingEnum ? "Сохранить изменения" : "Создать характеристику"}
                </Button>
                <Button variant="outline" onClick={() => setIsEnumDialogOpen(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Диалог подтверждения удаления с подробной информацией */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Подтверждение удаления
              </DialogTitle>
              <DialogDescription>
                Подтверждение безвозвратного удаления элемента из системы характеристик.
              </DialogDescription>
            </DialogHeader>

            {deleteInfo && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-600 font-medium">⚠️ Внимание!</span>
                  </div>
                  <p className="text-sm text-red-700 mb-3">
                    Вы собираетесь удалить {deleteInfo.group.type} <strong>"{deleteInfo.group.name}"</strong>.
                    {deleteInfo.warnings.length > 0 && " Это приведет к следующим последствиям:"}
                  </p>

                  {deleteInfo.warnings.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                      {deleteInfo.warnings.map((warning: string, index: number) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Детальная информация */}
                <div className="space-y-3">
                  {deleteInfo.will_be_deleted.child_groups > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <h4 className="font-medium text-orange-800 mb-2">
                        Дочерние элементы ({deleteInfo.will_be_deleted.child_groups})
                      </h4>
                      <div className="space-y-1">
                        {deleteInfo.will_be_deleted.child_groups_list.slice(0, 5).map((child: any) => (
                          <div key={child.id} className="text-sm text-orange-700">
                            • {child.name} ({child.type})
                          </div>
                        ))}
                        {deleteInfo.will_be_deleted.child_groups > 5 && (
                          <div className="text-sm text-orange-600 italic">
                            ... и еще {deleteInfo.will_be_deleted.child_groups - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {deleteInfo.will_be_deleted.total_values > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h4 className="font-medium text-blue-800 mb-1">
                        Значения характеристик
                      </h4>
                      <p className="text-sm text-blue-700">
                        Будет удалено {deleteInfo.will_be_deleted.total_values} значений
                        {deleteInfo.will_be_deleted.values_in_child_groups > 0 &&
                          ` (${deleteInfo.will_be_deleted.values_in_main_group} в главной группе +
                           ${deleteInfo.will_be_deleted.values_in_child_groups} в дочерних)`
                        }
                      </p>
                    </div>
                  )}

                  {deleteInfo.will_be_deleted.affected_products > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <h4 className="font-medium text-purple-800 mb-2">
                        Затронутые товары ({deleteInfo.will_be_deleted.affected_products})
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {deleteInfo.will_be_deleted.affected_products_list.map((product: any) => (
                          <div key={product.id} className="text-sm text-purple-700">
                            • {product.name}
                          </div>
                        ))}
                        {deleteInfo.will_be_deleted.affected_products > 10 && (
                          <div className="text-sm text-purple-600 italic">
                            ... и еще {deleteInfo.will_be_deleted.affected_products - 10} товаров
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Кнопки действий */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deletingGroupId && performDelete(deletingGroupId, true)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить всё равно
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Force delete dialog */}
        {isForceDialogOpen && forceDeleteInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
              <h2 className="text-lg font-bold mb-2 text-red-700">Внимание!</h2>
              <p className="mb-4 text-sm text-gray-700">
                Это значение используется в <b>{forceDeleteInfo.usage}</b> товарах.<br/>
                Удалить его вместе со всеми связями?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsForceDialogOpen(false)}>Отмена</Button>
                <Button variant="destructive" onClick={handleForceDelete}>Удалить принудительно</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}