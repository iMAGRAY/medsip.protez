"use client"

import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Trash2,
  Copy,
  ExternalLink,
  ImageIcon,
  Grid3X3,
  Grid2X2,
  Rows3,
  Loader2,
  Clock,
  X,
  AlertTriangle,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Zap,
  Activity,
  Monitor
} from "lucide-react"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"
import { SafeImage } from "@/components/safe-image"

import { useOptimizedMedia } from "@/hooks/use-optimized-media"
import { VirtualizedMediaGrid } from "./virtualized-media-grid"
import { toast } from "sonner"
// Простой кеш настроек в памяти для клиентской стороны
const settingsCache = new Map<string, any>()

interface MediaFile {
  name: string
  url: string
  size: number
  uploadedAt: Date
  productName?: string
  productId?: string
  type?: 'upload' | 'product' | 's3'
  source?: 'product' | 's3'
  key?: string
}

interface PerformanceData {
  totalTime: number
  s3Time?: number
  sortTime?: number
  fileCount?: number
  clientTime?: number
  error?: boolean
  mode?: string
}

type ViewMode = 'small' | 'medium' | 'large' | 'list'
type SortMode = 'name' | 'size' | 'date' | 'product'
type FilterMode = 'all' | 'assigned' | 'unassigned'

export interface MediaGalleryRef {
  refresh: () => Promise<void>
}

interface UserSettings {
  viewMode: ViewMode
  sortMode: SortMode
  filterMode: FilterMode
}

