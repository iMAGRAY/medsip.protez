"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Eye, Grid3X3, List } from 'lucide-react'
import { ProductVariantDetails } from './product-variant-details'
import { ProductVariantsGallery } from './product-variants-gallery'

interface ProductVariant {
  id: number
  productId: number
  sizeName: string
  sizeValue?: string
  name?: string
  description?: string
  sku?: string
  price?: number
  discountPrice?: number
  stockQuantity?: number
  weight?: number
  dimensions?: any
  specifications?: any
  isAvailable: boolean
  sortOrder?: number
  imageUrl?: string
  images?: string[]
  warranty?: string
  batteryLife?: string
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  isFeatured?: boolean
  isNew?: boolean
  isBestseller?: boolean
  customFields?: any
  characteristics?: any[]
  selectionTables?: any[]
}

interface ProductVariantSelectorProps {
  productId: string | number
  onVariantSelect: (variant: ProductVariant | null) => void
  className?: string
  productName?: string
}

export function ProductVariantSelector({ 
  productId, 
  onVariantSelect,
  className,
  productName
}: ProductVariantSelectorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [viewingVariant, setViewingVariant] = useState<ProductVariant | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list')

  const fetchVariants = useCallback(async () => {
      try {
        setLoading(true)
        // Используем v2 API для получения вариантов с изображениями
        let response = await fetch(`/api/v2/product-variants?master_id=${productId}&include_images=true&include_characteristics=true`)
        let data = await response.json()
        
        // Если вариантов нет, проверяем не является ли сам товар вариантом
        if (!data.data || data.data.length === 0) {
          // Получаем информацию о товаре
          const productResponse = await fetch(`/api/products/${productId}`)
          const productData = await productResponse.json()
          
          if (productData.success && productData.data) {
            // Проверяем есть ли у товара master_id в таблице product_variants
            const variantCheckResponse = await fetch(`/api/product-variants/${productId}`)
            const variantCheckData = await variantCheckResponse.json()
            
            if (variantCheckData.success && variantCheckData.data && variantCheckData.data.master_id) {
              // Если товар сам является вариантом, загружаем все варианты его мастер-товара
              response = await fetch(`/api/v2/product-variants?master_id=${variantCheckData.data.master_id}&include_images=true&include_characteristics=true`)
              data = await response.json()
            }
          }
        }
        
        if (data.data && data.data.length > 0) {
          // Преобразуем данные из нового формата
          const transformedVariants = data.data.map((v: any) => {
            return {
              id: v.id,
              productId: v.master_id,
              sizeName: v.name || v.attributes?.size || 'Вариант',
              sizeValue: v.attributes?.size_value || '',
              name: v.name,
              description: v.description,
              sku: v.sku,
              price: v.price ? parseFloat(v.price) : undefined,
              discountPrice: v.discount_price ? parseFloat(v.discount_price) : undefined,
              stockQuantity: v.stock_quantity,
              weight: v.weight,
              dimensions: v.dimensions,
              specifications: v.attributes?.specifications,
              isAvailable: v.is_active && v.stock_status !== 'out_of_stock',
              sortOrder: v.sort_order,
              imageUrl: v.primary_image_url,
              primary_image_url: v.primary_image_url,
              images: v.images || [],
              variant_images: v.variant_images || v.images || [],
              warranty: v.warranty_months ? `${v.warranty_months} месяцев` : undefined,
              batteryLife: v.battery_life_hours ? `${v.battery_life_hours} часов` : undefined,
              metaTitle: v.meta_title,
              metaDescription: v.meta_description,
              metaKeywords: v.meta_keywords,
              isFeatured: v.is_featured,
              isNew: v.is_new,
              isBestseller: v.is_bestseller,
              customFields: v.custom_fields,
              characteristics: v.attributes?.characteristics,
              selectionTables: v.attributes?.selection_tables
            }
          })
          
          setVariants(transformedVariants)
          // Автоматически выбираем первый доступный вариант
          const firstAvailable = transformedVariants.find((v: ProductVariant) => v.isAvailable)
          if (firstAvailable) {
            setSelectedVariant(firstAvailable)
            onVariantSelect(firstAvailable)
          }
        }
      } catch (error) {
        console.error('Error fetching variants:', error)
      } finally {
        setLoading(false)
      }
    }, [productId])

  useEffect(() => {
    fetchVariants()
  }, [fetchVariants])

  const handleVariantChange = (variantId: string) => {
    const variant = variants.find(v => v.id.toString() === variantId)
    setSelectedVariant(variant || null)
    onVariantSelect(variant || null)
  }

  const handleViewDetails = (variant: ProductVariant, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setViewingVariant(variant)
    setDetailsOpen(true)
  }

  // Если нет вариантов, не показываем селектор
  if (!loading && variants.length === 0) {
    return null
  }

  // Если только один вариант, показываем его как выбранный без возможности изменения
  if (!loading && variants.length === 1) {
    const singleVariant = variants[0]
    return (
      <>
        <div className={cn("space-y-2", className)}>
          <h3 className="text-sm font-medium text-slate-700">Вариант товара</h3>
          <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{singleVariant.sizeName}</p>
              {singleVariant.sizeValue && (
                <p className="text-sm text-slate-600">{singleVariant.sizeValue}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => handleViewDetails(singleVariant, e)}
              className="p-2 h-auto"
              title="Подробнее о варианте"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Диалог с подробной информацией о варианте */}
        <ProductVariantDetails
          variant={viewingVariant}
          isOpen={detailsOpen}
          onClose={() => {
            setDetailsOpen(false)
            setViewingVariant(null)
          }}
          productName={productName}
        />
      </>
    )
  }

  return (
    <>
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Выберите вариант</h3>
        {variants.length > 2 && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              className="p-2 h-auto"
              title="Список"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'gallery' ? 'default' : 'ghost'}
              onClick={() => setViewMode('gallery')}
              className="p-2 h-auto"
              title="Галерея"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'gallery' && variants.length > 2 ? (
        <ProductVariantsGallery
          variants={variants}
          selectedVariant={selectedVariant}
          onVariantSelect={(variant) => {
            setSelectedVariant(variant)
            onVariantSelect(variant)
          }}
          productName={undefined}
        />
      ) : (
        <RadioGroup 
          value={selectedVariant?.id.toString()} 
          onValueChange={handleVariantChange}
          className="space-y-2"
        >
          {variants.map((variant) => (
            <div key={variant.id} className="relative">
              <RadioGroupItem
                value={variant.id.toString()}
                id={`variant-${variant.id}`}
                className="peer sr-only"
                disabled={!variant.isAvailable}
              />
              <Label
                htmlFor={`variant-${variant.id}`}
                className={cn(
                  "flex items-center justify-between p-5 rounded-lg border-2 cursor-pointer transition-all",
                  "hover:bg-slate-50",
                  "peer-checked:border-cyan-500 peer-checked:bg-cyan-50",
                  !variant.isAvailable && "opacity-50 cursor-not-allowed bg-slate-50"
                )}
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-800">
                    {variant.sizeName}
                    {variant.isFeatured && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Рекомендуем
                      </span>
                    )}
                  </p>
                  {variant.name && (
                    <p className="text-sm font-medium text-slate-700 mt-1">{variant.name}</p>
                  )}
                  {variant.sizeValue && (
                    <p className="text-sm text-slate-600">{variant.sizeValue}</p>
                  )}
                  {variant.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{variant.description}</p>
                  )}

                </div>
                
                <div className="flex items-start gap-3">
                  <div className="text-right">
                    {variant.discountPrice ? (
                      <div>
                        <p className="text-sm line-through text-slate-400">
                          {variant.price?.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="font-bold text-cyan-700">
                          {variant.discountPrice.toLocaleString('ru-RU')} ₽
                        </p>
                      </div>
                    ) : variant.price ? (
                      <p className="font-bold text-slate-800">
                        {variant.price.toLocaleString('ru-RU')} ₽
                      </p>
                    ) : (
                      <Badge variant="secondary">Цена по запросу</Badge>
                    )}
                    
                    {!variant.isAvailable && (
                      <Badge variant="destructive" className="mt-1">
                        Нет в наличии
                      </Badge>
                    )}
                    {variant.isAvailable && variant.stockQuantity !== null && variant.stockQuantity !== undefined && variant.stockQuantity <= 5 && (
                      <Badge variant="warning" className="mt-1">
                        Осталось: {variant.stockQuantity}
                      </Badge>
                    )}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleViewDetails(variant, e)}
                    className="p-2 h-auto"
                    title="Подробнее о варианте"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </div>

    {/* Диалог с подробной информацией о варианте */}
    <ProductVariantDetails
      variant={viewingVariant}
      isOpen={detailsOpen}
      onClose={() => {
        setDetailsOpen(false)
        setViewingVariant(null)
      }}
      productName={productName}
    />
  </>
  )
}