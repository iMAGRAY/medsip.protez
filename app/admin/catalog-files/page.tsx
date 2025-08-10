"use client"

import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileDown, Plus, Pencil, Trash2, Eye, Calendar } from 'lucide-react'
import { formatDate } from "@/lib/utils"
import { useAuth } from "@/components/admin/auth-guard"

interface CatalogFile {
  id: number
  title: string
  description?: string
  file_url: string
  file_name: string
  file_size?: number
  file_type?: string
  year: number
  is_active: boolean
  download_count: number
  created_at: string
  updated_at: string
  created_by_email?: string
}

interface CatalogFormData {
  title: string
  description: string
  file_url: string
  file_name: string
  file_size?: number
  file_type?: string
  year: number
  is_active: boolean
}

export default function CatalogFilesPage() {
  const { authStatus, hasPermission } = useAuth()
  const [catalogs, setCatalogs] = useState<CatalogFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCatalog, setEditingCatalog] = useState<CatalogFile | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  // Проверяем права доступа
  const canViewCatalogs = hasPermission('catalog.view') || hasPermission('catalog.*') || hasPermission('*')
  const canCreateCatalogs = hasPermission('catalog.create') || hasPermission('catalog.*') || hasPermission('*')
  const canUpdateCatalogs = hasPermission('catalog.update') || hasPermission('catalog.*') || hasPermission('*')
  const canDeleteCatalogs = hasPermission('catalog.delete') || hasPermission('catalog.*') || hasPermission('*')


  const [formData, setFormData] = useState<CatalogFormData>({
    title: '',
    description: '',
    file_url: '',
    file_name: '',
    file_size: undefined,
    file_type: '',
    year: new Date().getFullYear(),
    is_active: true
  })

  // Загрузка каталогов
  const loadCatalogs = useCallback(async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/catalog-files?active=false')
        const data = await response.json()

        if (data.success) {
          setCatalogs(data.data)
        } else {
          setError(data.error || 'Ошибка загрузки каталогов')
        }
      } catch (err) {
        setError('Ошибка соединения с сервером')
        console.error('Error loading catalogs:', err)
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    loadCatalogs()
  }, [loadCatalogs])

  // Обработка загрузки файла
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingFile(true)

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('category', 'catalog')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const data = await response.json()

      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          file_url: data.url,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          title: prev.title || file.name.replace(/\.[^/.]+$/, "") // Убираем расширение
        }))
      } else {
        setError(data.error || 'Ошибка загрузки файла')
      }
    } catch (err) {
      setError('Ошибка загрузки файла')
      console.error('Error uploading file:', err)
    } finally {
      setUploadingFile(false)
    }
  }

  // Сохранение каталога
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.file_url) {
      setError('Заполните обязательные поля: название и файл')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const url = editingCatalog
        ? `/api/catalog-files/${editingCatalog.id}`
        : '/api/catalog-files'

      const _method = editingCatalog ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        await loadCatalogs()
        setIsDialogOpen(false)
        resetForm()
      } else {
        setError(data.error || 'Ошибка сохранения каталога')
      }
    } catch (err) {
      setError('Ошибка соединения с сервером')
      console.error('Error saving catalog:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Удаление каталога
  const handleDelete = async (catalog: CatalogFile) => {
    if (!confirm(`Удалить каталог "${catalog.title}"?`)) return

    try {
      const response = await fetch(`/api/catalog-files/${catalog.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await loadCatalogs()
      } else {
        setError(data.error || 'Ошибка удаления каталога')
      }
    } catch (err) {
      setError('Ошибка соединения с сервером')
      console.error('Error deleting catalog:', err)
    }
  }

  // Редактирование каталога
  const handleEdit = (catalog: CatalogFile) => {
    setEditingCatalog(catalog)
    setFormData({
      title: catalog.title,
      description: catalog.description || '',
      file_url: catalog.file_url,
      file_name: catalog.file_name,
      file_size: catalog.file_size,
      file_type: catalog.file_type,
      year: catalog.year,
      is_active: catalog.is_active
    })
    setIsDialogOpen(true)
  }

  // Сброс формы
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      file_url: '',
      file_name: '',
      file_size: undefined,
      file_type: '',
      year: new Date().getFullYear(),
      is_active: true
    })
    setEditingCatalog(null)
    setError(null)
  }

  // Форматирование размера файла
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-'
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // Ранний возврат без прав — после хуков
  if (!canViewCatalogs) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <FileDown className="w-8 h-8 text-red-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Доступ запрещен</h3>
                <p className="text-gray-600">У вас нет прав для просмотра каталогов</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Загрузка каталогов...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Управление каталогами</h1>
          <p className="text-gray-600">Загрузка и управление файлами каталогов</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button 
              className="flex items-center gap-2"
              disabled={!canCreateCatalogs}
            >
              <Plus className="w-4 h-4" />
              Добавить каталог
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCatalog ? 'Редактировать каталог' : 'Добавить каталог'}
              </DialogTitle>
              <DialogDescription>
                Заполните информацию о каталоге и загрузите файл
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">
                    Название *
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="col-span-3"
                    placeholder="Каталог 2025"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="year" className="text-right">
                    Год
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    className="col-span-3"
                    min="2020"
                    max="2030"
                  />
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="description" className="text-right">
                    Описание
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="col-span-3"
                    placeholder="Описание каталога..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="file" className="text-right">
                    Файл *
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="file"
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      disabled={uploadingFile}
                    />
                    {uploadingFile && (
                      <p className="text-sm text-gray-500 mt-1">Загрузка файла...</p>
                    )}
                    {formData.file_name && (
                      <p className="text-sm text-green-600 mt-1">
                        Файл: {formData.file_name} ({formatFileSize(formData.file_size)})
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="is_active" className="text-right">
                    Активный
                  </Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={isSubmitting || uploadingFile}>
                  {isSubmitting ? 'Сохранение...' : editingCatalog ? 'Обновить' : 'Добавить'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && !isDialogOpen && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Список каталогов</CardTitle>
          <CardDescription>
            Всего каталогов: {catalogs.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Год</TableHead>
                <TableHead>Файл</TableHead>
                <TableHead>Скачивания</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.map((catalog) => (
                <TableRow key={catalog.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{catalog.title}</div>
                      {catalog.description && (
                        <div className="text-sm text-gray-500 mt-1">
                          {catalog.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {catalog.year}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{catalog.file_name}</div>
                      <div className="text-gray-500">
                        {formatFileSize(catalog.file_size)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <FileDown className="w-4 h-4" />
                      {catalog.download_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={catalog.is_active ? "default" : "secondary"}>
                      {catalog.is_active ? 'Активный' : 'Неактивный'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDate(catalog.created_at)}</div>
                      {catalog.created_by_email && (
                        <div className="text-gray-500">{catalog.created_by_email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(catalog.file_url, '_blank')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(catalog)}
                        disabled={!canUpdateCatalogs}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(catalog)}
                        disabled={!canDeleteCatalogs}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {catalogs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Каталоги не найдены
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  )
}