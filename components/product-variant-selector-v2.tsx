"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  Check, 
  Eye, 
  ShoppingCart,
  ArrowLeft, 
  Heart, 
  Share2, 
  Package,
  Shield,
  Battery,
  Weight,
  Ruler
} from 'lucide-react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface ProductVariantV2 {
  id: number
  master_id: number
  name: string
  slug: string
  description?: string
  short_description?: string
  sku?: string
  price?: number
  discount_price?: number
  stock_quantity: number
  available_stock: number
  in_stock: boolean
  weight?: number
  length?: number
  width?: number
  height?: number
  primary_image_url?: string
  images?: any[]
  attributes: {
    size?: string
    color?: string
    material?: string
    [key: string]: any
  }
  warranty_months?: number
  battery_life_hours?: number
  is_featured: boolean
  is_new: boolean
  is_bestseller: boolean
  is_recommended: boolean
  characteristics?: any[]
  variant_images?: any[]
}

interface ProductVariantSelectorV2Props {
  productId: string | number
  initialVariantId?: number
  onVariantChange: (variant: ProductVariantV2 | null) => void
  className?: string
}

// Вспомогательная функция для отображения короткого названия варианта
const getVariantShortName = (variant: Pick<ProductVariantV2, 'attributes' | 'name'>) => {
  return variant?.attributes?.size || variant?.name
}

