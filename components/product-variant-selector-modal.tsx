"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle, Circle } from 'lucide-react'
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
    characteristics?: any[]
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

interface ProductVariantSelectorModalProps {
  productId: string | number
  masterProduct: MasterProduct
  initialVariantId?: number
  onVariantChange: (variant: ProductVariantV2 | null) => void
  className?: string
}

export function ProductVariantSelectorModal({ 
  productId, 
  masterProduct,
  initialVariantId,
  onVariantChange,
  className 
}: ProductVariantSelectorModalProps) {
  const [variants, setVariants] = useState<ProductVariantV2[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantV2 | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVariants()
  }, [productId])

  const fetchVariants = async () => {
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
  }

  const handleVariantSelect = (variant: ProductVariantV2 | null) => {
    setSelectedVariant(variant)
    onVariantChange(variant)
  }

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="h-6 bg-gray-200 rounded animate-pulse w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
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

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Выберите вариант товара
          <span className="ml-2 text-xs text-gray-500">({allItems.length})</span>
        </h3>
      </div>

      {/* Компактная сетка с карточками */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-2">
        {allItems.map((item) => {
          const isMaster = item.type === 'master'
          const isSelected = isMaster ? !selectedVariant : selectedVariant?.id === item.data.id
          const itemData = item.data as any
          const inStock = itemData.in_stock

          const displayName = item.type === 'master'
            ? masterProduct.name
            : itemData.name || itemData.attributes?.size || 'Вариант'

          return (
            <div
              key={item.id}
              className={cn(
                "relative group cursor-pointer rounded-lg border-2 bg-white transition-all duration-300 p-3",
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
              {/* Чекбокс выбора */}
              <div className="absolute top-2 right-2 z-10">
                {isSelected ? (
                  <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center shadow-md">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <Circle className="w-5 h-5 text-gray-400 bg-white rounded-full shadow-sm" />
                )}
              </div>

              {/* Бейджи */}
              {(isMaster || itemData.is_new || itemData.is_bestseller) && (
                <div className="absolute top-2 left-2 flex gap-1 z-10">

                  {!isMaster && itemData.is_new && (
                    <Badge className="bg-green-500 text-white text-[9px] px-1 py-0">
                      NEW
                    </Badge>
                  )}
                  {!isMaster && itemData.is_bestseller && (
                    <Badge className="bg-orange-500 text-white text-[9px] px-1 py-0">
                      HIT
                    </Badge>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {/* Название */}
                <h4 className="font-medium text-sm text-gray-900 line-clamp-2 min-h-[2.5rem]">
                  {displayName}
                </h4>

                {/* Цена */}
                <div className="text-center">
                  {itemData.show_price === false || (!itemData.price && !itemData.discount_price) ? (
                    <div className="text-sm text-gray-600">По запросу</div>
                  ) : itemData.discount_price ? (
                    <div className="space-y-0.5">
                      <div className="text-base font-bold text-cyan-700">
                        {itemData.discount_price.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-xs line-through text-gray-400">
                        {itemData.price?.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  ) : (
                    <div className="text-base font-bold text-gray-900">
                      {itemData.price?.toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </div>

                {/* Статус наличия (только если нет в наличии) */}
                {!inStock && (
                  <div className="text-center">
                    <Badge className="bg-red-100 text-red-700 text-xs">
                      Нет в наличии
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>


    </div>
  )
}