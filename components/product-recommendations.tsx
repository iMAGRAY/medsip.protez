"use client"

import { useState, useEffect, useMemo } from "react"
import { RecommendationEngine } from "@/lib/recommendation-engine"
import { ProductCardSimple } from "@/components/product-card-simple"
import { SafeImage } from "@/components/safe-image"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Sparkles, Package, Building2, TrendingUp } from "lucide-react"
import type { Prosthetic } from "@/lib/data"

// Функция загрузки товаров из API
async function fetchProducts(): Promise<Prosthetic[]> {
  try {
    const res = await fetch('/api/products')
    const data = await res.json()
    if (data.success && Array.isArray(data.data)) {
      return data.data
    }
  } catch (e) {
    console.error('❌ Failed to fetch products for recommendations', e)
  }
  return []
}

interface ProductRecommendationsProps {
  currentProduct: Prosthetic
  allProducts: Prosthetic[]
  onProductSelect?: (product: Prosthetic) => void
  className?: string
}

export function ProductRecommendations({
  currentProduct,
  allProducts,
  onProductSelect,
  className = ""
}: ProductRecommendationsProps) {
  const [currentRecommendationIndex, setCurrentRecommendationIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [sourceProducts, setSourceProducts] = useState<Prosthetic[]>(allProducts)

  // Загружаем товары, если они не переданы
  useEffect(() => {
    if (allProducts.length === 0) {
      fetchProducts().then((loaded) => {
        if (loaded.length > 0) {
          setSourceProducts(loaded)
        }
      })
    }
  }, [allProducts.length])

  // Получаем рекомендации
  const recommendations = useMemo(() => {
    if (!currentProduct || sourceProducts.length === 0) return []
    const engine = new RecommendationEngine(sourceProducts)
    return engine.getMixedRecommendations(currentProduct, 8)
  }, [currentProduct, sourceProducts]) // Добавляем currentProduct как зависимость

  // Анимация появления и сброс состояния при смене товара
  useEffect(() => {
    setIsVisible(false)
    setCurrentRecommendationIndex(0) // Сбрасываем на первую группу рекомендаций

    const timer = setTimeout(() => setIsVisible(true), 300)
    return () => clearTimeout(timer)
  }, [currentProduct?.id]) // Добавляем зависимость от ID товара

  // Если нет рекомендаций, не показываем компонент
  if (recommendations.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-cyan-200/40 shadow-lg shadow-cyan-100/20 p-8 text-center">
        <div className="text-slate-500">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Пока нет рекомендаций</h3>
          <p className="text-sm">Мы работаем над улучшением алгоритма рекомендаций</p>
        </div>
      </div>
    )
  }

  const currentRecommendation = recommendations[currentRecommendationIndex]

  const nextRecommendation = () => {
    setCurrentRecommendationIndex((prev) =>
      prev === recommendations.length - 1 ? 0 : prev + 1
    )
  }

  const prevRecommendation = () => {
    setCurrentRecommendationIndex((prev) =>
      prev === 0 ? recommendations.length - 1 : prev - 1
    )
  }

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'smart':
        return <Sparkles className="w-5 h-5" />
      case 'category':
        return <Package className="w-5 h-5" />
      case 'manufacturer':
        return <Building2 className="w-5 h-5" />
      case 'price':
        return <TrendingUp className="w-5 h-5" />
      case 'diverse':
        return <TrendingUp className="w-5 h-5" />
      default:
        return <Sparkles className="w-5 h-5" />
    }
  }

  return (
    <div className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}>
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-cyan-200/40 shadow-lg shadow-cyan-100/20 overflow-hidden">

        {/* Заголовок с навигацией */}
        <div className="bg-gradient-to-r from-cyan-50/80 to-blue-50/60 p-4 border-b border-cyan-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getRecommendationIcon(currentRecommendation.type)}
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {currentRecommendation.title}
                </h3>
                <p className="text-sm text-slate-600">
                  {currentRecommendation.products.length} товаров
                </p>
              </div>
            </div>

            {/* Навигация между типами рекомендаций */}
            {recommendations.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevRecommendation}
                  className="w-8 h-8 p-0 bg-white/50 border-cyan-200 hover:bg-cyan-50 touch-manipulation"
                  aria-label="Предыдущая рекомендация"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex gap-1">
                  {recommendations.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentRecommendationIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors touch-manipulation ${
                        index === currentRecommendationIndex
                          ? 'bg-cyan-500'
                          : 'bg-cyan-200 hover:bg-cyan-300'
                      }`}
                      aria-label={`Перейти к рекомендации ${index + 1}`}
                    />
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextRecommendation}
                  className="w-8 h-8 p-0 bg-white/50 border-cyan-200 hover:bg-cyan-50 touch-manipulation"
                  aria-label="Следующая рекомендация"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Контент рекомендаций */}
        <div className="p-4">
          {currentRecommendation.products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentRecommendation.products
                .filter(product => String(product.id) !== String(currentProduct.id)) // Дополнительная защита
                .slice(0, 4)
                .map((product, _index) => {
                  return (
                    <ProductCardSimple
                      key={product.id}
                      product={product}
                      onQuickView={(selectedProduct) => {
                        if (onProductSelect) {
                          onProductSelect(selectedProduct)
                        }
                      }}
                    />
                  )
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Нет доступных рекомендаций</p>
            </div>
          )}

          {/* Показать все товары этого типа */}
          {currentRecommendation.products.length > 4 && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => {
                  // Прокручиваем к секции с товарами или открываем страницу каталога с фильтром
                  const categoryFilter = currentRecommendation.type === 'category' && currentProduct.category 
                    ? `?category=${encodeURIComponent(currentProduct.category)}`
                    : ''
                  const manufacturerFilter = currentRecommendation.type === 'manufacturer' && currentProduct.manufacturer
                    ? `?manufacturer=${encodeURIComponent(currentProduct.manufacturer)}`
                    : ''
                  
                  window.location.href = `/products${categoryFilter || manufacturerFilter}`
                }}
                className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700 hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300 touch-manipulation"
              >
                Показать все {currentRecommendation.products.length} товаров
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Компактная версия рекомендаций для сайдбара
 */
export function ProductRecommendationsSidebar({
  currentProduct,
  allProducts,
  onProductSelect,
  className = ""
}: ProductRecommendationsProps) {
  const [sourceProducts, setSourceProducts] = useState<Prosthetic[]>(allProducts)

  // Загружаем товары, если они не переданы
  useEffect(() => {
    if (allProducts.length === 0) {
      fetchProducts().then((loaded) => {
        if (loaded.length > 0) {
          setSourceProducts(loaded)
        }
      })
    }
  }, [allProducts.length])

  const sidebarRecommendations = useMemo(() => {
    if (!currentProduct || sourceProducts.length === 0) return []
    const engine = new RecommendationEngine(sourceProducts)
    return engine.getRecommendations(currentProduct, 3)
  }, [currentProduct, sourceProducts])

  if (sidebarRecommendations.length === 0) {
    return null
  }

  return (
    <div className={`bg-white/70 backdrop-blur-xl rounded-xl border border-cyan-200/40 shadow-sm overflow-hidden ${className}`}>
      <div className="bg-gradient-to-r from-cyan-50/80 to-blue-50/60 p-3 border-b border-cyan-200/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-600" />
          <h4 className="text-sm font-semibold text-slate-800">Рекомендуем</h4>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {sidebarRecommendations
          .filter(({ product }) => String(product.id) !== String(currentProduct.id)) // Дополнительная защита
          .map(({ product, reasons }) => (
            <div
              key={product.id}
              className="group cursor-pointer touch-manipulation"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onProductSelect?.(product)
            }}
            onTouchEnd={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onProductSelect?.(product)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onProductSelect?.(product)
              }
            }}
          >
            <div className="flex gap-3 p-2 rounded-lg hover:bg-cyan-50/50 transition-colors">
              <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-cyan-50 to-blue-50">
                <SafeImage
                  src={product.imageUrl || product.image_url || (product.images && product.images.length > 0 ? product.images[0] : null) || '/placeholder.jpg'}
                  alt={product.name}
                  fill
                  sizes="64px"
                  className="object-cover transition-all duration-300 ease-out group-hover:scale-110"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-medium text-slate-800 line-clamp-2 group-hover:text-cyan-700">
                  {product.name}
                </h5>
                <p className="text-xs text-slate-500 mt-1">
                  {reasons[0] || 'Похожий товар'}
                </p>
                {product.price && (
                  <p className="text-xs font-medium text-cyan-600 mt-1">
                    {new Intl.NumberFormat('ru-RU', {
                      style: 'currency',
                      currency: 'RUB'
                    }).format(product.price)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}