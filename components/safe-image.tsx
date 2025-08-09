"use client"

import React, { useState, useCallback } from "react"
import Image from "next/image"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"

interface SafeImageProps {
  src: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  sizes?: string
  priority?: boolean
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void
  placeholder?: "blur" | "empty"
  blurDataURL?: string
}

/**
 * SafeImage - безопасная обертка для Next.js Image
 * Автоматически переключается с оптимизированного режима на unoptimized при ошибках
 */
export function SafeImage({
  src,
  alt,
  fill,
  width,
  height,
  className = "",
  sizes,
  priority = false,
  onError,
  onLoad,
  placeholder,
  blurDataURL
}: SafeImageProps) {
  const isS3Image = /s3\.twcstorage\.ru/i.test(src)
  const isLocalFile = src?.includes('/uploads/') || src?.startsWith('/uploads/')
  const [useUnoptimized, setUseUnoptimized] = useState(isS3Image)
  const [currentSrc, setCurrentSrc] = useState(isLocalFile ? PROSTHETIC_FALLBACK_IMAGE : src)
  const [hasError, setHasError] = useState(false)
  const [errorCount, setErrorCount] = useState(0)

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const newErrorCount = errorCount + 1
    setErrorCount(newErrorCount)

    console.warn(`📸 SafeImage: Error loading image (${newErrorCount}/3): ${currentSrc}`)

    // Защита от бесконечного зацикливания
    if (newErrorCount > 3) {
      console.error(`📸 SafeImage: Too many errors (${newErrorCount}), stopping attempts for: ${currentSrc}`)
      setHasError(true)
      onError?.(e)
      return
    }

    // Если уже показываем fallback изображение и оно тоже не загрузилось
    if (currentSrc === PROSTHETIC_FALLBACK_IMAGE) {
      console.error(`📸 SafeImage: Even fallback image failed to load: ${PROSTHETIC_FALLBACK_IMAGE}`)
      setHasError(true)
      onError?.(e)
      return
    }

    // Если еще не пробовали unoptimized режим для исходного изображения
    if (!useUnoptimized && currentSrc !== PROSTHETIC_FALLBACK_IMAGE) {

      setUseUnoptimized(true)
      return
    }

    // Если ошибка в unoptimized режиме - переходим к fallback

      setCurrentSrc(PROSTHETIC_FALLBACK_IMAGE)
      setUseUnoptimized(false) // Fallback изображение можно оптимизировать
      setHasError(false)
    setErrorCount(0) // Сбрасываем счетчик для fallback изображения

    // Вызываем внешний обработчик ошибки
    onError?.(e)
  }, [useUnoptimized, currentSrc, onError, errorCount])

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {

    setHasError(false)
    setErrorCount(0) // Сбрасываем счетчик при успешной загрузке
    onLoad?.(e)
  }, [currentSrc, useUnoptimized, onLoad])

  // Обновляем src при изменении пропа
  React.useEffect(() => {
    if (src !== currentSrc && src !== PROSTHETIC_FALLBACK_IMAGE) {
      // Если новый src указывает на локальный файл, сразу переключаемся на fallback
      const isLocal = src?.includes('/uploads/') || src?.startsWith('/uploads/')
      if (isLocal) {
        setCurrentSrc(PROSTHETIC_FALLBACK_IMAGE)
        setUseUnoptimized(false)
        setHasError(false)
        setErrorCount(0)
        return
      }

      setCurrentSrc(src)
      // Проверяем, нужен ли unoptimized режим для нового изображения
      const needsUnoptimized = /s3\.twcstorage\.ru/i.test(src)
      setUseUnoptimized(needsUnoptimized)
      setHasError(false)
      setErrorCount(0) // Сбрасываем счетчик при смене источника
    }
  }, [src, currentSrc])

  // Если критическая ошибка - возвращаем пустой div с placeholder
  if (hasError) {
    return (
      <div
        className={`${className} bg-slate-100 flex items-center justify-center text-slate-400 text-xs`}
        style={fill ? {} : { width, height }}
      >
        Изображение недоступно
      </div>
    )
  }

  const imageProps = {
    src: currentSrc,
    alt,
    className,
    sizes,
    priority,
    onError: handleError,
    onLoad: handleLoad,
    placeholder,
    blurDataURL,
    ...(useUnoptimized && { unoptimized: true })
  }

  if (fill) {
    return (
      <Image
        {...imageProps}
        fill
      />
    )
  }

  return (
    <Image
      {...imageProps}
      width={width}
      height={height}
    />
  )
}