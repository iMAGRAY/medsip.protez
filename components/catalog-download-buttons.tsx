"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { FileDown, Share2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

interface CatalogFile {
  id: number
  title: string
  description?: string
  file_url: string
  file_name: string
  file_size?: number
  year: number
  download_count: number
}

export function CatalogDownloadButtons() {
  const [catalogs, setCatalogs] = useState<CatalogFile[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Определяем мобильное устройство
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  }, [])

  // Загрузка активных каталогов
    const loadCatalogs = useCallback(async () => {
              try {
                const response = await fetch('/api/catalog-files?active=true')
                const data = await response.json()

                if (data.success) {
                  setCatalogs(data.data)
                }
              } catch (error) {
                console.error('Error loading catalogs:', error)
              } finally {
                setLoading(false)
              }
            }, [])

  useEffect(() => {
    loadCatalogs()
  }, [loadCatalogs])

  // Скачивание каталога
  const handleDownload = async (catalog: CatalogFile) => {
    try {
      setDownloading(catalog.id)

      // Увеличиваем счетчик и получаем данные для скачивания
      const response = await fetch(`/api/catalog-files/${catalog.id}/download`)
      const data = await response.json()

      if (data.success) {
        // Проверяем, мобильное ли устройство
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        
        if (isMobile) {
          // Для мобильных устройств используем прямую ссылку
          window.location.href = `/api/catalog-files/${catalog.id}/download?direct=true`
          toast.success(`Открываем каталог "${catalog.title}"...`)
        } else {
          // Для десктопа используем прямую загрузку
          const link = document.createElement('a')
          link.href = data.data.file_url
          link.download = data.data.file_name
          link.target = '_blank'
          // Добавляем rel для безопасности
          link.rel = 'noopener noreferrer'
          document.body.appendChild(link)
          link.click()
          // Увеличиваем задержку перед удалением ссылки
          setTimeout(() => {
            document.body.removeChild(link)
          }, 100)

          toast.success(`Каталог "${catalog.title}" скачан`)
        }
      } else {
        toast.error(data.error || 'Ошибка скачивания')
      }
    } catch (error) {
      console.error('Error downloading catalog:', error)
      toast.error('Ошибка скачивания каталога')
    } finally {
      setDownloading(null)
    }
  }

  // Поделиться каталогом
  const handleShare = async (catalog: CatalogFile) => {
    const shareText = `📄 ${catalog.title}
Скачать каталог: ${window.location.origin}/api/catalog-files/${catalog.id}/download`

    try {
      // Проверяем поддержку Web Share API
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await navigator.share({
          title: catalog.title,
          text: shareText,
          url: `${window.location.origin}/api/catalog-files/${catalog.id}/download`
        })
        toast.success('Каталог отправлен!')
      } else {
        // Fallback - отправляем в WhatsApp
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`
        window.open(whatsappUrl, '_blank')
        toast.success('Переход в WhatsApp...')
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sharing catalog:', error)
        // Fallback - копируем в буфер обмена
        try {
          await navigator.clipboard.writeText(shareText)
          toast.success('Ссылка скопирована в буфер обмена')
        } catch (_clipboardError) {
          toast.error('Ошибка при поделиться каталогом')
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 mt-6 max-w-2xl mx-auto">
        <div className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
        <div className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
      </div>
    )
  }

  if (catalogs.length === 0) {
    return null
  }

  // Сортируем каталоги по году (новые первые)
  const sortedCatalogs = [...catalogs].sort((a, b) => b.year - a.year)
  
  // Определяем, сколько каталогов показывать
  const displayedCatalogs = showAll ? sortedCatalogs : sortedCatalogs.slice(0, 3)
  const hasMore = sortedCatalogs.length > 3

  return (
    <div className="flex flex-col gap-3 mt-6 max-w-2xl mx-auto">
      {displayedCatalogs.map((catalog) => (
        <div 
          key={catalog.id} 
          className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white/80 backdrop-blur-sm border border-cyan-200/40 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-semibold text-lg text-gray-800">{catalog.title}</h3>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => handleDownload(catalog)}
              disabled={downloading === catalog.id}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-lg font-medium"
            >
              {downloading === catalog.id ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Загрузка...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>{isMobile ? 'Открыть' : 'Скачать'}</span>
                </>
              )}
            </Button>

            <Button
              onClick={() => handleShare(catalog)}
              variant="outline"
              className="flex items-center gap-2 px-4 py-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 rounded-lg font-medium"
            >
              <Share2 className="w-4 h-4" />
              <span>Поделиться</span>
            </Button>
          </div>
        </div>
      ))}
      
      {/* Кнопка показать все */}
      {hasMore && !showAll && (
        <Button
          onClick={() => setShowAll(true)}
          variant="outline"
          className="mx-auto mt-2 flex items-center gap-2 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 border-cyan-300"
        >
          <span>Показать все каталоги ({sortedCatalogs.length})</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      )}
      
      {/* Кнопка свернуть */}
      {hasMore && showAll && (
        <Button
          onClick={() => setShowAll(false)}
          variant="outline"
          className="mx-auto mt-2 flex items-center gap-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
        >
          <span>Свернуть</span>
          <ChevronUp className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}