export const MediaGallery = forwardRef<MediaGalleryRef>((props, ref) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [enableVirtualization, setEnableVirtualization] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Используем оптимизированный хук для загрузки медиафайлов
  const {
    mediaFiles,
    loading,
    loadingMore,
    hasMore,
    performance,
    error: mediaError,
    loadMore,
    refresh,
    clearCache
  } = useOptimizedMedia({
    pageSize: 30, // Больше элементов для виртуализации
    enableCaching: true,
    maxConcurrentRequests: 2,
    throttleMs: 100,
    enableVirtualization
  })

  // Состояния с серверным хранением настроек
  const [userSettings, setUserSettings] = useState<UserSettings>({
    viewMode: 'medium',
    sortMode: 'date',
    filterMode: 'all'
  })

  const [settingsLoading, setSettingsLoading] = useState(true)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [deletedImages, setDeletedImages] = useState<Set<string>>(new Set())

  // Загрузка пользовательских настроек
  useEffect(() => {
    loadUserSettings()
  }, [])

  const loadUserSettings = async () => {
    try {
      setSettingsLoading(true)

      // Пытаемся загрузить из кеша
      const cachedSettings = settingsCache.get('media-gallery-settings')
      if (cachedSettings) {
        setUserSettings(cachedSettings)
        setSettingsLoading(false)
        return
      }

      // Загружаем с сервера (можно расширить API для пользовательских настроек)
      const defaultSettings: UserSettings = {
        viewMode: 'medium',
        sortMode: 'date',
        filterMode: 'all'
      }

      setUserSettings(defaultSettings)
      // Кешируем настройки по умолчанию
      settingsCache.set('media-gallery-settings', defaultSettings)

    } catch (error) {

      // Используем настройки по умолчанию в случае ошибки
      setUserSettings({
        viewMode: 'medium',
        sortMode: 'date',
        filterMode: 'all'
      })
    } finally {
      setSettingsLoading(false)
    }
  }

  const saveUserSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const updatedSettings = { ...userSettings, ...newSettings }
      setUserSettings(updatedSettings)

      // Сохраняем в кеш для быстрого доступа
      settingsCache.set('media-gallery-settings', updatedSettings)

    } catch (error) {

      toast.error('Ошибка сохранения настроек')
    }
  }

  // Обработчики изменения настроек
  const handleViewModeChange = useCallback((viewMode: ViewMode) => {
    saveUserSettings({ viewMode })
  }, [userSettings])

  const handleSortModeChange = useCallback((sortMode: SortMode) => {
    saveUserSettings({ sortMode })
  }, [userSettings])

  const handleFilterModeChange = useCallback((filterMode: FilterMode) => {
    saveUserSettings({ filterMode })
  }, [userSettings])

  // Загрузка дополнительных файлов (теперь через оптимизированный хук)
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    await loadMore()
  }, [loadingMore, hasMore, loadMore])

  // Обработка выделения изображений
  const toggleImageSelection = useCallback((imageUrl: string) => {
    setSelectedImages(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(imageUrl)) {
        newSelected.delete(imageUrl)
      } else {
        newSelected.add(imageUrl)
      }
      return newSelected
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedImages(new Set())
  }, [])

  // Мемоизированная обработка изображений
  const allImages = useMemo(() => {
    return mediaFiles
      .filter(file => !deletedImages.has(file.url)) // Исключаем удаленные изображения
      .map(file => ({
        ...file,
        type: 's3' as const,
      }))
  }, [mediaFiles, deletedImages])

  // Фильтрация изображений
  const filteredImages = useMemo(() => {
    let filtered = allImages.filter((image) =>
      (image.productName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (image.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (image.url || "").toLowerCase().includes(searchQuery.toLowerCase()),
    )

    // Применение фильтра по назначению
    switch (userSettings.filterMode) {
      case 'assigned':
        filtered = filtered.filter(img => img.productName && img.productId)
        break
      case 'unassigned':
        filtered = filtered.filter(img => !img.productName || !img.productId)
        break
      case 'all':
      default:
        // Показываем все
        break
    }

    return filtered
  }, [allImages, searchQuery, userSettings.filterMode])

  // Сортировка изображений и исключение удаленных
  const filteredAndSortedImages = useMemo(() => {
    // Сначала исключаем удаленные изображения
    const notDeleted = filteredImages.filter(image => !deletedImages.has(image.url))

    const sorted = [...notDeleted]

    switch (userSettings.sortMode) {
      case 'name':
        sorted.sort((a, b) => (a.productName || a.name || '').localeCompare(b.productName || b.name || ''))
        break
      case 'size':
        sorted.sort((a, b) => b.size - a.size)
        break
      case 'date':
        sorted.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        break
      case 'product':
        sorted.sort((a, b) => {
          const aProduct = a.productName || 'zzz_Не назначено'
          const bProduct = b.productName || 'zzz_Не назначено'
          return aProduct.localeCompare(bProduct)
        })
        break
      default:
        break
    }

    return sorted
  }, [filteredImages, userSettings.sortMode, deletedImages])

  const selectAllImages = useCallback(() => {
    setSelectedImages(new Set(filteredAndSortedImages.map(img => img.url)))
  }, [filteredAndSortedImages])

  const copyToClipboard = useCallback((url: string) => {
    navigator.clipboard.writeText(url)
    toast.success("URL скопирован в буфер обмена")
  }, [])

  // Удаление одного изображения с мгновенным исчезновением
  const handleDeleteImage = useCallback(async (url: string, imageType?: string) => {
    try {
      if (!confirm("Вы уверены, что хотите удалить это изображение?")) {
        return
      }

      // Мгновенно скрываем изображение с анимацией
      setDeletedImages(prev => new Set([...prev, url]))
      setSelectedImages(prev => {
        const newSelected = new Set(prev)
        newSelected.delete(url)
        return newSelected
      })

      // Показываем оптимистичное уведомление
      toast.success("Изображение удаляется...")

      const response = await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (response.ok) {
        const result = await response.json()

        // Обновляем уведомление об успехе
        toast.success("Изображение удалено")

        // Обновляем данные в фоне для синхронизации
        setTimeout(async () => {
          await refresh()
          // Окончательно удаляем из локального списка
          setDeletedImages(prev => {
            const newDeleted = new Set(prev)
            newDeleted.delete(url)
            return newDeleted
          })
        }, 500)
      } else {
        const errorText = await response.text()

        toast.error(`Ошибка при удалении: ${errorText}`)

        // Возвращаем изображение в случае ошибки
        setDeletedImages(prev => {
          const newDeleted = new Set(prev)
          newDeleted.delete(url)
          return newDeleted
        })
      }
    } catch (error) {

      toast.error("Ошибка при удалении изображения")

      // Возвращаем изображение в случае ошибки
      setDeletedImages(prev => {
        const newDeleted = new Set(prev)
        newDeleted.delete(url)
        return newDeleted
      })
    }
  }, [refresh])

  // Batch удаление выбранных изображений с мгновенным исчезновением
  const handleBulkDelete = useCallback(async () => {
    if (selectedImages.size === 0) return

    try {
      if (!confirm(`Вы уверены, что хотите удалить ${selectedImages.size} изображений?`)) {
        return
      }

      setBulkDeleting(true)

      // Мгновенно скрываем все выбранные изображения
      const imagesToDelete = Array.from(selectedImages)
      setDeletedImages(prev => new Set([...prev, ...imagesToDelete]))
      setSelectedImages(new Set())

      // Показываем оптимистичное уведомление
      toast.success(`Удаляется ${imagesToDelete.length} изображений...`)

      let deletedCount = 0
      let errorCount = 0
      const failedImages: string[] = []

      for (const imageUrl of imagesToDelete) {
        try {
          const response = await fetch('/api/media/delete', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: imageUrl }),
          })

          if (response.ok) {
            deletedCount++
          } else {
            errorCount++
            failedImages.push(imageUrl)

          }
        } catch (error) {
          errorCount++
          failedImages.push(imageUrl)

        }
      }

      // Возвращаем неудачно удаленные изображения
      if (failedImages.length > 0) {
        setDeletedImages(prev => {
          const newDeleted = new Set(prev)
          failedImages.forEach(url => newDeleted.delete(url))
          return newDeleted
        })
      }

      // Показываем результат
      if (deletedCount > 0) {
        toast.success(`Удалено: ${deletedCount} изображений${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`)
      } else {
        toast.error('Ошибка: не удалось удалить ни одного изображения')
      }

      // Обновляем данные в фоне
      setTimeout(async () => {
        await refresh()
        // Окончательно очищаем список удаленных изображений
        setDeletedImages(prev => {
          const newDeleted = new Set(prev)
          imagesToDelete.forEach(url => {
            if (!failedImages.includes(url)) {
              newDeleted.delete(url)
            }
          })
          return newDeleted
        })
      }, 500)

    } catch (error) {

      toast.error("Ошибка при массовом удалении")

      // Возвращаем все изображения в случае общей ошибки
      setDeletedImages(prev => {
        const newDeleted = new Set(prev)
        Array.from(selectedImages).forEach(url => newDeleted.delete(url))
        return newDeleted
      })
    } finally {
      setBulkDeleting(false)
    }
  }, [selectedImages, refresh])

  // Функция для получения оптимизированного URL изображения
  const getOptimizedImageUrl = useCallback((url: string, width = 200, height = 200) => {
    if (url.includes('s3.twcstorage.ru')) {
      return `${url}?width=${width}&height=${height}&fit=cover`
    }
    return url
  }, [])

  // Получение CSS классов для разных режимов отображения
  const getGridClasses = useCallback(() => {
    switch (userSettings.viewMode) {
      case 'small':
        return 'grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2'
      case 'medium':
        return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'
      case 'large':
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
      case 'list':
        return 'space-y-2'
      default:
        return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'
    }
  }, [userSettings.viewMode])

  // Получение размера изображения для режима отображения
  const getImageSize = useCallback(() => {
    switch (userSettings.viewMode) {
      case 'small': return { width: 120, height: 120 }
      case 'medium': return { width: 200, height: 200 }
      case 'large': return { width: 300, height: 300 }
      case 'list': return { width: 80, height: 80 }
      default: return { width: 200, height: 200 }
    }
  }, [userSettings.viewMode])

  useImperativeHandle(ref, () => ({
    refresh: async () => {
      await refresh()
      setDeletedImages(new Set()) // Очищаем локальный список удаленных изображений
    }
  }), [refresh])

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Медиа галерея ({filteredAndSortedImages.length} изображений)
            {selectedImages.size > 0 && (
              <Badge variant="secondary">
                {selectedImages.size} выбрано
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-4">
            {/* Performance Info и Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearCache()
                  setDeletedImages(new Set()) // Очищаем локальный список удаленных изображений
                }}
                title="Очистить кэш"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>

              <Button
                size="sm"
                variant={enableVirtualization ? "default" : "outline"}
                onClick={() => setEnableVirtualization(!enableVirtualization)}
                title="Виртуализация (для больших списков)"
              >
                <Zap className="w-4 h-4" />
              </Button>
            </div>

            {performance && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Activity className="w-4 h-4" />
                <span>
                  {performance.totalTime}ms
                  {performance.s3Time && ` (S3: ${performance.s3Time}ms)`}
                  {performance.clientTime && ` (Client: ${performance.clientTime}ms)`}
                  {performance.cached && (
                    <Badge variant="secondary" className="ml-1">Cache</Badge>
                  )}
                </span>
                {performance.error && <Badge variant="destructive">Error</Badge>}
                {performance.requestId && (
                  <Badge variant="outline" className="text-xs">
                    {performance.requestId}
                  </Badge>
                )}
              </div>
            )}

            {/* Filter and Sort */}
            <div className="flex items-center gap-2">
              <Select value={userSettings.filterMode} onValueChange={(value: FilterMode) => handleFilterModeChange(value)}>
                <SelectTrigger className="w-32">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все файлы</SelectItem>
                  <SelectItem value="assigned">Назначенные</SelectItem>
                  <SelectItem value="unassigned">Без назначения</SelectItem>
                </SelectContent>
              </Select>

              <Select value={userSettings.sortMode} onValueChange={(value: SortMode) => handleSortModeChange(value)}>
                <SelectTrigger className="w-32">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">По дате</SelectItem>
                  <SelectItem value="name">По имени</SelectItem>
                  <SelectItem value="size">По размеру</SelectItem>
                  <SelectItem value="product">По товару</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                size="sm"
                variant={userSettings.viewMode === 'small' ? 'default' : 'ghost'}
                onClick={() => handleViewModeChange('small')}
                className="p-2"
                title="Мелкие изображения"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={userSettings.viewMode === 'medium' ? 'default' : 'ghost'}
                onClick={() => handleViewModeChange('medium')}
                className="p-2"
                title="Средние изображения"
              >
                <Grid2X2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={userSettings.viewMode === 'large' ? 'default' : 'ghost'}
                onClick={() => handleViewModeChange('large')}
                className="p-2"
                title="Большие изображения"
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={userSettings.viewMode === 'list' ? 'default' : 'ghost'}
                onClick={() => handleViewModeChange('list')}
                className="p-2"
                title="Список"
              >
                <Rows3 className="w-4 h-4" />
              </Button>
            </div>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Поиск изображений..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Batch Actions */}
        {filteredAndSortedImages.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedImages.size === filteredAndSortedImages.length && filteredAndSortedImages.length > 0}
                  onCheckedChange={(checked) => checked ? selectAllImages() : clearSelection()}
                />
                <span className="text-sm text-slate-600">
                  Выбрать все ({filteredAndSortedImages.length})
                </span>
              </div>

              {selectedImages.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearSelection}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Снять выделение
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Удаление...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Удалить ({selectedImages.size})
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {performance && (
              <div className="flex gap-4 text-xs text-slate-500">
                <span>Total: {performance.totalTime}ms</span>
                {performance.s3Time && <span>S3: {performance.s3Time}ms</span>}
                {performance.fileCount && <span>Files: {performance.fileCount}</span>}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Показ ошибки загрузки */}
        {mediaError && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Ошибка загрузки:</strong> {mediaError}
              <Button
                size="sm"
                variant="outline"
                onClick={refresh}
                className="ml-2"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Повторить
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-500">Загрузка медиафайлов из S3...</p>
            {performance && (
              <p className="text-xs text-slate-400 mt-2">
                Запрос #{performance.requestId}
              </p>
            )}
          </div>
        ) : filteredAndSortedImages.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-500">
              {searchQuery || userSettings.filterMode !== 'all' ? 'Изображения не найдены' : 'Медиафайлы не найдены'}
            </p>
            <p className="text-xs text-amber-600 mt-2">
              {searchQuery || userSettings.filterMode !== 'all' ? 'Попробуйте изменить фильтры или поисковый запрос' : 'Загрузите изображения в S3 хранилище'}
            </p>
          </div>
        ) : (
          <>
            {userSettings.viewMode === 'list' ? (
              // Список режим
              <div className="space-y-2">
                {filteredAndSortedImages.map((image, index) => {
                  const isDeleting = deletedImages.has(image.url)

                  return (
                    <div
                      key={`${image.key || image.url}-${index}`}
                      className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-slate-50 transition-all duration-300 ${
                        isDeleting
                          ? 'opacity-0 scale-95 pointer-events-none'
                          : 'opacity-100 scale-100'
                      }`}
                    >
                      <Checkbox
                        checked={selectedImages.has(image.url)}
                        onCheckedChange={() => toggleImageSelection(image.url)}
                        disabled={isDeleting}
                      />

                      <div className="flex-shrink-0">
                        <div
                          className="cursor-pointer"
                          onClick={() => !isDeleting && setSelectedImage(image.url)}
                        >
                          <SafeImage
                            src={getOptimizedImageUrl(image.url, 80, 80) || PROSTHETIC_FALLBACK_IMAGE}
                            alt={`${image.productName || image.name} image`}
                            width={80}
                            height={80}
                            className={`w-20 h-20 object-cover rounded transition-all ${
                              isDeleting ? 'opacity-50' : ''
                            }`}
                          />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">
                          {image.productName || image.name}
                        </h3>
                        <p className="text-sm text-slate-500 truncate">
                          {image.url}
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {image.productId ? `ID: ${image.productId}` : 'Не назначено'}
                          </Badge>
                          {image.size > 0 && (
                            <span className="text-xs text-slate-500">
                              {(image.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            ☁️ S3 Storage
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(image.url)}
                          disabled={isDeleting}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(image.url, "_blank")}
                          disabled={isDeleting}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteImage(image.url, image.type)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Сетка режим - виртуализированная или обычная
              <div ref={containerRef} className="w-full" data-virtualized-grid-container>
                {enableVirtualization && filteredAndSortedImages.length > 50 ? (
                  // Виртуализированная сетка для больших списков
                  <div className="h-[600px] w-full">
                    <VirtualizedMediaGrid
                      mediaFiles={filteredAndSortedImages}
                      viewMode={userSettings.viewMode}
                      selectedImages={selectedImages}
                      onToggleSelection={toggleImageSelection}
                      onCopyUrl={copyToClipboard}
                      onDeleteImage={handleDeleteImage}
                      onImageClick={setSelectedImage}
                      isDeleting={bulkDeleting}
                      containerHeight={600}
                      containerWidth={containerRef.current?.clientWidth || 1200}
                    />
                  </div>
                ) : (
                  // Обычная сетка для меньших списков
                  <div className={getGridClasses()}>
                    {filteredAndSortedImages.map((image, index) => {
                      const imageSize = getImageSize()
                      const isDeleting = deletedImages.has(image.url)

                      return (
                        <div
                          key={`${image.key || image.url}-${index}`}
                          className={`group relative transition-all duration-300 ${
                            isDeleting
                              ? 'opacity-0 scale-95 pointer-events-none'
                              : 'opacity-100 scale-100'
                          }`}
                        >
                          {/* Чекбокс для выделения */}
                          <div className="absolute top-2 left-2 z-10">
                            <Checkbox
                              checked={selectedImages.has(image.url)}
                              onCheckedChange={() => toggleImageSelection(image.url)}
                              className="bg-white/90 border-slate-300"
                              disabled={bulkDeleting || isDeleting}
                            />
                          </div>

                          <div
                            className={`aspect-square rounded-lg overflow-hidden border bg-slate-100 cursor-pointer ${
                              selectedImages.has(image.url) ? 'ring-2 ring-blue-500' : ''
                            } ${bulkDeleting || isDeleting ? 'opacity-50' : ''}`}
                            onClick={() => !isDeleting && setSelectedImage(image.url)}
                          >
                            <SafeImage
                              src={getOptimizedImageUrl(image.url, imageSize.width, imageSize.height) || PROSTHETIC_FALLBACK_IMAGE}
                              alt={`${image.productName || image.name} image`}
                              width={imageSize.width}
                              height={imageSize.height}
                              priority={index === 0}
                              sizes={`${imageSize.width}px`}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                            />
                          </div>

                          {/* Overlay with actions */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(image.url)
                                }}
                                className="bg-white/90 hover:bg-white p-2"
                                disabled={bulkDeleting || isDeleting}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(image.url, "_blank")
                                }}
                                className="bg-white/90 hover:bg-white p-2"
                                disabled={bulkDeleting || isDeleting}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteImage(image.url, image.type)
                                }}
                                className="bg-red-500/90 hover:bg-red-500 p-2"
                                disabled={bulkDeleting || isDeleting}
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Product info */}
                          {userSettings.viewMode !== 'small' && (
                            <div className="mt-2 space-y-1">
                              <Badge
                                variant="secondary"
                                className="text-xs truncate max-w-full block"
                              >
                                {image.productName ? `${image.productName} (#${image.productId})` : 'Не назначено'}
                              </Badge>
                              {image.size > 0 && (
                                <div className="text-xs text-slate-500">
                                  {(image.size / 1024).toFixed(1)} KB
                                </div>
                              )}
                              <div className="text-xs text-slate-400">
                                ☁️ S3 Storage
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Информационная панель производительности */}
            {(filteredAndSortedImages.length > 0) && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    <span>
                      {enableVirtualization && filteredAndSortedImages.length > 50
                        ? 'Виртуализация включена'
                        : 'Обычный режим'
                      }
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span>{filteredAndSortedImages.length} изображений</span>
                  </div>

                  {performance && (
                    <>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Загрузка: {performance.totalTime}ms</span>
                      </div>

                      {performance.cached && (
                        <Badge variant="secondary" className="text-xs">
                          Из кэша
                        </Badge>
                      )}
                    </>
                  )}

                  {selectedImages.size > 0 && (
                    <Badge variant="outline" className="ml-auto">
                      {selectedImages.size} выбрано
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center mt-6">
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="min-w-32"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    'Загрузить ещё'
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Bulk Delete Warning */}
        {selectedImages.size > 10 && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Выбрано {selectedImages.size} изображений. Массовое удаление может занять некоторое время.
            </AlertDescription>
          </Alert>
        )}

        {/* Fullscreen Image Viewer - оптимизирован для мобильных устройств */}
        {selectedImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
            onClick={(e) => {
              // Закрываем при клике на фон
              if (e.target === e.currentTarget) {
                setSelectedImage(null)
              }
            }}
          >
            {/* Основной контейнер */}
            <div className="relative w-full h-full flex flex-col">
              {/* Верхняя панель с кнопкой закрытия */}
              <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/50 to-transparent">
                <h2 className="text-white font-medium text-base sm:text-lg">
                  Просмотр изображения
                </h2>
                
                {/* Кнопка закрытия - увеличена для мобильных */}
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all duration-200 touch-manipulation border border-white/30 shadow-lg"
                  aria-label="Закрыть просмотр изображения"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Центральная область с изображением */}
              <div 
                className="flex-1 relative flex items-center justify-center p-4 sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative w-full h-full max-w-4xl max-h-[80vh] mx-auto">
                  <SafeImage
                    src={selectedImage || PROSTHETIC_FALLBACK_IMAGE}
                    alt="Полноразмерное изображение"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              {/* Нижняя панель с действиями */}
              <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-6 bg-gradient-to-t from-black/50 to-transparent">
                <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <Button 
                    variant="secondary" 
                    onClick={() => copyToClipboard(selectedImage)} 
                    className="flex-1 bg-white/90 hover:bg-white text-black"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Копировать URL
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => window.open(selectedImage, "_blank")} 
                    className="flex-1 bg-white/90 hover:bg-white text-black"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Открыть в новой вкладке
                  </Button>
                </div>
                
                {/* URL для копирования */}
                <div className="mt-3 text-xs sm:text-sm text-white/70 text-center truncate">
                  {selectedImage}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

MediaGallery.displayName = "MediaGallery"
