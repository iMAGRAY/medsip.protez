"use client"

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle, Circle, Star, Package } from 'lucide-react'
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
  // Новые поля для управления складом и отображением цены
  stock_status?: string
  show_price?: boolean
}

interface MasterProduct {
  id: string | number
  name: string
  primary_image_url?: string
  price?: number
  discount_price?: number
  in_stock: boolean
  stock_quantity?: number
  warranty?: string
  batteryLife?: string
}

interface ProductVariantSelectorGridProps {
  productId: string | number
  masterProduct: MasterProduct
  initialVariantId?: number
  onVariantChange: (variant: ProductVariantV2 | null) => void
  className?: string
}

// Добавляем вспомогательную функцию для получения краткого наименования варианта
const getVariantShortName = (variant: Pick<ProductVariantV2, 'attributes' | 'name'>) => {
  return variant?.attributes?.size || variant?.name
}

export function ProductVariantSelectorGrid({ 
  productId, 
  masterProduct,
  initialVariantId,
  onVariantChange,
  className 
}: ProductVariantSelectorGridProps) {
  const [variants, setVariants] = useState<ProductVariantV2[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const fetchVariants = useCallback(async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/v2/product-variants?master_id=${productId}&include_images=true&include_characteristics=true`
        )
        const data = await response.json()
        
        if (data.success && data.data) {
          // Фильтруем стандартные варианты
          let filteredVariants = data.data.filter((variant: ProductVariantV2) => 
            !variant.name?.toLowerCase().includes('standard')
          )
          
          if (filteredVariants.length === 0) {
            setVariants([])
            setLoading(false)
            return
          }
          
          setVariants(filteredVariants)
          
          if (initialVariantId) {
            const variantToSelect = filteredVariants.find((v: ProductVariantV2) => v.id === initialVariantId)
            if (variantToSelect) {
              handleVariantSelect(variantToSelect)
            }
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

  const handleVariantSelect = (variant: ProductVariantV2 | null) => {
    setSelectedVariant(variant)
    onVariantChange(variant)
  }

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="h-6 bg-gray-200 rounded animate-pulse w-32" />
        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (variants.length === 0) {
    return null
  }

  const allItems = [
    {
      type: 'master' as const,
      id: `master-${masterProduct.id}`,
      data: masterProduct
    },
    ...variants.map(v => ({
      type: 'variant' as const,
      id: v.id.toString(),
      data: v
    }))
  ]

  // Определяем, сколько элементов показывать изначально на мобильных устройствах
  const mobileInitialCount = 6
  const _itemsToShow = showAll ? allItems : allItems.slice(0, mobileInitialCount)
  const _hasMoreItems = allItems.length > mobileInitialCount

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
        <h3 className="text-xs sm:text-sm font-medium text-gray-700">
          Выберите вариант товара
          <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs text-gray-500">({allItems.length})</span>
        </h3>
        {selectedVariant && (
          <div className="text-[10px] sm:text-xs text-gray-500 break-words">
            Выбрано: {getVariantShortName(selectedVariant)}
          </div>
        )}
        {!selectedVariant && (
          <div className="text-[10px] sm:text-xs text-gray-500 break-words">
            Выбрано: {masterProduct.name}
          </div>
        )}
      </div>

      {/* Горизонтальная прокрутка для всех устройств */}
      <div className="overflow-x-auto -mx-4 px-4 sm:-mx-0 sm:px-0">
        <div className="flex gap-2 sm:gap-3 pb-2">
          {allItems.map((item) => {
            const isMaster = item.type === 'master'
            const isSelected = isMaster ? !selectedVariant : selectedVariant?.id === item.data.id
            const itemData = item.data as any
            const inStock = itemData.in_stock

            const displayName = item.type === 'master'
              ? itemData.name
              : getVariantShortName(itemData as ProductVariantV2)

            return (
              <div
                key={item.id}
                className={cn(
                  "relative group cursor-pointer rounded-lg sm:rounded-xl border-2 bg-white transition-all duration-300 flex-shrink-0",
                  "w-[100px] sm:w-[120px] md:w-[140px] lg:w-[160px]", // Квадратные размеры
                  isSelected
                    ? "border-cyan-500 shadow-md shadow-cyan-200/50 bg-gradient-to-br from-cyan-50 to-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md",
                  !inStock && "opacity-60"
                )}
                onClick={() => {
                  if (isMaster) {
                    handleVariantSelect(null)
                  } else {
                    handleVariantSelect(itemData as ProductVariantV2)
                  }
                }}
              >
                {/* Квадратный контейнер для изображения */}
                <div className="aspect-square relative overflow-hidden rounded-t-md sm:rounded-t-lg p-2">
                  {(() => {
                    // Получаем изображение варианта
                    const imageUrl = itemData.primary_image_url || 
                                   itemData.images?.[0] || 
                                   itemData.variant_images?.[0] ||
                                   null;
                    
                    
                    if (imageUrl) {
                      return (
                        <SafeImage
                          src={imageUrl}
                          alt={displayName}
                          fill
                          className="object-contain"
                        />
                      );
                    } else {
                      return (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <Package className="w-5 sm:w-6 md:w-8 h-5 sm:h-6 md:h-8 text-gray-400" />
                        </div>
                      );
                    }
                  })()}
                  
                  {!isMaster && (
                    <div className="absolute top-0.5 right-0.5 left-0.5 flex flex-wrap gap-0.5 justify-end">
                      {itemData.is_recommended && (
                        <Badge className="bg-purple-500 text-white text-[6px] sm:text-[8px] px-0.5 py-0 h-3 sm:h-4 flex items-center justify-center">
                          <Star className="w-2 h-2 fill-white" />
                        </Badge>
                      )}
                      {itemData.is_new && (
                        <Badge className="bg-green-500 text-white text-[6px] sm:text-[8px] px-0.5 py-0 h-3 sm:h-4">
                          NEW
                        </Badge>
                      )}
                      {itemData.is_bestseller && (
                        <Badge className="bg-orange-500 text-white text-[6px] sm:text-[8px] px-0.5 py-0 h-3 sm:h-4">
                          HIT
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="absolute bottom-1 right-1">
                    {isSelected ? (
                      <div className="w-4 sm:w-5 h-4 sm:h-5 bg-cyan-500 rounded-full flex items-center justify-center shadow-md">
                        <CheckCircle className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-white" />
                      </div>
                    ) : (
                      <Circle className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400" />
                    )}
                  </div>

                  {!inStock && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <span className="text-white text-[8px] sm:text-[10px] font-medium bg-black/50 px-1 py-0.5 rounded text-center">
                        Нет в наличии
                      </span>
                    </div>
                  )}
                </div>

                {/* Информация под изображением */}
                <div className="p-1.5 sm:p-2 space-y-0.5 sm:space-y-1">
                  <h4 className="font-medium text-[8px] sm:text-[10px] md:text-xs text-gray-900 line-clamp-2 text-center">
                    {displayName}
                  </h4>

                  <div className="text-center">
                    {itemData.show_price === false || (!itemData.price && !itemData.discount_price) ? (
                      <div className="text-[8px] sm:text-[9px] text-gray-600">По запросу</div>
                    ) : itemData.discount_price ? (
                      <div className="space-y-0">
                        <div className="text-[9px] sm:text-[11px] md:text-xs font-bold text-cyan-700">
                          {itemData.discount_price.toLocaleString('ru-RU')} ₽
                        </div>
                        {itemData.price && (
                          <div className="text-[7px] sm:text-[9px] line-through text-gray-400">
                            {itemData.price.toLocaleString('ru-RU')} ₽
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[9px] sm:text-[11px] md:text-xs font-bold text-gray-900">
                        {itemData.price?.toLocaleString('ru-RU')} ₽
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>


    </div>
  )
}
