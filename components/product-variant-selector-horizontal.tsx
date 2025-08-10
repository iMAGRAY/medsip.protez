"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle, Circle, Star, Shield, Clock, ArrowLeft } from 'lucide-react'
import { SafeImage } from '@/components/safe-image'
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

interface ProductVariantSelectorHorizontalProps {
  productId: string | number
  initialVariantId?: number
  onVariantChange: (variant: ProductVariantV2 | null) => void
  className?: string
}

// Вспомогательная функция для получения краткого названия варианта
const getVariantShortName = (variant: Pick<ProductVariantV2, 'attributes' | 'name'>) => {
  return variant?.attributes?.size || variant?.name
}

export function ProductVariantSelectorHorizontal({ 
  productId, 
  initialVariantId,
  onVariantChange,
  className 
}: ProductVariantSelectorHorizontalProps) {
  const [variants, setVariants] = useState<ProductVariantV2[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantV2 | null>(null)
  const [loading, setLoading] = useState(true)
 
  const fetchVariants = useCallback(async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/v2/product-variants?master_id=${productId}&include_images=true&include_characteristics=true`
        )
        const data = await response.json()
        
        if (data.success && data.data) {
          // Фильтруем варианты: если есть только один вариант "Standard", не показываем его
          let filteredVariants = data.data
          if (data.data.length === 1 && data.data[0].name?.includes('Standard')) {
            // Не показываем селектор и не выбираем вариант автоматически
            setVariants([])
            setLoading(false)
            return
          }
          
          setVariants(filteredVariants)
          
          // Выбираем начальный вариант
          let variantToSelect = null
          
          if (initialVariantId) {
            variantToSelect = filteredVariants.find((v: ProductVariantV2) => v.id === initialVariantId)
          }
          
          if (!variantToSelect && filteredVariants.length > 0) {
            // Не выбираем автоматически, пусть пользователь сам выберет
            // variantToSelect остается null
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
    }, [productId])

  useEffect(() => {
    fetchVariants()
  }, [fetchVariants])

  const handleVariantSelect = (variant: ProductVariantV2) => {
    setSelectedVariant(variant)
    onVariantChange(variant)
  }

  const handleReturnToMaster = () => {
    setSelectedVariant(null)
    onVariantChange(null)
  }

      // Группируем варианты по атрибутам
  const groupedVariants = () => {
    const groups: { [key: string]: ProductVariantV2[] } = {}
    
    variants.forEach(variant => {
      // Группируем по размеру, если он есть
      if (variant.attributes?.size) {
        const key = 'size'
        if (!groups[key]) groups[key] = []
        groups[key].push(variant)
      }
      // Если нет размера, группируем по цвету
      else if (variant.attributes?.color) {
        const key = 'color'
        if (!groups[key]) groups[key] = []
        groups[key].push(variant)
      }
      // Если нет ни размера, ни цвета, создаем общую группу
      else {
        const key = 'other'
        if (!groups[key]) groups[key] = []
        groups[key].push(variant)
      }
    })
    
    return groups
  }

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="h-6 bg-gray-200 rounded animate-pulse w-32" />
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-24 h-24 bg-gray-100 rounded-lg animate-pulse flex-shrink-0" />
          ))}
        </div>
      </div>
    )
  }

  if (variants.length === 0) {
    return null
  }

  if (variants.length === 1) {
    // Не выбираем автоматически единственный вариант
    
    return (
      <div className={cn("space-y-3", className)}>
        {/* Кнопка возврата к товару */}
        {selectedVariant && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReturnToMaster}
            className="gap-2 text-gray-600 hover:text-gray-900 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться к товару
          </Button>
        )}

        <h3 className="text-sm font-medium text-gray-700">Доступная модификация</h3>
        
        {/* Сообщение о необходимости выбора варианта */}
        {!selectedVariant && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
            <p className="text-sm text-amber-800 font-medium">
              Нажмите на вариант ниже для выбора
            </p>
          </div>
        )}
        
        <div 
          className={cn(
            "p-3 border-2 rounded-xl cursor-pointer transition-all duration-300",
            selectedVariant?.id === variants[0].id
              ? "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-500 shadow-lg shadow-cyan-200/50"
              : "bg-white border-gray-200 hover:border-cyan-300 hover:shadow-md"
          )}
          onClick={() => handleVariantSelect(variants[0])}
        >
          <div className="flex items-center gap-3">
            {variants[0].primary_image_url && (
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shadow-sm">
                <SafeImage
                  src={variants[0].primary_image_url}
                  alt={getVariantShortName(variants[0])}
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                />
              </div>
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">{getVariantShortName(variants[0])}</p>
              {variants[0].attributes && Object.keys(variants[0].attributes).length > 0 && (
                <div className="flex gap-2 mt-1">
                  {Object.entries(variants[0].attributes)
                    .filter(([key, value]) => {
                      // Показываем только простые значения (строки, числа, булевы)
                      return typeof value !== 'object' && !Array.isArray(value) && value !== null
                    })
                    .map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {String(value)}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
            {selectedVariant?.id === variants[0].id ? (
              <CheckCircle className="w-5 h-5 text-cyan-600" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
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

      {/* Сообщение о необходимости выбора варианта */}
      {!selectedVariant && variants.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium">
            Пожалуйста, выберите вариант товара для просмотра детальной информации
          </p>
        </div>
      )}
      
      {Object.entries(groupedVariants()).map(([groupKey, groupVariants]) => (
        <div key={groupKey} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              {groupKey === 'size' ? 'Размер' : 
               groupKey === 'color' ? 'Цвет' : 
               'Варианты'}
              <span className="ml-2 text-xs text-gray-500">({(groupVariants as ProductVariantV2[]).length})</span>
            </h3>
            {selectedVariant && (
              <div className="text-xs text-gray-500">
                Выбрано: {getVariantShortName(selectedVariant)}
              </div>
            )}
          </div>

          {/* Горизонтальная сетка вариантов в стиле AliExpress */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {(groupVariants as ProductVariantV2[]).map((variant) => (
                <div
                  key={variant.id}
                  className={cn(
                    "relative group cursor-pointer rounded-xl border-2 bg-white transition-all duration-300 flex-shrink-0 min-w-[100px] max-w-[150px] hover:scale-105",
                    selectedVariant?.id === variant.id
                      ? "border-cyan-500 shadow-lg shadow-cyan-200/50 bg-gradient-to-br from-cyan-50 to-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md",
                    !variant.in_stock && "opacity-60 cursor-not-allowed"
                  )}
                  onClick={() => variant.in_stock && handleVariantSelect(variant)}
                >
                  {/* Изображение варианта */}
                  <div className="aspect-square relative overflow-hidden rounded-t-lg">
                    {variant.primary_image_url ? (
                      <SafeImage
                        src={variant.primary_image_url}
                        alt={getVariantShortName(variant)}
                        fill
                        className="object-contain group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-400 font-medium">
                          {variant.attributes?.size || variant.attributes?.color || 'Вариант'}
                        </span>
                      </div>
                    )}
                    
                    {/* Бейджи статуса */}
                    <div className="absolute top-1 right-1 flex flex-col gap-1">
                      {variant.is_recommended && (
                        <Badge className="bg-purple-500 text-white text-[10px] px-1 py-0.5">
                          <Star className="w-2 h-2" />
                        </Badge>
                      )}
                      {variant.is_new && (
                        <Badge className="bg-green-500 text-white text-[10px] px-1 py-0.5">
                          NEW
                        </Badge>
                      )}
                      {variant.is_bestseller && (
                        <Badge className="bg-orange-500 text-white text-[10px] px-1 py-0.5">
                          HIT
                        </Badge>
                      )}
                    </div>

                    {/* Индикатор выбора */}
                    <div className="absolute top-1 left-1">
                      {selectedVariant?.id === variant.id ? (
                        <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center shadow-md">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                      )}
                    </div>

                    {/* Наложение при недоступности */}
                    {!variant.in_stock && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                          Нет в наличии
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Информация о варианте */}
                  <div className="p-2 space-y-1">
                    {/* Атрибуты */}
                    {variant.attributes && (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {(() => {
                          const attrs = variant.attributes;
                          
                          // Если атрибуты - это массив объектов
                          if (Array.isArray(attrs)) {
                            return attrs
                              .slice(0, 2) // Показываем только первые 2 атрибута
                              .map((attr, index) => (
                                <Badge key={`${attr.group_id}-${attr.value_id}-${index}`} variant="outline" className="text-[10px] px-1 py-0">
                                  {attr.value_name || ''}
                                </Badge>
                              ));
                          }
                          
                          // Если атрибуты - это объект
                          if (typeof attrs === 'object' && !Array.isArray(attrs)) {
                            return Object.entries(attrs)
                              .filter(([key, value]) => {
                                // Показываем только простые значения (строки, числа, булевы)
                                return typeof value !== 'object' && !Array.isArray(value) && value !== null
                              })
                              .slice(0, 2)
                              .map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-[10px] px-1 py-0">
                                  {String(value)}
                                </Badge>
                              ));
                          }
                          
                          return null;
                        })()}
                      </div>
                    )}

                    {/* Цена */}
                    <div className="text-center">
                      {variant.discount_price ? (
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-cyan-700">
                            {variant.discount_price.toLocaleString('ru-RU')} ₽
                          </div>
                          <div className="text-[10px] line-through text-gray-400">
                            {variant.price?.toLocaleString('ru-RU')} ₽
                          </div>
                        </div>
                      ) : variant.price ? (
                        <div className="text-xs font-bold text-gray-900">
                          {variant.price.toLocaleString('ru-RU')} ₽
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-600">По запросу</div>
                      )}
                    </div>

                    {/* Дополнительная информация */}
                    <div className="flex justify-center gap-1">
                      {variant.warranty_months && (
                        <div className="flex items-center text-[10px] text-gray-500" title={`Гарантия ${variant.warranty_months} мес.`}>
                          <Shield className="w-2.5 h-2.5 mr-0.5" />
                          {variant.warranty_months}м
                        </div>
                      )}
                      {variant.battery_life_hours && (
                        <div className="flex items-center text-[10px] text-gray-500" title={`Время работы ${variant.battery_life_hours} ч.`}>
                          <Clock className="w-2.5 h-2.5 mr-0.5" />
                          {variant.battery_life_hours}ч
                        </div>
                      )}
                    </div>

                    {/* Предупреждение об ограниченных запасах */}
                    {variant.in_stock && variant.available_stock <= 5 && (
                      <div className="text-center">
                        <Badge variant="warning" className="text-[10px] bg-orange-100 text-orange-700">
                          Осталось: {variant.available_stock}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {/* Информация о выбранном варианте */}
      {selectedVariant && (
        <div className="p-4 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl transition-all duration-300">
          <div className="flex items-start gap-4">
            {selectedVariant.primary_image_url && (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white shadow-sm flex-shrink-0">
                <SafeImage
                  src={selectedVariant.primary_image_url}
                  alt={getVariantShortName(selectedVariant)}
                  width={64}
                  height={64}
                  className="object-contain w-full h-full"
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 truncate">{getVariantShortName(selectedVariant)}</h4>
              {selectedVariant.short_description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {selectedVariant.short_description}
                </p>
              )}
              
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  {selectedVariant.discount_price ? (
                    <>
                      <span className="text-lg font-bold text-cyan-700">
                        {selectedVariant.discount_price.toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-sm line-through text-gray-400">
                        {selectedVariant.price?.toLocaleString('ru-RU')} ₽
                      </span>
                      <Badge variant="destructive" className="text-xs">
                        -{Math.round(((selectedVariant.price! - selectedVariant.discount_price) / selectedVariant.price!) * 100)}%
                      </Badge>
                    </>
                  ) : selectedVariant.price ? (
                    <span className="text-lg font-bold text-gray-900">
                      {selectedVariant.price.toLocaleString('ru-RU')} ₽
                    </span>
                  ) : (
                    <Badge variant="secondary">Цена по запросу</Badge>
                  )}
                </div>
                
                {/* Removed delivery time section */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
