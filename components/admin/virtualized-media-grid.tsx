"use client"

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { FixedSizeGrid as Grid } from 'react-window'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Copy,
  ExternalLink,
  Trash2,
  Loader2
} from "lucide-react"
import { SafeImage } from "@/components/safe-image"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"

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

interface VirtualizedMediaGridProps {
  mediaFiles: MediaFile[]
  viewMode: 'small' | 'medium' | 'large'
  selectedImages: Set<string>
  onToggleSelection: (url: string) => void
  onCopyUrl: (url: string) => void
  onDeleteImage: (url: string, type?: string) => void
  onImageClick: (url: string) => void
  isDeleting?: boolean
  containerHeight?: number
  containerWidth?: number
}

interface GridItemData {
  mediaFiles: MediaFile[]
  columnsCount: number
  itemSize: number
  selectedImages: Set<string>
  onToggleSelection: (url: string) => void
  onCopyUrl: (url: string) => void
  onDeleteImage: (url: string, type?: string) => void
  onImageClick: (url: string) => void
  isDeleting: boolean
}

// Получение размеров для режима отображения
const getGridConfig = (viewMode: 'small' | 'medium' | 'large', containerWidth: number) => {
  let itemSize: number
  let columnsCount: number

  switch (viewMode) {
    case 'small':
      itemSize = 140 // 120px + padding
      columnsCount = Math.floor(containerWidth / itemSize)
      break
    case 'medium':
      itemSize = 220 // 200px + padding
      columnsCount = Math.floor(containerWidth / itemSize)
      break
    case 'large':
      itemSize = 320 // 300px + padding
      columnsCount = Math.floor(containerWidth / itemSize)
      break
    default:
      itemSize = 220
      columnsCount = Math.floor(containerWidth / itemSize)
  }

  return {
    itemSize: Math.max(itemSize, 140), // Минимальный размер
    columnsCount: Math.max(columnsCount, 1), // Минимум 1 колонка
    imageSize: itemSize - 20 // Учитываем padding
  }
}

// Оптимизированное получение URL изображения
const getOptimizedImageUrl = (url: string, size: number) => {
  if (url.includes('s3.twcstorage.ru')) {
    return `${url}?width=${size}&height=${size}&fit=cover&quality=80`
  }
  return url
}

// Компонент отдельного элемента в сетке
const GridItem: React.FC<{
  columnIndex: number
  rowIndex: number
  style: React.CSSProperties
  data: GridItemData
}> = React.memo(({ columnIndex, rowIndex, style, data }) => {
  const {
    mediaFiles,
    columnsCount,
    itemSize,
    selectedImages,
    onToggleSelection,
    onCopyUrl,
    onDeleteImage,
    onImageClick,
    isDeleting
  } = data

  const index = rowIndex * columnsCount + columnIndex

  if (index >= mediaFiles.length) {
    return <div style={style} />
  }

  const image = mediaFiles[index]
  const isSelected = selectedImages.has(image.url)
  const imageSize = itemSize - 40 // Учитываем margin и padding

  return (
    <div style={style} className="p-2">
      <div className="group relative h-full">
        {/* Чекбокс для выделения */}
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(image.url)}
            className="bg-white/90 border-slate-300 shadow-sm"
            disabled={isDeleting}
          />
        </div>

        <div
          className={`aspect-square rounded-lg overflow-hidden border bg-slate-100 cursor-pointer ${
            isSelected ? 'ring-2 ring-blue-500' : ''
          } ${isDeleting ? 'opacity-50' : ''}`}
          onClick={() => onImageClick(image.url)}
        >
          <SafeImage
            src={getOptimizedImageUrl(image.url, imageSize) || PROSTHETIC_FALLBACK_IMAGE}
            alt={`${image.productName || image.name} image`}
            width={imageSize}
            height={imageSize}
            sizes={`${imageSize}px`}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
          />
        </div>

        {/* Overlay с действиями */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                onCopyUrl(image.url)
              }}
              className="bg-white/90 hover:bg-white p-2"
              disabled={isDeleting}
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
              disabled={isDeleting}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteImage(image.url, image.type)
              }}
              className="bg-red-500/90 hover:bg-red-500 p-2"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>

        {/* Информация о файле (только для medium и large) */}
        {itemSize > 180 && (
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
    </div>
  )
})

GridItem.displayName = 'GridItem'

export const VirtualizedMediaGrid: React.FC<VirtualizedMediaGridProps> = ({
  mediaFiles,
  viewMode,
  selectedImages,
  onToggleSelection,
  onCopyUrl,
  onDeleteImage,
  onImageClick,
  isDeleting = false,
  containerHeight = 600,
  containerWidth = 1200
}) => {
  const gridRef = useRef<Grid>(null)
  const [actualContainerSize, setActualContainerSize] = useState({
    width: containerWidth,
    height: containerHeight
  })

  // Обновляем размеры контейнера при изменении
  useEffect(() => {
    const updateSize = () => {
      // Используем родительский элемент для определения размеров
      const parentElement = document.querySelector('[data-virtualized-grid-container]')
      if (parentElement) {
        setActualContainerSize({
          width: parentElement.clientWidth || containerWidth,
          height: parentElement.clientHeight || containerHeight
        })
      } else {
        setActualContainerSize({
          width: containerWidth,
          height: containerHeight
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [containerWidth, containerHeight])

  // Мемоизированная конфигурация сетки
  const gridConfig = useMemo(() =>
    getGridConfig(viewMode, actualContainerSize.width),
    [viewMode, actualContainerSize.width]
  )

  // Вычисляем количество строк
  const rowCount = Math.ceil(mediaFiles.length / gridConfig.columnsCount)

  // Мемоизированные данные для передачи в Grid
  const itemData: GridItemData = useMemo(() => ({
    mediaFiles,
    columnsCount: gridConfig.columnsCount,
    itemSize: gridConfig.itemSize,
    selectedImages,
    onToggleSelection,
    onCopyUrl,
    onDeleteImage,
    onImageClick,
    isDeleting
  }), [
    mediaFiles,
    gridConfig.columnsCount,
    gridConfig.itemSize,
    selectedImages,
    onToggleSelection,
    onCopyUrl,
    onDeleteImage,
    onImageClick,
    isDeleting
  ])

  // Обработчик прокрутки к началу при изменении данных
  const resetGridPosition = useCallback(() => {
    if (gridRef.current) {
      gridRef.current.scrollToItem({
        align: 'start',
        columnIndex: 0,
        rowIndex: 0
      })
    }
  }, [])

  useEffect(() => {
    resetGridPosition()
  }, [viewMode, resetGridPosition])

  if (mediaFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="text-center">
          <div className="text-lg font-medium">Нет изображений для отображения</div>
          <div className="text-sm mt-1">Загрузите изображения или измените фильтры</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <Grid
        ref={gridRef}
        columnCount={gridConfig.columnsCount}
        columnWidth={gridConfig.itemSize}
        height={actualContainerSize.height}
        rowCount={rowCount}
        rowHeight={gridConfig.itemSize + (gridConfig.itemSize > 180 ? 60 : 20)} // Дополнительное место для информации
        width={actualContainerSize.width}
        itemData={itemData}
        className="scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
        overscanRowCount={2} // Предзагрузка 2 строк
        overscanColumnCount={1} // Предзагрузка 1 колонки
      >
        {GridItem}
      </Grid>
    </div>
  )
}