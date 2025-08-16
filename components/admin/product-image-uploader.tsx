"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, X, Loader2, Star, Maximize2, ImageIcon } from "lucide-react"
import { MediaManager, type UploadOptions } from "@/lib/s3-client"
import { DuplicateFileDialog } from "@/components/admin/duplicate-file-dialog"
import { DuplicateFileInfo, DuplicateCheckResult } from "@/lib/file-hash"
import { SafeImage } from "@/components/safe-image"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"

interface ProductImageUploaderProps {
  productImages: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
  isUploading?: boolean
  productId?: string | number | null // Добавляем prop для product ID
  isVariant?: boolean // Добавляем prop для указания работы с вариантом
}

export function ProductImageUploader({
  productImages = [],
  onImagesChange,
  maxImages = 20,
  isUploading = false,
  productId = null,
  isVariant = false
}: ProductImageUploaderProps) {
  // Убеждаемся, что productImages всегда массив
  const safeProductImages = Array.isArray(productImages) ? productImages : 
    (productImages === null || productImages === undefined) ? [] : 
    (typeof productImages === 'string' ? [productImages] : [])
  
  // Безопасное вычисление доступных слотов
  const availableSlots = Math.max(0, maxImages - safeProductImages.length)
  
  // Расширенная отладочная информация
  console.log('ProductImageUploader Debug Info:', {
    productId,
    isVariant,
    productImages: productImages,
    safeProductImages: safeProductImages,
    productImagesLength: safeProductImages.length,
    productImagesType: typeof productImages,
    isArray: Array.isArray(productImages),
    maxImages,
    availableSlots: availableSlots,
    showUploadArea: availableSlots > 0,
    location: typeof window !== 'undefined' ? window.location.pathname : 'SSR'
  })
  
  const [files, setFiles] = useState<File[]>([])
  const [_uploadProgress, __setUploadProgress] = useState<{ [key: string]: number }>({})
  const [uploading, setUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [currentDuplicate, setCurrentDuplicate] = useState<{
    file: File;
    existingFile: DuplicateFileInfo;
    resolve: (action: 'use-existing' | 'upload-new' | 'cancel') => void;
  } | null>(null)
  // Image preview state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)

  // Fullscreen modal state
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles) return

    const availableSlots = maxImages - safeProductImages.length
    if (availableSlots <= 0) return

    const newFiles = Array.from(selectedFiles)
      .slice(0, availableSlots)
      .filter(file => file.type.startsWith('image/'))

    // Автоматически загружаем выбранные файлы
    if (newFiles.length > 0) {
      await uploadFilesDirectly(newFiles)
    }
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    const droppedFiles = event.dataTransfer.files
    if (!droppedFiles) return

    const availableSlots = maxImages - safeProductImages.length
    if (availableSlots <= 0) return

    const newFiles = Array.from(droppedFiles)
      .slice(0, availableSlots)
      .filter(file => file.type.startsWith('image/'))

    // Автоматически загружаем перетащенные файлы
    if (newFiles.length > 0) {
      await uploadFilesDirectly(newFiles)
    }
  }

  const handleDuplicateChoice = (_file: File, _existingFile: DuplicateFileInfo): Promise<'use-existing' | 'upload-new' | 'cancel'> => {
    return new Promise((_resolve) => {
      setCurrentDuplicate({ file: _file, existingFile: _existingFile, resolve: _resolve })
      setDuplicateDialogOpen(true)
    })
  }

  const closeDuplicateDialog = () => {
    setDuplicateDialogOpen(false)
    setCurrentDuplicate(null)
  }

  const handleUseExisting = () => {
    if (currentDuplicate) {
      currentDuplicate.resolve('use-existing')
      closeDuplicateDialog()
    }
  }

  const handleUploadNew = () => {
    if (currentDuplicate) {
      currentDuplicate.resolve('upload-new')
      closeDuplicateDialog()
    }
  }

  // Синхронизация изображений с базой данных
  const _syncImagesToDatabase = async (images: string[]) => {
    // Используем переданный productId или пытаемся получить из URL
    let resolvedProductId: string | null = null
    let useVariantApi = isVariant // Используем переданный prop

    // Метод 1: используем переданный prop
    if (productId) {
      // Проверяем, является ли это новым вариантом
      if (typeof productId === 'string' && productId.startsWith('new-variant-')) {
        // Для новых вариантов пропускаем синхронизацию
        console.log('Skipping sync for new variant')
        return
      }
      resolvedProductId = productId.toString()
    } else {
      // Метод 2: пытаемся получить из URL как fallback
      const url = window.location.pathname

      // Проверяем страницу вариантов
      const variantsMatch = url.match(/\/admin\/products\/\d+\/variants/)
      if (variantsMatch) {
        useVariantApi = true
        // В этом случае productId уже должен быть передан как prop
        return
      }

      const editMatch = url.match(/\/admin\/products\/(\d+)\/edit/)
      if (editMatch) {
        resolvedProductId = editMatch[1]
      } else {
        const viewMatch = url.match(/\/admin\/products\/(\d+)/)
        if (viewMatch) {
          resolvedProductId = viewMatch[1]
        }
      }
    }

    if (!resolvedProductId) {
      return // Тихо пропускаем если нет контекста товара
    }

    try {
      // Если это вариант товара, используем другой API endpoint
      if (useVariantApi) {
        const response = await fetch('/api/variant-images', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variantId: parseInt(resolvedProductId),
            images: images
          })
        })

        if (!response.ok) {
          console.error('❌ Failed to sync variant images with database:', response.status)
        }
      } else {
        // Для обычных товаров используем стандартный API
        const response = await fetch('/api/product-images', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: parseInt(resolvedProductId),
            images: images
          })
        })

        if (!response.ok) {
          console.error('❌ Failed to sync images with database:', response.status)
        }
      }
    } catch (error) {
      console.error('❌ Error syncing images with database:', error)
      throw error
    }
  }

  const uploadFilesDirectly = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return

    setUploading(true)
    const mediaManager = MediaManager.getInstance()
    const successfulUrls: string[] = []

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i]
      try {
        const uploadOptions: UploadOptions = {
          folder: 'products',
          checkDuplicates: true,
          onProgress: (progress) => {
            __setUploadProgress(prev => ({
              ...prev,
              [file.name]: progress
            }))
          },
          onDuplicateFound: async (duplicateInfo: DuplicateCheckResult) => {
            if (duplicateInfo.isDuplicate && duplicateInfo.existingFile) {
              return await handleDuplicateChoice(file, duplicateInfo.existingFile)
            }
            return 'upload-new'
          }
        }

        const result = await mediaManager.uploadFile(file, uploadOptions)

        if (result.success && result.url) {
          successfulUrls.push(result.url)

          // Дубликат использован успешно
        } else if (result.requiresUserChoice) {
          // Требуется выбор пользователя
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
      }
    }

    // Добавляем успешно загруженные изображения к существующим
    const updatedImages = [...safeProductImages, ...successfulUrls]
    onImagesChange(updatedImages)

    // Очищаем состояние
    setFiles([])
    __setUploadProgress({})
    setUploading(false)
  }

  const handleReplaceClick = (index: number) => {
    setReplacingIndex(index)
    replaceInputRef.current?.click()
  }

  const handleReplaceImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles || selectedFiles.length === 0 || replacingIndex === null) return

    const file = selectedFiles[0]
    if (!file.type.startsWith('image/')) return

    setUploading(true)
    const mediaManager = MediaManager.getInstance()

    try {
      const uploadOptions: UploadOptions = {
        folder: 'products',
        checkDuplicates: true,
        onProgress: (progress) => {
          __setUploadProgress(prev => ({
            ...prev,
            [file.name]: progress
          }))
        },
        onDuplicateFound: async (duplicateInfo: DuplicateCheckResult) => {
          if (duplicateInfo.isDuplicate && duplicateInfo.existingFile) {
            return await handleDuplicateChoice(file, duplicateInfo.existingFile)
          }
          return 'upload-new'
        }
      }

      const result = await mediaManager.uploadFile(file, uploadOptions)

      if (result.success && result.url) {
        // Заменяем изображение в массиве
        const updatedImages = [...safeProductImages]
        const oldImageUrl = updatedImages[replacingIndex]
        updatedImages[replacingIndex] = result.url
        onImagesChange(updatedImages)

        // Удаляем старое изображение из S3
        if (oldImageUrl) {
          try {
            await fetch('/api/media/delete', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url: oldImageUrl })
            })
          } catch (error) {
            console.error('Error deleting old image:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error replacing image:', error)
    } finally {
      __setUploadProgress({})
      setUploading(false)
      setReplacingIndex(null)
      // Очищаем input
      if (replaceInputRef.current) {
        replaceInputRef.current.value = ''
      }
    }
  }

  const removeImage = async (index: number) => {
    const imageUrl = safeProductImages[index]
    if (!imageUrl) return

    // Оптимистично удаляем из UI до ответа сервера
    const updatedImages = safeProductImages.filter((_, i) => i !== index)
    onImagesChange(updatedImages)

    try {
      // Удаляем изображение из S3 и базы данных
      const response = await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: imageUrl })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Failed to delete image:', error)
        // При неудаче возвращаем изображение обратно
        onImagesChange(safeProductImages)
        return
      }

      // ВАЖНО: Синхронизируем состояние с базой данных
      // Removed for batch saving: Images will be saved when main form is submitted
      // if (productId || window.location.pathname.includes('/admin/products/') && window.location.pathname.includes('/edit')) {
      //   await syncImagesToDatabase(updatedImages)
      // }

    } catch (error) {
      console.error('❌ Error deleting image:', error)
      // Возвращаем изображение обратно при ошибке
      onImagesChange(safeProductImages)
    }
  }

  const setMainImage = async (index: number) => {
    if (index === 0) return // Уже главное изображение

    const updatedImages = [...safeProductImages]
    const [movedImage] = updatedImages.splice(index, 1)
    updatedImages.unshift(movedImage)
    onImagesChange(updatedImages)

    // Синхронизируем с базой данных (только если есть productId)
    // Removed for batch saving: Images will be saved when main form is submitted
    // if (productId || window.location.pathname.includes('/admin/products/') && window.location.pathname.includes('/edit')) {
    //   try {
    //     await syncImagesToDatabase(updatedImages)
    //   } catch (error) {
    //     console.error('❌ Error syncing images after setting main image:', error)
    //   }
    // } else {
    //   console.log('ℹ️ Skipping sync after setting main image: no product context')
    // }
  }

  const moveImage = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    const updatedImages = [...safeProductImages]
    const [movedImage] = updatedImages.splice(fromIndex, 1)
    updatedImages.splice(toIndex, 0, movedImage)
    onImagesChange(updatedImages)

    // Синхронизируем с базой данных после изменения порядка (только если есть productId)
    // Removed for batch saving: Images will be saved when main form is submitted
    // if (productId || window.location.pathname.includes('/admin/products/') && window.location.pathname.includes('/edit')) {
    //   try {
    //     await syncImagesToDatabase(updatedImages)
    //   } catch (error) {
    //     console.error('❌ Error syncing images after moving:', error)
    //   }
    // } else {
    //   console.log('ℹ️ Skipping sync after moving image: no product context')
    // }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      moveImage(draggedIndex, index)
      setDraggedIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const toggleSelectImage = (index: number) => {
    setSelectedIndices(prev => {
      const newSelection = prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      return newSelection
    })
  }

  const removeSelectedImages = async () => {
    if (selectedIndices.length === 0) {
      return
    }

    try {
      // Удаляем выбранные изображения по одному
      for (const index of selectedIndices.sort((a, b) => b - a)) { // Удаляем с конца
        const imageUrl = safeProductImages[index]
        if (imageUrl) {
          try {
            const response = await fetch('/api/media/delete', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url: imageUrl })
            })

            if (response.ok) {
            } else {
              console.error('❌ Failed to delete image:', imageUrl)
            }
          } catch (error) {
            console.error('❌ Error deleting image:', imageUrl, error)
          }
        }
      }

      // Обновляем локальное состояние после всех удалений
      const updated = safeProductImages.filter((_, idx) => !selectedIndices.includes(idx))
      onImagesChange(updated)
      setSelectedIndices([])

      // Синхронизируем с базой данных (только если есть productId)
      // Removed for batch saving: Images will be saved when main form is submitted
      // if (productId || window.location.pathname.includes('/admin/products/') && window.location.pathname.includes('/edit')) {
      //   try {
      //     await syncImagesToDatabase(updated)
      //   } catch (syncError) {
      //     console.error('❌ Error syncing images after batch removal:', syncError)
      //   }
      // } else {
      //   console.log('ℹ️ Skipping sync after batch removal: no product context')
      // }
    } catch (error) {
      console.error('❌ Error removing selected images:', error)
      // В случае ошибки все равно удаляем из локального состояния
      const updated = safeProductImages.filter((_, idx) => !selectedIndices.includes(idx))
      onImagesChange(updated)
      setSelectedIndices([])

      // Пытаемся синхронизировать даже после ошибки (только если есть productId)
      // Removed for batch saving: Images will be saved when main form is submitted
      // if (productId || window.location.pathname.includes('/admin/products/') && window.location.pathname.includes('/edit')) {
      //   try {
      //     await syncImagesToDatabase(updated)
      //   } catch (syncError) {
      //     console.error('❌ Error syncing images after error:', syncError)
      //   }
      // } else {
      //   console.log('ℹ️ Skipping sync after error: no product context')
      // }
    }
  }

  // Image selection functions
  const selectImage = (index: number) => {
    setSelectedImageIndex(index)
  }

  // Fullscreen modal functions
  const openFullscreen = (index?: number) => {
    setFullscreenImageIndex(index !== undefined ? index : selectedImageIndex)
    setFullscreenOpen(true)
  }

  const closeFullscreen = useCallback(() => {
    setFullscreenOpen(false)
  }, [])

  const navigateFullscreen = useCallback((direction: 'prev' | 'next') => {
    if (safeProductImages.length === 0) return

    let newIndex = fullscreenImageIndex
    if (direction === 'prev') {
      newIndex = fullscreenImageIndex > 0 ? fullscreenImageIndex - 1 : safeProductImages.length - 1
    } else {
      newIndex = fullscreenImageIndex < safeProductImages.length - 1 ? fullscreenImageIndex + 1 : 0
    }
    setFullscreenImageIndex(newIndex)
  }, [fullscreenImageIndex, safeProductImages.length])

  const _navigateImage = (direction: 'prev' | 'next') => {
    if (safeProductImages.length === 0) return

    let newIndex = selectedImageIndex
    if (direction === 'prev') {
      newIndex = selectedImageIndex > 0 ? selectedImageIndex - 1 : safeProductImages.length - 1
    } else {
      newIndex = selectedImageIndex < safeProductImages.length - 1 ? selectedImageIndex + 1 : 0
    }
    setSelectedImageIndex(newIndex)
  }

  // Keyboard navigation for image selection
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keys when not in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (safeProductImages.length === 0) return

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          setSelectedImageIndex(prev => prev > 0 ? prev - 1 : safeProductImages.length - 1)
          break
        case 'ArrowRight':
          event.preventDefault()
          setSelectedImageIndex(prev => prev < safeProductImages.length - 1 ? prev + 1 : 0)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [safeProductImages.length])

  // Auto-select first image when images change
  useEffect(() => {
    if (safeProductImages.length > 0 && (selectedImageIndex >= safeProductImages.length || selectedImageIndex < 0)) {
      setSelectedImageIndex(0)
    }
  }, [safeProductImages.length, selectedImageIndex])

  // Fullscreen modal keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!fullscreenOpen) return

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          navigateFullscreen('prev')
          break
        case 'ArrowRight':
          event.preventDefault()
          navigateFullscreen('next')
          break
        case 'Escape':
          event.preventDefault()
          closeFullscreen()
          break
      }
    }

    if (fullscreenOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [fullscreenOpen, navigateFullscreen, closeFullscreen])

  const _totalImages = safeProductImages.length + files.length

  return (
    <>
      <div className="space-y-6">
        {/* Горизонтальная компоновка для изображений */}
        {safeProductImages.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Предпросмотр изображения - 2 колонки */}
            <div className="lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {selectedImageIndex === 0 && (
                    <Badge className="bg-blue-500 text-white text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      Главное
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {selectedImageIndex + 1} из {safeProductImages.length}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openFullscreen()}
                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                  >
                    <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Увеличить</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMainImage(selectedImageIndex)}
                    disabled={selectedImageIndex === 0}
                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                  >
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Сделать главным</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReplaceClick(selectedImageIndex)}
                    disabled={uploading}
                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Заменить</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeImage(selectedImageIndex)}
                    disabled={safeProductImages.length === 1}
                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                    title={safeProductImages.length === 1 ? "Нельзя удалить последнее изображение" : "Удалить выбранное изображение"}
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Удалить</span>
                  </Button>
                </div>
              </div>

              <div className="relative aspect-square bg-gray-50 rounded-lg cursor-pointer touch-manipulation" onClick={() => openFullscreen()}>
                <SafeImage
                  src={safeProductImages[selectedImageIndex] || PROSTHETIC_FALLBACK_IMAGE}
                  alt={`Изображение товара ${selectedImageIndex + 1}`}
                  fill
                  className="object-contain p-2 sm:p-4 rounded-lg"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={selectedImageIndex === 0}
                />
              </div>
            </div>

            {/* Список всех изображений - 1 колонка */}
            <div className="w-full">
              <h3 className="text-sm font-medium mb-3">Все изображения</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto overflow-x-hidden pr-2">
              {safeProductImages.map((url, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg cursor-pointer transition-all w-full min-w-0 touch-manipulation ${
                    index === selectedImageIndex
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  } ${selectedIndices.includes(index) ? 'ring-2 ring-red-200' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      openFullscreen(index)
                    } else {
                      selectImage(index)
                    }
                  }}
                >
                  {/* Чекбокс выбора */}
                  <input
                    type="checkbox"
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded text-blue-600 bg-white border-gray-300 focus:ring-blue-500 flex-shrink-0"
                    checked={selectedIndices.includes(index)}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleSelectImage(index)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* Миниатюра */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 relative flex-shrink-0 rounded overflow-hidden border">
                    <SafeImage
                      src={url || PROSTHETIC_FALLBACK_IMAGE}
                      alt={`Миниатюра ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 40px, 48px"
                    />
                  </div>

                  {/* Информация об изображении */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                        Изображение {index + 1}
                      </span>
                      {index === 0 && (
                        <Badge className="bg-blue-500 text-white text-xs px-1 py-0">
                          ⭐
                        </Badge>
                      )}
                      {index === selectedImageIndex && (
                        <Badge variant="outline" className="text-xs px-1 py-0 hidden sm:inline-flex">
                          Просматривается
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate max-w-full">
                      {url.split('/').pop() || 'Без названия'}
                    </div>
                  </div>

                  {/* Номер порядка */}
                  <div className="text-xs sm:text-sm font-medium text-slate-500 flex-shrink-0">
                    #{index + 1}
                  </div>

                  {/* Кнопка быстрого удаления */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeImage(index)
                    }}
                    disabled={safeProductImages.length === 1}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0 hover:bg-red-50 hover:text-red-600"
                    title={safeProductImages.length === 1 ? "Нельзя удалить последнее изображение" : "Удалить изображение"}
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Кнопки управления */}
            {selectedIndices.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={removeSelectedImages}
                  className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Удалить выбранные</span>
                  <span className="sm:hidden">Удалить</span> ({selectedIndices.length})
                </Button>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Область загрузки */}
        {availableSlots > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              {/* Мобильная версия - только кнопка */}
              <div className="block sm:hidden">
              <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-slate-50">
                <Upload className="w-8 h-8 text-slate-400" />
                <div className="text-center">
                  <h3 className="text-sm font-medium mb-1">Добавить изображения</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Доступно слотов: {availableSlots} из {maxImages}
                  </p>
                </div>

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="product-image-upload-mobile"
                  ref={fileInputRef}
                />
                <label htmlFor="product-image-upload-mobile" className="w-full">
                  <Button
                    variant="outline"
                    disabled={uploading || isUploading || availableSlots === 0}
                    className="h-12 w-full text-sm font-medium"
                    asChild
                  >
                    <span>
                      {uploading || isUploading ? "Загрузка..." : "Выбрать изображения"}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-slate-500 text-center">
                  JPEG, PNG, WebP, GIF до 5 МБ
                </p>
              </div>
            </div>

            {/* Десктопная версия - с drag and drop */}
            <div className="hidden sm:block">
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  uploading || isUploading
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                <h3 className="text-base font-medium mb-2">Добавить изображения</h3>
                <p className="text-sm text-slate-600 mb-3">
                  Перетащите файлы сюда или нажмите для выбора. Загрузка начнется автоматически.
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Доступно слотов: {availableSlots} из {maxImages}
                </p>

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="product-image-upload-desktop"
                />
                
                {/* Hidden input for replacing images */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReplaceImage}
                  className="hidden"
                  ref={replaceInputRef}
                  id="product-image-replace"
                />
                <label htmlFor="product-image-upload-desktop">
                  <Button
                    variant="outline"
                    disabled={uploading || isUploading || availableSlots === 0}
                    className="h-9 px-4 text-sm"
                    asChild
                  >
                    <span>
                      {uploading || isUploading ? "Загрузка..." : "Выбрать файлы"}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-slate-500 mt-2">
                  Поддерживаются: JPEG, PNG, WebP, GIF до 5 МБ
                </p>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Лимит достигнут */}
        {availableSlots === 0 && safeProductImages.length >= maxImages && (
          <Alert>
            <ImageIcon className="h-4 w-4" />
            <AlertDescription>
              Достигнут максимум изображений ({maxImages}). Удалите некоторые изображения для добавления новых.
            </AlertDescription>
          </Alert>
        )}

        {/* Индикатор загрузки */}
        {uploading && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm font-medium text-blue-700">Загрузка изображений...</span>
            </div>
          </div>
        )}

        {/* Подсказки */}
        {safeProductImages.length === 0 && !uploading && (
          <div className="text-center text-slate-500 py-4">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Пока нет изображений товара</p>
            <p className="text-xs">Добавьте до {maxImages} изображений для полного представления товара</p>
          </div>
        )}
      </div>

      {/* Диалог выбора действия при дубликате */}
      {currentDuplicate && (
        <DuplicateFileDialog
          isOpen={duplicateDialogOpen}
          onClose={closeDuplicateDialog}
          onUseExisting={handleUseExisting}
          onUploadNew={handleUploadNew}
          existingFile={currentDuplicate.existingFile}
          newFileName={currentDuplicate.file.name}
          newFileSize={currentDuplicate.file.size}
        />
      )}

      {/* Fullscreen modal для увеличенного просмотра - оптимизирован для мобильных */}
      {fullscreenOpen && (
        <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
        onClick={(e) => {
          // Закрываем при клике на фон
          if (e.target === e.currentTarget) {
            closeFullscreen()
          }
        }}
      >
        {/* Основной контейнер */}
        <div className="relative w-full h-full flex flex-col">
          {/* Верхняя панель с информацией и кнопкой закрытия */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/50 to-transparent">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-medium text-base sm:text-lg">
                Изображение {fullscreenImageIndex + 1} из {safeProductImages.length}
              </h2>
            </div>
            
            {/* Кнопка закрытия - увеличена для мобильных */}
            <button
              onClick={closeFullscreen}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all duration-200 touch-manipulation border border-white/30 shadow-lg"
              aria-label="Закрыть просмотр"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Центральная область с изображением */}
          <div 
            className="flex-1 relative flex items-center justify-center p-4 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {safeProductImages[fullscreenImageIndex] && (
              <div className="relative w-full h-full max-w-4xl max-h-[80vh] mx-auto">
                <SafeImage
                  src={safeProductImages[fullscreenImageIndex]}
                  alt={`Изображение товара ${fullscreenImageIndex + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                  priority
                />
              </div>
            )}

            {/* Навигационные кнопки */}
            {safeProductImages.length > 1 && (
              <>
                <button
                  onClick={() => navigateFullscreen('prev')}
                  className="absolute left-4 sm:left-8 top-1/2 transform -translate-y-1/2 p-3 sm:p-4 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all duration-200 touch-manipulation"
                  aria-label="Предыдущее изображение"
                >
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => navigateFullscreen('next')}
                  className="absolute right-4 sm:right-8 top-1/2 transform -translate-y-1/2 p-3 sm:p-4 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all duration-200 touch-manipulation"
                  aria-label="Следующее изображение"
                >
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Нижняя панель с подсказкой */}
          <div className="absolute bottom-0 left-0 right-0 z-10 p-3 sm:p-4 bg-gradient-to-t from-black/50 to-transparent">
            <div className="text-center text-xs sm:text-sm text-white/60">
              {safeProductImages.length > 1 && "Используйте стрелки ← → для навигации • "}
              ESC для выхода
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  )
}