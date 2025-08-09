"use client"

import React, { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Users,
  Building2,
  Globe,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
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
  sort_order: number
  created_at: string
  updated_at: string
  model_lines_count: string
}

interface FormData {
  name: string
  description: string
  website_url: string
  country: string
  founded_year: string
  logo_url: string
}

export default function ManufacturersAdminPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    website_url: '',
    country: '',
    founded_year: '',
    logo_url: ''
  })

  useEffect(() => {
    loadManufacturers()
  }, [])

  const loadManufacturers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/manufacturers')
      const data = await response.json()

      if (data.success) {
        setManufacturers(data.data)
      } else {
        setMessage({ type: 'error', text: 'Ошибка загрузки производителей' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      website_url: '',
      country: '',
      founded_year: '',
      logo_url: ''
    })
    setEditingManufacturer(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (manufacturer: Manufacturer) => {
    setFormData({
      name: manufacturer.name,
      description: manufacturer.description || '',
      website_url: manufacturer.website_url || '',
      country: manufacturer.country || '',
      founded_year: manufacturer.founded_year?.toString() || '',
      logo_url: manufacturer.logo_url || ''
    })
    setEditingManufacturer(manufacturer)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Название производителя обязательно' })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const url = editingManufacturer
        ? `/api/manufacturers/${editingManufacturer.id}`
        : '/api/manufacturers'

      const method = editingManufacturer ? 'PUT' : 'POST'

      const payload = {
        ...formData,
        founded_year: formData.founded_year ? parseInt(formData.founded_year) : null
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({
          type: 'success',
          text: editingManufacturer ? 'Производитель обновлен' : 'Производитель создан'
        })
        setIsDialogOpen(false)
        resetForm()
        loadManufacturers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка сохранения' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить производителя "${name}"?`)) {
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/manufacturers/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Производитель успешно удален' })
        loadManufacturers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка удаления' })
      }
    } catch (error) {
      console.error('Error deleting manufacturer:', error)
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Производители</h1>
            <p className="text-slate-600 mt-1">
              Управление производителями протезов и медицинских изделий
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="bg-blue-500 hover:bg-blue-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Добавить производителя
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingManufacturer ? 'Редактировать производителя' : 'Добавить производителя'}
                </DialogTitle>
                <DialogDescription>
                  {editingManufacturer ? 'Изменение информации о существующем производителе товаров' : 'Добавление нового производителя медицинских изделий'}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Название *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Название производителя"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="country">Страна</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="Страна производителя"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Описание производителя"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="website_url">Веб-сайт</Label>
                    <Input
                      id="website_url"
                      type="url"
                      value={formData.website_url}
                      onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="founded_year">Год основания</Label>
                    <Input
                      id="founded_year"
                      type="number"
                      value={formData.founded_year}
                      onChange={(e) => setFormData({ ...formData, founded_year: e.target.value })}
                      placeholder="2020"
                      min="1800"
                      max={new Date().getFullYear()}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="logo_url">URL логотипа</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
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
                    {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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
            <p className="text-slate-600 mt-2">Загрузка производителей...</p>
          </div>
        )}

        {/* Manufacturers Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manufacturers.map((manufacturer) => (
              <Card key={manufacturer.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Logo */}
                {manufacturer.logo_url && (
                  <div className="h-32 bg-slate-50 flex items-center justify-center p-4">
                    <img
                      src={manufacturer.logo_url}
                      alt={manufacturer.name}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{manufacturer.name}</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(manufacturer)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(manufacturer.id, manufacturer.name)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <Badge variant={manufacturer.is_active ? "default" : "secondary"}>
                      {manufacturer.is_active ? "Активен" : "Неактивен"}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {manufacturer.model_lines_count} линеек
                    </Badge>
                  </div>

                  {/* Country & Year */}
                  <div className="space-y-2 text-sm">
                    {manufacturer.country && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="h-4 w-4" />
                        {manufacturer.country}
                      </div>
                    )}

                    {manufacturer.founded_year && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="h-4 w-4" />
                        Основан в {manufacturer.founded_year}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {manufacturer.description && (
                    <p className="text-sm text-slate-700 line-clamp-2">
                      {manufacturer.description}
                    </p>
                  )}

                  {/* Website */}
                  {manufacturer.website_url && (
                    <a
                      href={manufacturer.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
                    >
                      <Globe className="h-4 w-4" />
                      Официальный сайт
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <InstantLink
                      href={`/admin/manufacturers/${manufacturer.id}`}
                      className="flex-1"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Building2 className="w-4 h-4 mr-1" />
                        Модельные ряды ({manufacturer.model_lines_count})
                      </Button>
                    </InstantLink>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && manufacturers.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Производители не найдены
              </h3>
              <p className="text-slate-600 mb-4">
                Добавьте первого производителя протезов и медицинских изделий
              </p>
              <Button onClick={openCreateDialog} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="w-4 h-4 mr-2" />
                Добавить производителя
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}