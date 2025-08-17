"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Plus, Save, Upload, Download, Database, Shield } from "lucide-react"
import { logger } from "@/lib/logger"

export interface CharacteristicTemplate {
  id: number
  name: string
  description?: string
  template_data: any
  created_at: Date
  updated_at: Date
  created_by: string
}

interface TemplatesManagerProps {
  trigger: React.ReactNode
  currentSpecifications: any[]
  onApplyTemplate: (specs: any[]) => void
}

export function CharacteristicsTemplatesManager({
  trigger,
  currentSpecifications,
  onApplyTemplate,
}: TemplatesManagerProps) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<CharacteristicTemplate[]>([])
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Загрузка шаблонов из базы данных
  useEffect(() => {
    if (open) {
      loadTemplates()
    }
  }, [open])

  const loadTemplates = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/admin/templates', {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка загрузки шаблонов')
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      setError('Ошибка соединения с сервером')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveCurrent = async () => {
    if (!newName.trim()) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          template_data: {
            specifications: currentSpecifications,
            metadata: {
              count: currentSpecifications.length,
              created_from: 'characteristics-manager',
              timestamp: new Date().toISOString()
            }
          }
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setTemplates(prev => [data.template, ...prev])
        setNewName("")
        setNewDescription("")
        logger.info('Template saved successfully', { name: newName })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка сохранения шаблона')
      }
    } catch (error) {
      console.error('Failed to save template:', error)
      setError('Ошибка соединения с сервером')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Удалить шаблон "${name}"?`)) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/templates?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id))
        logger.info('Template deleted successfully', { id, name })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка удаления шаблона')
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      setError('Ошибка соединения с сервером')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyTemplate = (template: CharacteristicTemplate) => {
    try {
      const specifications = template.template_data?.specifications || []
      onApplyTemplate(specifications)
      setOpen(false)
      logger.info('Template applied', {
        templateId: template.id,
        name: template.name,
        specsCount: specifications.length
      })
    } catch (error) {
      console.error('Failed to apply template:', error)
      setError('Ошибка применения шаблона')
    }
  }

  const handleExport = async () => {
    try {
      const exportData = {
        exported_at: new Date().toISOString(),
        source: 'MedSIP Characteristics Manager',
        templates: templates.map(t => ({
          name: t.name,
          description: t.description,
          specifications: t.template_data?.specifications || [],
          created_at: t.created_at,
          created_by: t.created_by
        }))
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json"
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `characteristics-templates-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      logger.info('Templates exported', { count: templates.length })
    } catch (error) {
      console.error('Export failed:', error)
      setError('Ошибка экспорта')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError("")

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result as string)
        const templatesToImport = imported.templates || imported // Поддержка разных форматов

        let successCount = 0
        let errorCount = 0

        for (const template of templatesToImport) {
          try {
            const response = await fetch('/api/admin/templates', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                name: `${template.name} (импорт)`,
                description: template.description || 'Импортированный шаблон',
                template_data: {
                  specifications: template.specifications || template.template_data?.specifications || [],
                  metadata: {
                    imported_at: new Date().toISOString(),
                    original_created_at: template.created_at,
                    original_created_by: template.created_by
                  }
                }
              }),
            })

            if (response.ok) {
              successCount++
            } else {
              errorCount++
            }
          } catch (_error) {
            errorCount++
          }
        }

        if (successCount > 0) {
          await loadTemplates() // Перезагружаем список
          setError(`Импорт завершен: ${successCount} успешно, ${errorCount} ошибок`)
        } else {
          setError('Не удалось импортировать ни одного шаблона')
        }

        logger.info('Templates import completed', { successCount, errorCount })
      } catch (error) {
        console.error('Import failed:', error)
        setError('Ошибка чтения файла')
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsText(file)

    // Сбрасываем input
    e.target.value = ''
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Безопасные шаблоны характеристик
            <Shield className="w-4 h-4 text-green-600" />
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Шаблоны хранятся в базе данных с полным аудитом и контролем доступа
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Форма создания нового шаблона */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium mb-3">Создать новый шаблон</h3>
            <div className="space-y-3">
              <Input
                placeholder="Название шаблона"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isLoading}
              />
              <Textarea
                placeholder="Описание (опционально)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={isLoading}
                rows={2}
              />
              <Button
                onClick={handleSaveCurrent}
                disabled={currentSpecifications.length === 0 || !newName.trim() || isLoading}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                Сохранить текущие характеристики ({currentSpecifications.length})
              </Button>
            </div>
          </div>

          {/* Ошибки */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Список шаблонов */}
          <div className="border rounded-lg">
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium">Сохраненные шаблоны</h3>
            </div>
            <ScrollArea className="h-64 p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Загрузка...</span>
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  Шаблоны не найдены
                </p>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          {template.description && (
                            <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>
                              Характеристик: {template.template_data?.specifications?.length || 0}
                            </span>
                            <span>
                              Создан: {new Date(template.created_at).toLocaleDateString()}
                            </span>
                            <span>
                              Автор: {template.created_by}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApplyTemplate(template)}
                            disabled={isLoading}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Применить
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(template.id, template.name)}
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="justify-between mt-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild disabled={isLoading}>
              <label className="flex items-center gap-1 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Импорт</span>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImport}
                  disabled={isLoading}
                />
              </label>
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isLoading || templates.length === 0}
            >
              <Download className="w-4 h-4 mr-1" />
              Экспорт ({templates.length})
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            🔒 Безопасное хранение в БД
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}