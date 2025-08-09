"use client"

import React, { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Package,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle,
  Eye
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { InstantLink } from "@/components/instant-link"

interface Manufacturer {
  id: number
  name: string
  description: string | null
  website_url: string | null
  country: string | null
  founded_year: number | null
  logo_url: string | null
  is_active: boolean
}

interface ModelLine {
  id: number
  name: string
  description: string | null
  manufacturer_id: number
  manufacturer_name: string
  launch_year: number | null
  is_active: boolean
  products_count: string
  created_at: string
  updated_at: string
}

export default function ManufacturerModelLinesPage() {
  const params = useParams()
  const router = useRouter()
  const manufacturerId = params?.id as string

  const [manufacturer, setManufacturer] = useState<Manufacturer | null>(null)
  const [modelLines, setModelLines] = useState<ModelLine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  })

  useEffect(() => {
    loadData()
  }, [manufacturerId])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/manufacturers/${manufacturerId}/model-lines`)
      const data = await response.json()

      if (data.success) {
        setManufacturer(data.data.manufacturer)
        setModelLines(data.data.modelLines)
      } else {
        setMessage({ type: 'error', text: 'Ошибка загрузки данных' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteModelLine = async (id: number, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить модельный ряд "${name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/model-lines/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Модельный ряд удален' })
        loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка удаления' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    }
  }

  const openCreateDialog = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Название обязательно для заполнения' })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/model-lines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          manufacturer_id: parseInt(manufacturerId),
          is_active: formData.is_active
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Модельный ряд успешно создан' })
        setIsDialogOpen(false)
        loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка создания модельного ряда' })
      }
    } catch (error) {
      console.error('Error creating model line:', error)
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </Button>

          <div className="flex-1">
            {manufacturer && (
              <div className="flex items-center gap-4">
                {manufacturer.logo_url && (
                  <img
                    src={manufacturer.logo_url}
                    alt={manufacturer.name}
                    className="w-12 h-12 object-contain rounded-lg bg-slate-50 p-2"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                )}
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    {manufacturer.name}
                  </h1>
                  <p className="text-slate-600 mt-1">
                    Модельные ряды производителя
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={openCreateDialog}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить модельный ряд
          </Button>
        </div>

        {/* Messages */}
        {message && (
          <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-slate-600 mt-2">Загрузка модельных рядов...</p>
          </div>
        )}

        {/* Manufacturer Info */}
        {!isLoading && manufacturer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Информация о производителе
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {manufacturer.country && (
                  <div>
                    <dt className="text-sm font-medium text-slate-600">Страна</dt>
                    <dd className="text-sm text-slate-900">{manufacturer.country}</dd>
                  </div>
                )}

                {manufacturer.founded_year && (
                  <div>
                    <dt className="text-sm font-medium text-slate-600">Год основания</dt>
                    <dd className="text-sm text-slate-900">{manufacturer.founded_year}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-slate-600">Статус</dt>
                  <dd>
                    <Badge variant={manufacturer.is_active ? "default" : "secondary"}>
                      {manufacturer.is_active ? "Активен" : "Неактивен"}
                    </Badge>
                  </dd>
                </div>
              </div>

              {manufacturer.description && (
                <div className="mt-4">
                  <dt className="text-sm font-medium text-slate-600 mb-1">Описание</dt>
                  <dd className="text-sm text-slate-900">{manufacturer.description}</dd>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Model Lines Grid */}
        {!isLoading && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900">
                Модельные ряды ({modelLines.length})
              </h2>
            </div>

            {modelLines.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modelLines.map((modelLine) => (
                  <Card key={modelLine.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{modelLine.name}</CardTitle>
                        <div className="flex gap-2">
                          <InstantLink href={`/admin/model-lines/${modelLine.id}/products`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Просмотр товаров"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </InstantLink>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Редактировать"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteModelLine(modelLine.id, modelLine.name)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Status & Products Count */}
                      <div className="flex items-center gap-2">
                        <Badge variant={modelLine.is_active ? "default" : "secondary"}>
                          {modelLine.is_active ? "Активен" : "Неактивен"}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {modelLine.products_count} товаров
                        </Badge>
                      </div>

                      {/* Launch Year */}
                      {modelLine.launch_year && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="h-4 w-4" />
                          Запуск в {modelLine.launch_year}
                        </div>
                      )}

                      {/* Description */}
                      {modelLine.description && (
                        <p className="text-sm text-slate-700 line-clamp-3">
                          {modelLine.description}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <InstantLink href={`/admin/model-lines/${modelLine.id}/products`} className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            title="Просмотр товаров модельного ряда"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Товары
                          </Button>
                        </InstantLink>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Модельные ряды не найдены
                  </h3>
                  <p className="text-slate-600 mb-4">
                    У этого производителя пока нет модельных рядов
                  </p>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={openCreateDialog}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Создать первый модельный ряд
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Create Model Line Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Создать модельный ряд</DialogTitle>
              <DialogDescription>
                Добавьте новый модельный ряд для производителя {manufacturer?.name}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Введите название модельного ряда"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание модельного ряда (необязательно)"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="is_active">Статус</Label>
                <Select
                  value={formData.is_active ? "true" : "false"}
                  onValueChange={(value) => setFormData({ ...formData, is_active: value === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Активен</SelectItem>
                    <SelectItem value="false">Неактивен</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {isSubmitting ? 'Создание...' : 'Создать'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}