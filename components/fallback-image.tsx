"use client"

import Image from "next/image"
import { useState } from "react"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"

interface FallbackImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fill?: boolean
  objectFit?: string
  layout?: string
  sizes?: string
  priority?: boolean
  onError?: () => void
}

export function FallbackImage({
  src,
  alt,
  width,
  height,
  className,
  fill,
  objectFit = "cover",
  layout: _layout,
  sizes,
  priority,
  onError
}: FallbackImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    setHasError(true)
    setIsLoading(false)
    onError?.()
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  // Проверяем, является ли src локальным файлом
  const isLocalFile = src?.includes('/uploads/') || src?.startsWith('/uploads/')

  // Если это локальный файл или произошла ошибка - показываем fallback
  const shouldUseFallback = hasError || isLocalFile || !src

  return (
    <div className={`relative ${className || ''}`}>
      <Image
        src={shouldUseFallback ? PROSTHETIC_FALLBACK_IMAGE : src}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        className={className}
        style={{ objectFit: objectFit as any }}
        sizes={sizes}
        priority={priority}
        onError={handleError}
        onLoad={handleLoad}
      />

      {/* Индикатор загрузки */}
      {isLoading && !shouldUseFallback && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center">
          <div className="text-slate-400 text-sm">Загрузка из S3...</div>
        </div>
      )}

      {/* Предупреждение о локальном файле */}
      {isLocalFile && (
                      <div className="absolute top-2 left-2 bg-slate-500 text-white text-xs px-2 py-1 rounded">
          Локальный файл заблокирован
        </div>
      )}
    </div>
  )
}