export function ProductVariantSelectorV2({ 
  productId, 
  initialVariantId,
  onVariantChange,
  className 
}: ProductVariantSelectorV2Props) {
  const [variants, setVariants] = useState<ProductVariantV2[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageLoading, setImageLoading] = useState(false)
  const [comparisonMode, setComparisonMode] = useState(false)
  const [compareVariants, setCompareVariants] = useState<number[]>([])

  const fetchVariants = useCallback(async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/v2/product-variants?master_id=${productId}&include_images=true&include_characteristics=true`
        )
        const data = await response.json()
        
        if (data.success && data.data) {
          setVariants(data.data)
          
          // Выбираем начальный вариант
          let variantToSelect = null
          
          if (initialVariantId) {
            variantToSelect = data.data.find((v: ProductVariantV2) => v.id === initialVariantId)
          }
          
          if (!variantToSelect) {
            // Приоритеты: рекомендуемый > избранный > в наличии > первый
            variantToSelect = data.data.find((v: ProductVariantV2) => v.is_recommended) ||
                             data.data.find((v: ProductVariantV2) => v.is_featured) ||
                             data.data.find((v: ProductVariantV2) => v.in_stock) ||
                             data.data[0]
          }
          
          if (variantToSelect) {
            handleVariantSelect(variantToSelect)
          }
        }
      } catch (error) {
        console.error('Error fetching variants:', error)
        toast.error('Не удалось загрузить варианты товара')
      } finally {
        setLoading(false)
      }
    }, [productId, initialVariantId])

  useEffect(() => {
    fetchVariants()
  }, [fetchVariants])

  const handleVariantSelect = useCallback((variant: ProductVariantV2) => {
    setImageLoading(true)
    setSelectedVariant(variant)
    onVariantChange(variant)
    
    // Имитация загрузки изображения
    setTimeout(() => setImageLoading(false), 300)
  }, [onVariantChange])

  const handleReturnToMaster = () => {
    setSelectedVariant(null)
    onVariantChange(null)
  }

  const toggleCompareVariant = (variantId: number) => {
    setCompareVariants(prev => {
      if (prev.includes(variantId)) {
        return prev.filter(id => id !== variantId)
      } else if (prev.length < 3) {
        return [...prev, variantId]
      } else {
        toast.warning('Можно сравнить максимум 3 варианта')
        return prev
      }
    })
  }

  // Группировка вариантов по атрибутам
  const _groupedVariants = useMemo(() => {
    const groups: Record<string, ProductVariantV2[]> = {}
    
    variants.forEach(variant => {
      const key = variant.attributes.size || variant.attributes.color || 'default'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(variant)
    })
    
    return groups
  }, [variants])

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (variants.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Кнопка возврата к товару */}
      {selectedVariant && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleReturnToMaster}
          className="gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться к товару
        </Button>
      )}

      {/* Заголовок с режимом сравнения */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Варианты товара
          {variants.length > 1 && (
            <Badge variant="secondary" className="ml-2">
              {variants.length}
            </Badge>
          )}
        </h3>
        
        {variants.length > 1 && (
          <Button
            size="sm"
            variant={comparisonMode ? "default" : "outline"}
            onClick={() => setComparisonMode(!comparisonMode)}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {comparisonMode ? 'Выйти из сравнения' : 'Сравнить'}
          </Button>
        )}
      </div>

      {/* Основной селектор вариантов */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {variants.map((variant) => (
            <motion.div
              key={variant.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative group cursor-pointer rounded-xl border-2 p-5 transition-all",
                selectedVariant?.id === variant.id
                  ? "border-cyan-500 bg-cyan-50 shadow-lg"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-md",
                !variant.in_stock && "opacity-60"
              )}
              onClick={() => variant.in_stock && handleVariantSelect(variant)}
            >
              {/* Бейджи статуса */}
              <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                {variant.is_recommended && (
                  <Badge className="bg-purple-500 text-white text-xs">
                    Рекомендуем
                  </Badge>
                )}
                {variant.is_new && (
                  <Badge className="bg-green-500 text-white text-xs">
                    Новинка
                  </Badge>
                )}
                {variant.is_bestseller && (
                  <Badge className="bg-orange-500 text-white text-xs">
                    Хит
                  </Badge>
                )}
              </div>

              {/* Изображение варианта */}
              {variant.primary_image_url && (
                <div className="relative h-32 mb-3 rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={variant.primary_image_url}
                    alt={getVariantShortName(variant)}
                    fill
                    className={cn(
                      "object-contain transition-opacity duration-300",
                      imageLoading && selectedVariant?.id === variant.id
                        ? "opacity-0"
                        : "opacity-100"
                    )}
                  />
                </div>
              )}

              {/* Информация о варианте */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 line-clamp-2">
                  {getVariantShortName(variant)}
                </h4>
                
                {variant.short_description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {variant.short_description}
                  </p>
                )}

                {/* Атрибуты */}
                <div className="flex flex-wrap gap-1">
                  {Object.entries(variant.attributes).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {value}
                    </Badge>
                  ))}
                </div>

                {/* Цена */}
                <div className="pt-2">
                  {variant.discount_price ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-cyan-700">
                        {variant.discount_price.toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-sm line-through text-gray-400">
                        {variant.price?.toLocaleString('ru-RU')} ₽
                      </span>
                      <Badge variant="destructive" className="text-xs">
                        -{Math.round(((variant.price! - variant.discount_price) / variant.price!) * 100)}%
                      </Badge>
                    </div>
                  ) : variant.price ? (
                    <span className="text-lg font-bold text-gray-900">
                      {variant.price.toLocaleString('ru-RU')} ₽
                    </span>
                  ) : (
                    <Badge variant="secondary">Цена по запросу</Badge>
                  )}
                </div>

                {/* Наличие */}
                <div className="flex items-center gap-2 text-sm">
                  {variant.in_stock ? (
                    <>
                      <Package className="w-4 h-4 text-green-600" />
                      <span className="text-green-600 font-medium">В наличии</span>
                      {variant.available_stock <= 5 && (
                        <Badge variant="warning" className="text-xs">
                          Осталось: {variant.available_stock}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 text-red-600" />
                      <span className="text-red-600 font-medium">Нет в наличии</span>
                    </>
                  )}
                </div>

                {/* Дополнительная информация */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-gray-600">
                  {variant.warranty_months && (
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>Гарантия {variant.warranty_months} мес.</span>
                    </div>
                  )}
                  {variant.battery_life_hours && (
                    <div className="flex items-center gap-1">
                      <Battery className="w-3 h-3" />
                      <span>{variant.battery_life_hours} ч</span>
                    </div>
                  )}
                  {variant.weight && (
                    <div className="flex items-center gap-1">
                      <Weight className="w-3 h-3" />
                      <span>{variant.weight} кг</span>
                    </div>
                  )}
                  {variant.length && variant.width && variant.height && (
                    <div className="flex items-center gap-1">
                      <Ruler className="w-3 h-3" />
                      <span>{variant.length}×{variant.width}×{variant.height}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Индикатор выбора */}
              {selectedVariant?.id === variant.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Check className="w-5 h-5 text-white" />
                </motion.div>
              )}

              {/* Кнопка сравнения */}
              {comparisonMode && (
                <div className="absolute bottom-2 right-2">
                  <Button
                    size="sm"
                    variant={compareVariants.includes(variant.id) ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCompareVariant(variant.id)
                    }}
                    className="h-8 px-2"
                  >
                    {compareVariants.includes(variant.id) ? 'Убрать' : 'Сравнить'}
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Быстрые действия для выбранного варианта */}
      {selectedVariant && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-3 pt-4 border-t"
        >
          <Button 
            size="lg" 
            className="flex-1 gap-2"
            disabled={!selectedVariant.in_stock}
          >
            <ShoppingCart className="w-5 h-5" />
            {selectedVariant.in_stock ? 'В корзину' : 'Нет в наличии'}
          </Button>
          
          <Button size="lg" variant="outline" className="gap-2">
            <Heart className="w-5 h-5" />
            В избранное
          </Button>
          
          <Button size="lg" variant="outline" className="gap-2">
            <Share2 className="w-5 h-5" />
            Поделиться
          </Button>
        </motion.div>
      )}

      {/* Removed delivery information section */}
    </div>
  )
}