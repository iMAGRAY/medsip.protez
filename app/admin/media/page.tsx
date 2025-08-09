"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { MediaGallery } from "@/components/admin/media-gallery"
import { MediaUploader } from "@/components/admin/media-uploader"
import { ExportImport } from "@/components/admin/export-import"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageIcon, Upload, Download, RefreshCw } from "lucide-react"
import { useState, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { MediaGalleryRef } from "@/components/admin/media-gallery"

export default function MediaAdmin() {
  const [activeTab, setActiveTab] = useState("gallery")
  const [isSyncing, setIsSyncing] = useState(false)
  const mediaGalleryRef = useRef<MediaGalleryRef>(null)

  const handleUploadComplete = (urls: string[]) => {

    toast.success(`Успешно загружено ${urls.length} файл(ов)`)

    // Переключаемся на галерею и обновляем её
    setActiveTab("gallery")

    // Обновляем галерею (если есть метод refresh)
    if (mediaGalleryRef.current?.refresh) {
      setTimeout(() => {
        mediaGalleryRef.current?.refresh()
      }, 1000) // Небольшая задержка для завершения загрузки
    }
  }

  const handleSyncFiles = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/media/sync', {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Синхронизация завершена: ${result.synced} добавлено, ${result.skipped} пропущено`)

        // Обновляем галерею
        if (mediaGalleryRef.current?.refresh) {
          mediaGalleryRef.current.refresh()
        }
      } else {
        toast.error(`Ошибка синхронизации: ${result.error}`)
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Ошибка при синхронизации файлов')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Управление медиа</h1>
            <p className="text-slate-600">Загрузка, управление и организация изображений товаров</p>
          </div>
          <Button
            onClick={handleSyncFiles}
            disabled={isSyncing}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Синхронизация...' : 'Синхронизировать с S3'}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="gallery" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Галерея
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Загрузка
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Резервное копирование
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gallery">
            <MediaGallery ref={mediaGalleryRef} />
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Загрузка новых изображений</CardTitle>
                <p className="text-sm text-slate-600">
                  Поддерживаются форматы: JPEG, PNG, WebP, GIF. Максимальный размер файла: 5 МБ
                </p>
              </CardHeader>
              <CardContent>
                <MediaUploader
                  onUploadComplete={handleUploadComplete}
                  maxFiles={10}
                  folder="products"
                  acceptedTypes={["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup">
            <ExportImport />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}
