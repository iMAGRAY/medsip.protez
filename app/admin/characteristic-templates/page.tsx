'use client'

import React, { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  Plus,
  Edit,
  Trash2,
  Save,
  Eye,
  Settings,
  FileText,
  Hash,
  List,
  ToggleLeft,
  Palette,
  Calendar,
  Star,
  ChevronRight
} from 'lucide-react'

interface CharacteristicGroup {
  id: number
  name: string
  description: string
  ordering: number
  show_in_main_params: boolean
  main_params_priority: number | null
  main_params_label_override: string | null
}

interface CharacteristicTemplate {
  id?: number
  group_id: number
  name: string
  description: string
  input_type: 'text' | 'number' | 'select' | 'boolean' | 'range'
  unit_id?: number
  unit_code?: string
  unit_name?: string
  is_required: boolean
  sort_order: number
  validation_rules: any
  default_value?: string
  placeholder_text?: string
  preset_values_count?: number
  preset_values?: PresetValue[]
}

interface PresetValue {
  id?: number
  value: string
  display_text?: string
  sort_order: number
  is_default: boolean
}

interface Unit {
  id: number
  code: string
  name_ru: string
}

export default function CharacteristicTemplatesAdmin() {
  const [groups, setGroups] = useState<CharacteristicGroup[]>([])
  const [templates, setTemplates] = useState<CharacteristicTemplate[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  // Состояния диалогов
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CharacteristicTemplate | null>(null)

  // Форма шаблона
  const [templateForm, setTemplateForm] = useState<Partial<CharacteristicTemplate>>({
    group_id: 0,
    name: '',
    description: '',
    input_type: 'text',
    is_required: false,
    sort_order: 0,
    validation_rules: {},
    preset_values: []
  })

  // Загрузка данных
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const [groupsRes, templatesRes, unitsRes] = await Promise.all([
        fetch('/api/admin/characteristic-groups'),
        fetch('/api/admin/characteristic-templates'),
        fetch('/api/characteristic-units')
      ])

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json()
        setGroups(groupsData.data || [])
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json()
        setTemplates(templatesData.data || [])
      }

      if (unitsRes.ok) {
        const unitsData = await unitsRes.json()
        setUnits(unitsData.data || [])
      }

    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  // Фильтруем шаблоны по выбранной группе
  const filteredTemplates = selectedGroupId
    ? templates.filter(t => t.group_id === selectedGroupId)
    : templates

  // Получаем группу по ID
  const getGroupById = (id: number) => groups.find(g => g.id === id)

  // Открыть диалог создания шаблона
  const openCreateTemplateDialog = (groupId?: number) => {
    setEditingTemplate(null)
    setTemplateForm({
      group_id: groupId || selectedGroupId || 0,
      name: '',
      description: '',
      input_type: 'text',
      is_required: false,
      sort_order: 0,
      validation_rules: {},
      preset_values: []
    })
    setIsTemplateDialogOpen(true)
  }

  // Открыть диалог редактирования шаблона
  const openEditTemplateDialog = async (template: CharacteristicTemplate) => {
    try {
      // Загружаем полную информацию о шаблоне с предустановленными значениями
      const response = await fetch(`/api/admin/characteristic-templates/${template.id}`)
      if (response.ok) {
        const data = await response.json()
        setEditingTemplate(data.data)
        setTemplateForm({
          ...data.data,
          preset_values: data.data.preset_values || []
        })
        setIsTemplateDialogOpen(true)
      }
    } catch (error) {
      console.error('Ошибка загрузки шаблона:', error)
    }
  }

  // Сохранить шаблон
  const saveTemplate = async () => {
    try {
      const url = editingTemplate
        ? `/api/admin/characteristic-templates/${editingTemplate.id}`
        : '/api/admin/characteristic-templates'

      const method = editingTemplate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm)
      })

      if (response.ok) {
        await loadData()
        setIsTemplateDialogOpen(false)

      } else {
        const error = await response.json()
        console.error('Ошибка сохранения:', error.error)
      }
    } catch (error) {
      console.error('Ошибка сохранения шаблона:', error)
    }
  }

  // Удалить шаблон
  const deleteTemplate = async (template: CharacteristicTemplate) => {
    if (!confirm(`Удалить шаблон "${template.name}"?`)) return

    try {
      const response = await fetch(`/api/admin/characteristic-templates/${template.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadData()

      } else {
        const error = await response.json()
        alert(`Ошибка удаления: ${error.error}`)
      }
    } catch (error) {
      console.error('Ошибка удаления шаблона:', error)
    }
  }

  // Добавить предустановленное значение
  const addPresetValue = () => {
    const newPresetValues = [...(templateForm.preset_values || []), {
      value: '',
      display_text: '',
      sort_order: templateForm.preset_values?.length || 0,
      is_default: false
    }]
    setTemplateForm({ ...templateForm, preset_values: newPresetValues })
  }

  // Удалить предустановленное значение
  const removePresetValue = (index: number) => {
    const newPresetValues = templateForm.preset_values?.filter((_, i) => i !== index) || []
    setTemplateForm({ ...templateForm, preset_values: newPresetValues })
  }

  // Обновить предустановленное значение
  const updatePresetValue = (index: number, field: keyof PresetValue, value: any) => {
    const newPresetValues = [...(templateForm.preset_values || [])]
    newPresetValues[index] = { ...newPresetValues[index], [field]: value }
    setTemplateForm({ ...templateForm, preset_values: newPresetValues })
  }

  // Получить иконку типа ввода
  const getInputTypeIcon = (inputType: string) => {
    switch (inputType) {
      case 'text': return <FileText className="w-4 h-4" />
      case 'number': return <Hash className="w-4 h-4" />
      case 'select': return <List className="w-4 h-4" />
      case 'boolean': return <ToggleLeft className="w-4 h-4" />
      case 'range': return <Calendar className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Загрузка...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Заголовок */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Шаблоны характеристик</h1>
            <p className="text-slate-600">Настройка групп и шаблонов характеристик товаров</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => openCreateTemplateDialog()} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Новый шаблон
            </Button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Settings className="h-8 w-8 text-emerald-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Групп</p>
                  <p className="text-2xl font-bold">{groups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Шаблонов</p>
                  <p className="text-2xl font-bold">{templates.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Star className="h-8 w-8 text-amber-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Основных</p>
                  <p className="text-2xl font-bold">{groups.filter(g => g.show_in_main_params).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <List className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Единиц</p>
                  <p className="text-2xl font-bold">{units.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Основной интерфейс */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Боковая панель групп */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Группы характеристик</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedGroupId(null)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedGroupId === null ? 'bg-emerald-50 border-r-2 border-emerald-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Все группы</span>
                      <Badge variant="secondary">{templates.length}</Badge>
                    </div>
                  </button>

                  {groups
                    .sort((a, b) => a.ordering - b.ordering)
                    .map((group) => {
                      const groupTemplates = templates.filter(t => t.group_id === group.id)
                      return (
                        <button
                          key={group.id}
                          onClick={() => setSelectedGroupId(group.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                            selectedGroupId === group.id ? 'bg-emerald-50 border-r-2 border-emerald-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{group.name}</span>
                                {group.show_in_main_params && (
                                  <Star className="w-3 h-3 text-amber-500" />
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{group.description}</p>
                            </div>
                            <Badge variant="secondary">{groupTemplates.length}</Badge>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Основная область - шаблоны */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">
                    {selectedGroupId
                      ? `Шаблоны группы: ${getGroupById(selectedGroupId)?.name}`
                      : 'Все шаблоны характеристик'
                    }
                  </CardTitle>

                  {selectedGroupId && (
                    <Button
                      onClick={() => openCreateTemplateDialog(selectedGroupId)}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить в группу
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Нет шаблонов</h3>
                    <p className="text-gray-500 mb-4">
                      {selectedGroupId
                        ? 'В этой группе пока нет шаблонов характеристик'
                        : 'Создайте первый шаблон характеристики'
                      }
                    </p>
                    <Button onClick={() => openCreateTemplateDialog(selectedGroupId || undefined)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Создать шаблон
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTemplates
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((template) => (
                        <div
                          key={template.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {getInputTypeIcon(template.input_type)}
                                <h3 className="font-semibold text-gray-900">{template.name}</h3>

                                <div className="flex gap-2">
                                  <Badge variant={template.input_type === 'select' ? 'default' : 'secondary'}>
                                    {template.input_type}
                                  </Badge>

                                  {template.is_required && (
                                    <Badge variant="destructive">обязательное</Badge>
                                  )}

                                  {template.unit_code && (
                                    <Badge variant="outline">{template.unit_code}</Badge>
                                  )}

                                  {template.preset_values_count && template.preset_values_count > 0 && (
                                    <Badge variant="secondary">
                                      {template.preset_values_count} значений
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {template.description && (
                                <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                              )}

                              {!selectedGroupId && (
                                <p className="text-xs text-gray-500">
                                  Группа: {getGroupById(template.group_id)?.name}
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2 ml-4">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditTemplateDialog(template)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTemplate(template)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Диалог создания/редактирования шаблона */}
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate ? 'Изменение параметров существующего шаблона характеристик' : 'Создание нового шаблона для многократного использования характеристик'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <Tabs defaultValue="basic">
                <TabsList>
                  <TabsTrigger value="basic">Основные</TabsTrigger>
                  <TabsTrigger value="validation">Валидация</TabsTrigger>
                  {templateForm.input_type === 'select' && (
                    <TabsTrigger value="presets">Значения</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="group_id">Группа характеристик</Label>
                      <Select
                        value={templateForm.group_id?.toString()}
                        onValueChange={(value) => setTemplateForm({...templateForm, group_id: parseInt(value)})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите группу" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="input_type">Тип ввода</Label>
                      <Select
                        value={templateForm.input_type}
                        onValueChange={(value) => setTemplateForm({...templateForm, input_type: value as any})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Текст</SelectItem>
                          <SelectItem value="number">Число</SelectItem>
                          <SelectItem value="select">Выбор из списка</SelectItem>
                          <SelectItem value="boolean">Да/Нет</SelectItem>
                          <SelectItem value="range">Диапазон</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="name">Название характеристики</Label>
                    <Input
                      id="name"
                      value={templateForm.name || ''}
                      onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                      placeholder="Например: Объем накопителя"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Описание</Label>
                    <Textarea
                      id="description"
                      value={templateForm.description || ''}
                      onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                      placeholder="Краткое описание характеристики"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="unit_id">Единица измерения</Label>
                      <Select
                        value={templateForm.unit_id?.toString() || ''}
                        onValueChange={(value) => setTemplateForm({...templateForm, unit_id: value ? parseInt(value) : undefined})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Без единицы" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Без единицы</SelectItem>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id.toString()}>
                              {unit.code} ({unit.name_ru})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="sort_order">Порядок</Label>
                      <Input
                        id="sort_order"
                        type="number"
                        value={templateForm.sort_order || 0}
                        onChange={(e) => setTemplateForm({...templateForm, sort_order: parseInt(e.target.value) || 0})}
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <Switch
                        id="is_required"
                        checked={templateForm.is_required || false}
                        onCheckedChange={(checked) => setTemplateForm({...templateForm, is_required: checked})}
                      />
                      <Label htmlFor="is_required">Обязательное</Label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="placeholder_text">Подсказка для ввода</Label>
                    <Input
                      id="placeholder_text"
                      value={templateForm.placeholder_text || ''}
                      onChange={(e) => setTemplateForm({...templateForm, placeholder_text: e.target.value})}
                      placeholder="Текст подсказки в поле ввода"
                    />
                  </div>

                  <div>
                    <Label htmlFor="default_value">Значение по умолчанию</Label>
                    <Input
                      id="default_value"
                      value={templateForm.default_value || ''}
                      onChange={(e) => setTemplateForm({...templateForm, default_value: e.target.value})}
                      placeholder="Значение по умолчанию"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="validation" className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Настройки валидации для проверки введенных значений
                  </p>

                  {templateForm.input_type === 'number' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Минимальное значение</Label>
                        <Input
                          type="number"
                          value={templateForm.validation_rules?.min || ''}
                          onChange={(e) => setTemplateForm({
                            ...templateForm,
                            validation_rules: {
                              ...templateForm.validation_rules,
                              min: e.target.value ? parseFloat(e.target.value) : undefined
                            }
                          })}
                        />
                      </div>

                      <div>
                        <Label>Максимальное значение</Label>
                        <Input
                          type="number"
                          value={templateForm.validation_rules?.max || ''}
                          onChange={(e) => setTemplateForm({
                            ...templateForm,
                            validation_rules: {
                              ...templateForm.validation_rules,
                              max: e.target.value ? parseFloat(e.target.value) : undefined
                            }
                          })}
                        />
                      </div>
                    </div>
                  )}

                  {templateForm.input_type === 'text' && (
                    <div>
                      <Label>Регулярное выражение</Label>
                      <Input
                        value={templateForm.validation_rules?.pattern || ''}
                        onChange={(e) => setTemplateForm({
                          ...templateForm,
                          validation_rules: {
                            ...templateForm.validation_rules,
                            pattern: e.target.value
                          }
                        })}
                        placeholder="Например: ^[A-Z]{2,10}$"
                      />
                    </div>
                  )}
                </TabsContent>

                {templateForm.input_type === 'select' && (
                  <TabsContent value="presets" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label>Предустановленные значения</Label>
                      <Button size="sm" onClick={addPresetValue}>
                        <Plus className="w-4 h-4 mr-2" />
                        Добавить значение
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {templateForm.preset_values?.map((preset, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4">
                            <Input
                              placeholder="Значение"
                              value={preset.value}
                              onChange={(e) => updatePresetValue(index, 'value', e.target.value)}
                            />
                          </div>

                          <div className="col-span-4">
                            <Input
                              placeholder="Отображаемый текст"
                              value={preset.display_text || ''}
                              onChange={(e) => updatePresetValue(index, 'display_text', e.target.value)}
                            />
                          </div>

                          <div className="col-span-2">
                            <Input
                              type="number"
                              placeholder="Порядок"
                              value={preset.sort_order}
                              onChange={(e) => updatePresetValue(index, 'sort_order', parseInt(e.target.value) || 0)}
                            />
                          </div>

                          <div className="col-span-1 flex justify-center">
                            <Switch
                              checked={preset.is_default}
                              onCheckedChange={(checked) => updatePresetValue(index, 'is_default', checked)}
                            />
                          </div>

                          <div className="col-span-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removePresetValue(index)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {(!templateForm.preset_values || templateForm.preset_values.length === 0) && (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Нет предустановленных значений
                        </p>
                      )}
                    </div>
                  </TabsContent>
                )}
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={saveTemplate}>
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}