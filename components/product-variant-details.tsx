"use client"

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Info, Package, FileText, Image as ImageIcon } from 'lucide-react'
import { SafeImage } from '@/components/safe-image'

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

interface ProductVariantDetailsProps {
  variant: ProductVariant | null
  isOpen: boolean
  onClose: () => void
  productName?: string
}

export function ProductVariantDetails({
  variant,
  isOpen,
  onClose,
  productName: _productName
}: ProductVariantDetailsProps) {
  if (!variant) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby="variant-details-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{variant.name && variant.name.includes(' - ') ? variant.name : variant.sizeName}</span>
            {variant.sizeValue && (
              <span className="text-sm text-slate-500">({variant.sizeValue})</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div id="variant-details-description" className="sr-only">
          Подробная информация о варианте товара {variant.sizeName}
        </div>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">Основное</TabsTrigger>
              <TabsTrigger value="pricing">Цены и наличие</TabsTrigger>
              <TabsTrigger value="images">Изображения</TabsTrigger>
              <TabsTrigger value="specs">Характеристики</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {/* Основная информация */}
              <TabsContent value="general" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      Основная информация
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Статусы */}
                    <div className="flex gap-2 flex-wrap">
                      {variant.isFeatured && (
                        <Badge className="bg-yellow-100 text-yellow-700">
                          Рекомендуемый
                        </Badge>
                      )}
                      {variant.isNew && (
                        <Badge className="bg-blue-100 text-blue-700">
                          Новинка
                        </Badge>
                      )}
                      {variant.isBestseller && (
                        <Badge className="bg-green-100 text-green-700">
                          Хит продаж
                        </Badge>
                      )}
                      {!variant.isAvailable && (
                        <Badge variant="destructive">
                          Недоступен
                        </Badge>
                      )}
                    </div>

                    {variant.name && (
                      <div>
                        <h3 className="font-medium text-sm text-slate-600 mb-1">Полное название</h3>
                        <p className="text-slate-800">{variant.name}</p>
                      </div>
                    )}

                    {variant.description && (
                      <div>
                        <h3 className="font-medium text-sm text-slate-600 mb-1">Описание</h3>
                        <p className="text-slate-700 whitespace-pre-wrap">{variant.description}</p>
                      </div>
                    )}

                    {variant.sku && (
                      <div>
                        <h3 className="font-medium text-sm text-slate-600 mb-1">Артикул</h3>
                        <p className="font-mono text-slate-800">{variant.sku}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {variant.warranty && (
                        <div>
                          <h3 className="font-medium text-sm text-slate-600 mb-1">Гарантия</h3>
                          <p className="text-slate-800">{variant.warranty}</p>
                        </div>
                      )}
                      {variant.batteryLife && (
                        <div>
                          <h3 className="font-medium text-sm text-slate-600 mb-1">Время работы от батареи</h3>
                          <p className="text-slate-800">{variant.batteryLife}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Цены и наличие */}
              <TabsContent value="pricing" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Цены и складские остатки
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <h3 className="font-medium text-sm text-slate-600 mb-2">Цена</h3>
                        {variant.price ? (
                          <p className="text-2xl font-bold text-slate-800">
                            {variant.price.toLocaleString('ru-RU')} ₽
                          </p>
                        ) : (
                          <p className="text-lg text-slate-500">По запросу</p>
                        )}
                      </div>

                      {variant.discountPrice && (
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h3 className="font-medium text-sm text-green-700 mb-2">Цена со скидкой</h3>
                          <p className="text-2xl font-bold text-green-700">
                            {variant.discountPrice.toLocaleString('ru-RU')} ₽
                          </p>
                          {variant.price && (
                            <p className="text-sm text-green-600 mt-1">
                              Скидка: {Math.round((1 - variant.discountPrice / variant.price) * 100)}%
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-medium text-sm text-slate-600 mb-1">Количество на складе</h3>
                        <p className="text-lg font-semibold">
                          {variant.stockQuantity !== null && variant.stockQuantity !== undefined
                            ? variant.stockQuantity
                            : 'Не указано'}
                        </p>
                      </div>
                      {variant.weight && (
                        <div>
                          <h3 className="font-medium text-sm text-slate-600 mb-1">Вес</h3>
                          <p className="text-lg font-semibold">{variant.weight} кг</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Изображения */}
              <TabsContent value="images">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" />
                      Изображения варианта
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {variant.images && variant.images.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {variant.images.map((image, index) => (
                          <div key={index} className="relative aspect-square">
                            <SafeImage
                              src={image}
                              alt={`${variant.sizeName} - изображение ${index + 1}`}
                              fill
                              className="object-cover rounded-lg"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 py-8">
                        Изображения не загружены
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Характеристики */}
              <TabsContent value="specs">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Характеристики варианта
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {variant.characteristics && variant.characteristics.length > 0 ? (
                      <div className="space-y-3">
                        {variant.characteristics.map((char: any, index: number) => (
                          <div key={index} className="flex justify-between py-2 border-b last:border-0">
                            <span className="text-sm text-slate-600">{char.name || char.spec_name}</span>
                            <span className="text-sm font-medium text-slate-800">{char.value || char.spec_value}</span>
                          </div>
                        ))}
                      </div>
                    ) : variant.specifications ? (
                      <div className="space-y-3">
                        {Object.entries(variant.specifications).map(([key, value]) => (
                          <div key={key} className="flex justify-between py-2 border-b last:border-0">
                            <span className="text-sm text-slate-600">{key}</span>
                            <span className="text-sm font-medium text-slate-800">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 py-8">
                        Характеристики не указаны
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}