"use client"

import React, { useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SiteSettings, AdditionalContact } from "@/lib/admin-data"
import { Save, Globe, Mail, Phone, MapPin, FileDown, Upload, Trash2, Edit, Download, X } from "lucide-react"
import { AdditionalContactsManager } from "@/components/admin/additional-contacts-manager"
import { toast } from "sonner"

// Update to use the admin store
import { useAdminStore } from "@/lib/admin-store"

interface CatalogFile {
  id: number
  title: string
  description: string | null
  file_url: string
  file_name: string
  file_size: string
  file_type: string
  year: number
  is_active: boolean
  download_count: number
  created_at: string
  updated_at: string
  created_by: number | null
  created_by_email: string | null
}

interface CatalogFormData {
  title: string
  description: string
  year: number
  file_url: string
  file_name: string
  file_size: number
  file_type: string
  is_active: boolean
}

export default function SettingsAdmin() {
  // Add at the beginning of the component:
  const { siteSettings: settings, updateSiteSettings, loadSiteSettings } = useAdminStore()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Catalog management state
  const [catalogs, setCatalogs] = useState<CatalogFile[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(true)
  const [showCatalogForm, setShowCatalogForm] = useState(false)
  const [editingCatalog, setEditingCatalog] = useState<CatalogFile | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [formData, setFormData] = useState<CatalogFormData>({
    title: '',
    description: '',
    year: new Date().getFullYear(),
    file_url: '',
    file_name: '',
    file_size: 0,
    file_type: '',
    is_active: true
  })

  // Update the handleSave function:
  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Проверяем что settings не null/undefined
      if (!settings) {
        toast.error("Ошибка: настройки не загружены")
        return
      }

      // Создаем объект с дефолтными значениями для безопасности
      const settingsToSave = {
        siteName: settings.siteName || 'МедСИП Протезирование',
        siteDescription: settings.siteDescription || '',
        heroTitle: settings.heroTitle || '',
        heroSubtitle: settings.heroSubtitle || '',
        contactEmail: settings.contactEmail || '',
        contactPhone: settings.contactPhone || '',
        address: settings.address || '',
        socialMedia: settings.socialMedia || {},
        additionalContacts: settings.additionalContacts || []
      }

      await updateSiteSettings(settingsToSave)
      toast.success("Настройки успешно сохранены!")
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('❌ handleSave error:', error)
      toast.error("Ошибка при сохранении настроек")
    }
    setIsSaving(false)
  }

  // Update the updateSetting function:
  const updateSetting = (key: keyof SiteSettings, value: any) => {
    if (!settings) {
      toast.error('Настройки не загружены')
      return
    }
    const updatedSettings = { ...settings, [key]: value }
    updateSiteSettings(updatedSettings)
    setHasUnsavedChanges(true)
  }

  // Update the updateSocialMedia function:
  const updateSocialMedia = (platform: string, value: string) => {
    if (!settings) {
      toast.error('Настройки не загружены')
      return
    }
    const updatedSettings = {
      ...settings,
      socialMedia: { ...settings.socialMedia, [platform]: value }
    }
    updateSiteSettings(updatedSettings)
    setHasUnsavedChanges(true)
  }

  // Update additional contacts function:
  const updateAdditionalContacts = (contacts: AdditionalContact[]) => {
    if (!settings) {
      toast.error('Настройки не загружены')
      return
    }
    const updatedSettings = {
      ...settings,
      additionalContacts: contacts
    }
    updateSiteSettings(updatedSettings)
    setHasUnsavedChanges(true)
  }

  // Catalog management functions
  const loadCatalogs = async () => {
    try {
      const response = await fetch('/api/catalog-files')
      const data = await response.json()

      if (data.success) {
        setCatalogs(data.data)
      } else {
        toast.error('Ошибка загрузки каталогов')
      }
    } catch (error) {
      toast.error('Ошибка загрузки каталогов')
    } finally {
      setLoadingCatalogs(false)
    }
  }

  // Load site settings and catalogs on component mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingSettings(true)
        // Загружаем настройки сайта
        await loadSiteSettings()
        // Загружаем каталоги
        await loadCatalogs()
      } catch (error) {
        console.error('❌ Error loading data:', error)
        toast.error('Ошибка загрузки данных')
      } finally {
        setIsLoadingSettings(false)
      }
    }

    loadData()
  }, [])

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

      if (response.ok && data.url) {
        setFormData(prev => ({
          ...prev,
          file_url: data.url,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          title: prev.title || file.name.replace(/\.[^/.]+$/, "")
        }))
        toast.success('Файл успешно загружен')
      } else {
        toast.error(data.error || 'Ошибка загрузки файла')
      }
    } catch (err) {
      toast.error('Ошибка загрузки файла')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleCatalogSubmit = async () => {
    try {
      if (!formData.title || !formData.file_url) {
        toast.error('Заполните обязательные поля')
        return
      }

      const endpoint = editingCatalog 
        ? `/api/catalog-files/${editingCatalog.id}`
        : '/api/catalog-files'

      const response = await fetch(endpoint, {
        method: editingCatalog ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        toast.success(editingCatalog ? 'Каталог обновлен' : 'Каталог добавлен')
        await loadCatalogs()
        resetForm()
      } else {
        toast.error(data.error || 'Ошибка сохранения')
      }
    } catch (error) {
      toast.error('Ошибка сохранения каталога')
    }
  }

  const handleDeleteCatalog = async (catalogId: number) => {
    try {
      const response = await fetch(`/api/catalog-files/${catalogId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Каталог удален')
        await loadCatalogs()
      } else {
        toast.error(data.error || 'Ошибка удаления')
      }
    } catch (error) {
      toast.error('Ошибка удаления каталога')
    }
  }

  const handleEditCatalog = (catalog: CatalogFile) => {
    setEditingCatalog(catalog)
    setFormData({
      title: catalog.title,
      description: catalog.description || '',
      year: catalog.year,
      file_url: catalog.file_url,
      file_name: catalog.file_name,
      file_size: parseInt(catalog.file_size),
      file_type: catalog.file_type,
      is_active: catalog.is_active
    })
    setShowCatalogForm(true)
  }

  const resetForm = () => {
    setEditingCatalog(null)
    setShowCatalogForm(false)
    setFormData({
      title: '',
      description: '',
      year: new Date().getFullYear(),
      file_url: '',
      file_name: '',
      file_size: 0,
      file_type: '',
      is_active: true
    })
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Настройки сайта</h1>
            <p className="text-slate-600">Настройте параметры вашего веб-сайта</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoadingSettings || !settings}
            className={`${hasUnsavedChanges ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Сохранение..." : hasUnsavedChanges ? "Сохранить изменения*" : "Сохранить изменения"}
          </Button>
        </div>

        {isLoadingSettings ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Загрузка настроек...</p>
            </div>
          </div>
        ) : !settings ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">Ошибка загрузки настроек</p>
            <Button onClick={() => loadSiteSettings()} variant="outline">
              Попробовать снова
            </Button>
          </div>
        ) : (

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">Основные</TabsTrigger>
            <TabsTrigger value="content">Контент</TabsTrigger>
            <TabsTrigger value="contact">Контакты</TabsTrigger>
            <TabsTrigger value="additional">Доп. контакты</TabsTrigger>
            <TabsTrigger value="social">Соцсети</TabsTrigger>
            <TabsTrigger value="catalogs">Каталоги</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Основные настройки
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="siteName">Название сайта *</Label>
                  <Input
                    id="siteName"
                    value={settings?.siteName || ""}
                    onChange={(e) => updateSetting("siteName", e.target.value)}
                    placeholder="МедСИП Протезирование"
                    required
                  />
                  {!settings?.siteName && (
                    <p className="text-sm text-red-500 mt-1">Обязательное поле</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="siteDescription">Описание сайта</Label>
                  <Textarea
                    id="siteDescription"
                    value={settings?.siteDescription || ""}
                    onChange={(e) => updateSetting("siteDescription", e.target.value)}
                    rows={3}
                    placeholder="Краткое описание вашего сайта"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content">
            <Card>
              <CardHeader>
                <CardTitle>Контент главной секции</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="heroTitle">Заголовок главной секции</Label>
                  <Input
                    id="heroTitle"
                    value={settings?.heroTitle || ""}
                    onChange={(e) => updateSetting("heroTitle", e.target.value)}
                    placeholder="Передовые протезы, персонализированная забота"
                  />
                </div>
                <div>
                  <Label htmlFor="heroSubtitle">Подзаголовок главной секции</Label>
                  <Textarea
                    id="heroSubtitle"
                    value={settings?.heroSubtitle || ""}
                    onChange={(e) => updateSetting("heroSubtitle", e.target.value)}
                    rows={3}
                    placeholder="Описание ваших услуг и преимуществ"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Контактная информация
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="contactEmail" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Электронная почта
                  </Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={settings?.contactEmail || ""}
                    onChange={(e) => updateSetting("contactEmail", e.target.value)}
                    placeholder="info@medsip-prosthetics.ru"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Номер телефона
                  </Label>
                  <Input
                    id="contactPhone"
                    value={settings?.contactPhone || ""}
                    onChange={(e) => updateSetting("contactPhone", e.target.value)}
                    placeholder="+7 (495) 123-45-67"
                  />
                </div>
                <div>
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Адрес
                  </Label>
                  <Textarea
                    id="address"
                    value={settings?.address || ""}
                    onChange={(e) => updateSetting("address", e.target.value)}
                    rows={2}
                    placeholder="ул. Медицинская, 15, Москва, 119991"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="additional">
            <AdditionalContactsManager
              contacts={settings?.additionalContacts || []}
              onChange={updateAdditionalContacts}
            />
          </TabsContent>

          <TabsContent value="social">
            <Card>
              <CardHeader>
                <CardTitle>Ссылки на социальные сети</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="vk">ВКонтакте</Label>
                  <Input
                    id="vk"
                    value={settings?.socialMedia?.vk || ""}
                    onChange={(e) => updateSocialMedia("vk", e.target.value)}
                    placeholder="https://vk.com/medsip_prosthetics"
                  />
                </div>
                <div>
                  <Label htmlFor="telegram">Telegram</Label>
                  <Input
                    id="telegram"
                    value={settings?.socialMedia?.telegram || ""}
                    onChange={(e) => updateSocialMedia("telegram", e.target.value)}
                    placeholder="https://t.me/medsip_prosthetics"
                  />
                </div>
                <div>
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input
                    id="youtube"
                    value={settings?.socialMedia?.youtube || ""}
                    onChange={(e) => updateSocialMedia("youtube", e.target.value)}
                    placeholder="https://youtube.com/@medsip_prosthetics"
                  />
                </div>
                <div>
                  <Label htmlFor="ok">Одноклассники</Label>
                  <Input
                    id="ok"
                    value={settings?.socialMedia?.ok || ""}
                    onChange={(e) => updateSocialMedia("ok", e.target.value)}
                    placeholder="https://ok.ru/medsip.prosthetics"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalogs">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileDown className="w-5 h-5" />
                    Управление каталогами
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-slate-600">
                      Загружайте и управляйте каталогами для загрузки посетителями сайта
                    </p>
                    <Button
                      onClick={() => setShowCatalogForm(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Добавить каталог
                    </Button>
                  </div>

                  {/* Catalog Upload Form */}
                  {showCatalogForm && (
                    <Card className="mb-6 border-blue-200">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {editingCatalog ? 'Редактировать каталог' : 'Добавить новый каталог'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="catalogTitle">Название каталога</Label>
                            <Input
                              id="catalogTitle"
                              value={formData.title}
                              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Каталог 2025"
                            />
                          </div>
                          <div>
                            <Label htmlFor="catalogYear">Год</Label>
                            <Input
                              id="catalogYear"
                              type="number"
                              value={formData.year}
                              onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                              min="2020"
                              max="2030"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="catalogDescription">Описание (необязательно)</Label>
                          <Textarea
                            id="catalogDescription"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Описание каталога..."
                            rows={3}
                          />
                        </div>

                        <div>
                          <Label htmlFor="catalogFile">Файл каталога *</Label>
                          {!formData.file_url ? (
                            <div className="mt-2">
                              <Input
                                id="catalogFile"
                                type="file"
                                accept=".pdf,.xlsx,.xls,.doc,.docx"
                                onChange={handleFileUpload}
                                disabled={uploadingFile}
                                className="mb-2"
                              />
                              {uploadingFile && (
                                <p className="text-sm text-blue-600 flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                  Загрузка файла...
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileDown className="w-4 h-4 text-green-600" />
                                  <span className="text-sm text-green-800">{formData.file_name}</span>
                                  <span className="text-xs text-green-600">
                                    ({(formData.file_size / 1024 / 1024).toFixed(2)} МБ)
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setFormData(prev => ({ ...prev, file_url: '', file_name: '', file_size: 0 }))}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="catalogActive"
                            checked={formData.is_active}
                            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                            className="rounded"
                          />
                          <Label htmlFor="catalogActive">Активный каталог</Label>
                        </div>

                        <div className="flex gap-3">
                          <Button
                            onClick={handleCatalogSubmit}
                            disabled={!formData.title || !formData.file_url}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {editingCatalog ? 'Обновить' : 'Сохранить'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={resetForm}
                          >
                            Отмена
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Catalogs List */}
                  <div className="space-y-4">
                    {loadingCatalogs ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-slate-600 mt-2">Загрузка каталогов...</p>
                      </div>
                    ) : catalogs.length === 0 ? (
                      <div className="text-center py-8">
                        <FileDown className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600">Каталоги пока не загружены</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {catalogs.map((catalog) => (
                          <Card key={catalog.id} className="border-slate-200">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-semibold text-lg">{catalog.title}</h3>
                                    <span className="text-sm bg-slate-100 px-2 py-1 rounded">
                                      {catalog.year}
                                    </span>
                                    <span className={`text-sm px-2 py-1 rounded ${
                                      catalog.is_active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {catalog.is_active ? 'Активный' : 'Неактивный'}
                                    </span>
                                  </div>
                                  {catalog.description && (
                                    <p className="text-slate-600 text-sm mb-2">{catalog.description}</p>
                                  )}
                                  <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span>📄 {catalog.file_name}</span>
                                    <span>📦 {(parseInt(catalog.file_size) / 1024 / 1024).toFixed(2)} МБ</span>
                                    <span>📊 {catalog.download_count} скачиваний</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditCatalog(catalog)}
                                    title="Редактировать информацию о каталоге"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(catalog.file_url, '_blank')}
                                    title="Скачать каталог"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm(`Удалить каталог "${catalog.title}"?`)) {
                                        handleDeleteCatalog(catalog.id)
                                      }
                                    }}
                                    title="Удалить каталог"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </div>
    </AdminLayout>
  )
}
