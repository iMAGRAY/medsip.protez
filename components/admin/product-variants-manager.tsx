import { SafeImage } from "@/components/safe-image"
"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, Edit2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { ProductVariantForm } from './product-variant-form'

interface ProductVariant {
  id?: number
  productId: number
  sizeName: string
  sizeValue?: string
  name?: string
  description?: string
  sku?: string
  /** Артикул (vendor code) */
  articleNumber?: string
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
  stock_status?: string
  show_price?: boolean
}

interface ProductVariantsManagerProps {
  productId: string | number
  productName?: string
}

export function ProductVariantsManager({ productId, productName }: ProductVariantsManagerProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | undefined>(undefined)

  useEffect(() => {
    fetchVariants()
  }, [productId])

  const fetchVariants = async () => {
    try {
      setLoading(true)
      const url = `/api/v2/product-variants?master_id=${productId}&include_images=true&include_characteristics=true&only_active=false`
      console.log('🔍 VARIANTS MANAGER - Запрос:', url)
      
      const response = await fetch(url)
      const data = await response.json()
      
      console.log('📊 VARIANTS MANAGER - Ответ:', {
        success: data.success,
        totalCount: data.data?.length || 0,
        rawVariants: data.data?.map((v: any) => ({
          id: v.id,
          name: v.name,
          is_active: v.is_active,
          master_id: v.master_id
        }))
      })
      
      if (data.success && data.data) {
        // Преобразуем данные из нового формата в старый для совместимости
        const transformedVariants = data.data.map((v: any) => {
          // Извлекаем размер из характеристик
          let sizeName = v.name;
          let sizeValue = '';
          
          // Ищем характеристику "Размер" в массиве характеристик
          const characteristics = v.attributes?.characteristics || v.characteristics || [];
          console.log(`🔍 Variant ${v.id} characteristics:`, {
            fromAttributes: v.attributes?.characteristics,
            fromDirect: v.characteristics,
            final: characteristics
          });
          const sizeChar = characteristics.find((char: any) => 
            char.template_name === 'Размер' || 
            char.name === 'Размер' ||
            char.group_name === 'Размер'
          );
          
          if (sizeChar) {
            sizeName = sizeChar.text_value || sizeChar.enum_value_name || sizeChar.value || sizeName;
            sizeValue = sizeChar.additional_value || '';
          }
          
          // Если размер не найден в характеристиках, пробуем старый способ
          if (!sizeChar && v.attributes?.size) {
            sizeName = v.attributes.size;
            sizeValue = v.attributes.size_value || '';
          }
          
          return {
            id: v.id,
            productId: v.master_id,
            sizeName: sizeName,
            sizeValue: sizeValue,
            name: v.name,
            description: v.description,
            sku: v.sku,
            articleNumber: (v.attributes?.article_number) || '',
            price: v.price,
            discountPrice: v.discount_price,
            stockQuantity: v.stock_quantity,
            weight: v.weight,
            dimensions: v.attributes?.dimensions,
            specifications: v.attributes?.specifications,
            isAvailable: v.is_active,
            sortOrder: v.sort_order,
            imageUrl: v.primary_image_url,
            images: v.images || [],
            warranty: v.warranty_months ? `${v.warranty_months} мес.` : null,
            batteryLife: v.battery_life_hours ? `${v.battery_life_hours} ч.` : null,
            metaTitle: v.meta_title,
            metaDescription: v.meta_description,
            metaKeywords: v.meta_keywords,
            isFeatured: v.is_featured,
            isNew: v.is_new,
            isBestseller: v.is_bestseller,
            customFields: v.custom_fields,
            characteristics: characteristics,
            selectionTables: v.attributes?.selection_tables || [],
            stock_status: v.stock_status,
            show_price: v.show_price
          }
        })
        
        console.log('🔄 VARIANTS MANAGER - После трансформации:', {
          transformedCount: transformedVariants.length,
          transformedVariants: transformedVariants.map((v: ProductVariant) => ({
            id: v.id,
            sizeName: v.sizeName,
            name: v.name,
            isAvailable: v.isAvailable
          }))
        })
        
        setVariants(transformedVariants)
      }
    } catch (error) {
      console.error('Error fetching variants:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить варианты товара",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenForm = (variant?: ProductVariant) => {
    console.log('Opening variant form:', {
      variant,
      variantImages: variant?.images,
      isNewVariant: !variant,
      productId
    })
    setEditingVariant(variant)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setEditingVariant(undefined)
    setIsFormOpen(false)
  }

  const handleSaveVariant = async (variant: ProductVariant) => {
    try {
      const url = variant.id 
        ? `/api/v2/product-variants/${variant.id}`
        : '/api/v2/product-variants'
      
      const _method = variant.id ? 'PUT' : 'POST'
      
      // Преобразуем данные в формат для новой таблицы
      const variantData: any = {
        name: variant.name || variant.sizeName,
        sku: variant.sku,
        article_number: variant.articleNumber,
        description: variant.description,
        price: variant.price,
        discount_price: variant.discountPrice,
        stock_quantity: variant.stockQuantity || 0,
        stock_status: variant.stock_status || 'out_of_stock',
        show_price: variant.show_price !== undefined ? variant.show_price : true,
        weight: variant.weight,
        primary_image_url: variant.imageUrl,
        images: variant.images || [],
        attributes: {
          size: variant.sizeName,
          size_value: variant.sizeValue,
          dimensions: variant.dimensions,
          specifications: variant.specifications,
          article_number: variant.articleNumber,
          selection_tables: variant.selectionTables,
          characteristics: variant.characteristics || []
        },
        meta_title: variant.metaTitle,
        meta_description: variant.metaDescription,
        meta_keywords: variant.metaKeywords,
        is_featured: variant.isFeatured || false,
        is_new: variant.isNew || false,
        is_bestseller: variant.isBestseller || false,
        is_active: variant.isAvailable !== false,
        warranty_months: variant.warranty ? parseInt(variant.warranty) : null,
        battery_life_hours: variant.batteryLife ? parseInt(variant.batteryLife) : null,
        custom_fields: variant.customFields || {},
        sort_order: variant.sortOrder || 0
      }
      
      // Добавляем master_id только для создания нового варианта
      if (!variant.id) {
        variantData.master_id = productId
      }

      // Детальное логирование перед отправкой
      console.log('Sending variant data:', {
        url,
        method,
        variantId: variant.id,
        images: variantData.images,
        imagesType: typeof variantData.images,
        imagesIsArray: Array.isArray(variantData.images),
        fullData: variantData
      })

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variantData)
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Успешно",
          description: variant.id ? "Вариант товара обновлен" : "Вариант товара создан"
        })
        handleCloseForm()
        fetchVariants()
      } else {
        console.error('API Error:', {
          status: response.status,
          data: data,
          variantData: variantData,
          url: url
        })
        throw new Error(data.error || data.details || `HTTP ${response.status}: Failed to save variant`)
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить вариант",
        variant: "destructive"
      })
    }
  }

  const handleDeleteVariant = async (variantId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот вариант?')) {
      return
    }

    try {
      const response = await fetch(`/api/v2/product-variants/${variantId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Успешно",
          description: "Вариант товара удален"
        })
        fetchVariants()
      } else {
        throw new Error('Failed to delete variant')
      }
    } catch (_error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить вариант",
        variant: "destructive"
      })
    }
  }



  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Варианты товара {productName && `"${productName}"`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* Кнопка добавления нового варианта */}
        <Button onClick={() => handleOpenForm()} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Добавить вариант
        </Button>

        {/* Список существующих вариантов */}
        <div className="space-y-2">
          {variants.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              У этого товара пока нет вариантов
            </p>
          ) : (
            variants.map((variant) => (
              <div key={variant.id} className="border rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-lg">{variant.sizeName}</h4>
                      {variant.sizeValue && (
                        <span className="text-sm text-slate-500">({variant.sizeValue})</span>
                      )}
                      {variant.isFeatured && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                          Рекомендуемый
                        </span>
                      )}
                      {variant.isNew && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Новинка
                        </span>
                      )}
                      {variant.isBestseller && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          Хит
                        </span>
                      )}
                      {!variant.isAvailable && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          Недоступен
                        </span>
                      )}
                    </div>
                    
                    {variant.name && (
                      <p className="text-sm font-medium text-slate-700">{variant.name}</p>
                    )}
                    
                    {variant.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">{variant.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      {variant.sku && <span>SKU: <strong>{variant.sku}</strong></span>}
                      {variant.articleNumber && <span>Артикул: <strong>{variant.articleNumber}</strong></span>}
                      {variant.price && (
                        <span>
                          Цена: {variant.discountPrice ? (
                            <>
                              <span className="line-through text-slate-400">
                                {variant.price.toLocaleString('ru-RU')} ₽
                              </span>
                              {' '}
                              <span className="font-medium text-green-600">
                                {variant.discountPrice.toLocaleString('ru-RU')} ₽
                              </span>
                            </>
                          ) : (
                            <strong>{variant.price.toLocaleString('ru-RU')} ₽</strong>
                          )}
                        </span>
                      )}
                      {variant.stockQuantity !== null && variant.stockQuantity !== undefined && (
                        <span>На складе: <strong>{variant.stockQuantity}</strong></span>
                      )}
                      {variant.weight && (
                        <span>Вес: <strong>{variant.weight} кг</strong></span>
                      )}
                    </div>
                    
                    {variant.images && variant.images.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {variant.images.slice(0, 4).map((image, index) => (
                          <SafeImage key={index} src={image} alt={`${variant.sizeName} ${index + 1}`} width={48} height={48} className="w-12 h-12 object-cover rounded border" />
                        ))}
                        {variant.images.length > 4 && (
                          <div className="w-12 h-12 bg-slate-100 rounded border flex items-center justify-center text-xs text-slate-600">
                            +{variant.images.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Отображаем характеристики варианта */}
                    {variant.characteristics && variant.characteristics.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium text-slate-700 mb-2">Характеристики:</p>
                        <div className="flex flex-wrap gap-2">
                          {variant.characteristics.map((char: any, index: number) => {
                            const name = char.group_name || char.template_name || char.name || 'Характеристика';
                            const value = char.value_name || char.text_value || char.enum_value_name || char.value || '-';
                            const additional = char.additional_value;
                            
                            return (
                              <div key={index} className="text-xs bg-slate-100 rounded px-2 py-1">
                                <span className="font-medium">{name}:</span>
                                {' '}
                                <span>{value}</span>
                                {additional && <span className="text-gray-500"> ({additional})</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenForm(variant)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteVariant(variant.id!)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>

    {/* Форма для создания/редактирования варианта */}
    <ProductVariantForm
      variant={editingVariant}
      productId={productId}
      productName={productName}
      isOpen={isFormOpen}
      onClose={handleCloseForm}
      onSave={handleSaveVariant}
    />
    </>
  )
}