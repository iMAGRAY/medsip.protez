"use client"

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'
import { SafeImage } from '@/components/safe-image'
import { ProductVariantDetails } from './product-variant-details'
import { cn } from '@/lib/utils'

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

interface ProductVariantsGalleryProps {
  variants: ProductVariant[]
  selectedVariant: ProductVariant | null
  onVariantSelect: (variant: ProductVariant) => void
  productName?: string
  className?: string
}

export function ProductVariantsGallery({
  variants,
  selectedVariant,
  onVariantSelect,
  productName,
  className
}: ProductVariantsGalleryProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [viewingVariant, setViewingVariant] = useState<ProductVariant | null>(null)

  const handleViewDetails = (variant: ProductVariant) => {
    setViewingVariant(variant)
    setDetailsOpen(true)
  }

  if (variants.length === 0) return null

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <h3 className="text-lg font-semibold text-slate-800">Доступные варианты</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {variants.map((variant) => (
            <Card
              key={variant.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg",
                selectedVariant?.id === variant.id && "ring-2 ring-cyan-500"
              )}
              onClick={() => onVariantSelect(variant)}
            >
              <CardContent className="p-6">
                {/* Изображение */}
                {variant.images && variant.images.length > 0 && (
                  <div className="relative aspect-square mb-3 rounded-lg overflow-hidden">
                    <SafeImage
                      src={variant.images[0]}
                      alt={variant.sizeName}
                      fill
                      className="object-cover"
                    />
                    {variant.isFeatured && (
                      <Badge className="absolute top-2 left-2 bg-yellow-500 text-white">
                        Рекомендуем
                      </Badge>
                    )}
                    {variant.isNew && (
                      <Badge className="absolute top-2 right-2 bg-blue-500 text-white">
                        Новинка
                      </Badge>
                    )}
                  </div>
                )}

                {/* Информация */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-800">
                    {variant.sizeName}
                    {variant.sizeValue && (
                      <span className="text-sm text-slate-500 ml-1">({variant.sizeValue})</span>
                    )}
                  </h4>

                  {variant.name && (
                    <p className="text-sm text-slate-600 line-clamp-2">{variant.name}</p>
                  )}

                  {variant.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{variant.description}</p>
                  )}

                  {/* Ключевые характеристики */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {variant.warranty && (
                      <Badge variant="outline" className="text-xs">
                        Гарантия: {variant.warranty}
                      </Badge>
                    )}
                    {variant.sku && (
                      <Badge variant="outline" className="text-xs">
                        {variant.sku}
                      </Badge>
                    )}
                  </div>

                  {/* Цена */}
                  <div className="flex items-center justify-between">
                    <div>
                      {variant.discountPrice ? (
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-cyan-700">
                            {variant.discountPrice.toLocaleString('ru-RU')} ₽
                          </span>
                          <span className="text-sm line-through text-slate-400">
                            {variant.price?.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      ) : variant.price ? (
                        <span className="text-lg font-bold text-slate-800">
                          {variant.price.toLocaleString('ru-RU')} ₽
                        </span>
                      ) : (
                        <Badge variant="secondary">По запросу</Badge>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewDetails(variant)
                      }}
                      title="Подробнее"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Наличие */}
                  <div className="flex items-center justify-between text-sm">
                    {variant.isAvailable ? (
                      <span className="text-green-600">В наличии</span>
                    ) : (
                      <span className="text-red-600">Нет в наличии</span>
                    )}
                    
                    {variant.stockQuantity !== null && variant.stockQuantity !== undefined && variant.stockQuantity <= 5 && (
                      <Badge variant="warning" className="text-xs">
                        Осталось: {variant.stockQuantity}
                      </Badge>
                    )}
                  </div>

                  {/* Кнопка выбора */}
                  {selectedVariant?.id === variant.id ? (
                    <Button className="w-full" size="sm" disabled>
                      Выбран
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onVariantSelect(variant)
                      }}
                    >
                      Выбрать
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Диалог с подробной информацией */}
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