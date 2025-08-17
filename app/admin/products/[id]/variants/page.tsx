"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  Copy,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProductVariantForm } from '@/components/admin/product-variant-form'

interface Product {
  id: number
  name: string
  article_number?: string
  sku?: string
  [key: string]: any
}

interface ProductVariant {
  id: number
  master_id: number
  name: string
  slug: string
  sku?: string
  /** Артикул */
  articleNumber?: string
  description?: string
  short_description?: string
  price?: number
  discount_price?: number
  cost_price?: number
  stock_quantity: number
  reserved_quantity: number
  available_stock: number
  in_stock: boolean
  weight?: number
  length?: number
  width?: number
  height?: number
  primary_image_url?: string
  images?: any[]
  attributes: any
  warranty_months?: number
  battery_life_hours?: number
  is_featured: boolean
  is_new: boolean
  is_bestseller: boolean
  is_recommended: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  custom_fields?: any
  characteristics?: any[]
  stock_status?: string
  show_price?: boolean
}

interface Product {
  id: number
  name: string
  sku?: string
  category_name?: string
  manufacturer_name?: string
}

// Преобразуем данные из формата API в формат для ProductVariantForm
const transformVariantToFormData = (variant: ProductVariant): any => {
  console.log('transformVariantToFormData input:', {
    id: variant.id,
    show_price: variant.show_price,
    show_price_type: typeof variant.show_price
  })
  // Extract attribute values properly
  const extractAttributeValue = (attr: any): string => {
    if (typeof attr === 'string') return attr;
    if (typeof attr === 'object' && attr !== null) {
      if ('value_name' in attr) return attr.value_name;
      if ('name' in attr) return attr.name;
    }
    return '';
  };

  // Обработка атрибутов в зависимости от их формата
  let attributes = variant.attributes;
  let attributesObj: any = {};
  
  if (Array.isArray(attributes)) {
    // Если атрибуты - массив, преобразуем в объект для совместимости
    attributes.forEach((attr: any) => {
      if (attr.group_name && attr.value_name) {
        const key = attr.group_name.toLowerCase().replace(/\s+/g, '_');
        attributesObj[key] = attr.value_name;
      }
    });
  } else if (typeof attributes === 'object' && attributes !== null) {
    attributesObj = attributes;
  }

  const result = {
    id: variant.id,
    productId: variant.master_id,
    sizeName: extractAttributeValue(attributesObj?.size) || variant.name,
    sizeValue: attributesObj?.size_value || '',
    name: variant.name,
    description: variant.description,
    sku: variant.sku,
    articleNumber: attributesObj?.article_number || '',
    price: variant.price,
    discountPrice: variant.discount_price,
    stockQuantity: variant.stock_quantity,
    weight: variant.weight,
    dimensions: attributesObj?.dimensions,
    specifications: attributesObj?.specifications,
    isAvailable: variant.is_active,
    sortOrder: variant.sort_order,
    imageUrl: variant.primary_image_url,
    images: Array.isArray(variant.images) ? variant.images : [],
    warranty: variant.warranty_months ? `${variant.warranty_months}` : '',
    batteryLife: variant.battery_life_hours ? `${variant.battery_life_hours}` : '',
    stock_status: variant.stock_status || 'out_of_stock',
    show_price: variant.show_price !== undefined ? variant.show_price : true,
    metaTitle: variant.meta_title,
    metaDescription: variant.meta_description,
    metaKeywords: variant.meta_keywords,
    isFeatured: variant.is_featured,
    isNew: variant.is_new,
    isBestseller: variant.is_bestseller,
    customFields: variant.custom_fields,
    characteristics: variant.characteristics || [],
    selectionTables: attributesObj?.selection_tables || [],
    configurableCharacteristics: variant.custom_fields?.configurableCharacteristics || []
  }
  
  console.log('transformVariantToFormData output:', {
    id: result.id,
    show_price: result.show_price,
    show_price_type: typeof result.show_price
  })
  
  return result
}

// Преобразуем данные из формата формы в формат для API
const transformFormDataToVariant = (formData: any): any => {
  console.log('🔄 transformFormDataToVariant - входные данные изображений:', {
    rawImages: formData.images,
    type: typeof formData.images,
    isArray: Array.isArray(formData.images),
    length: formData.images?.length
  })

  // Убеждаемся, что images всегда массив
  let images = formData.images || []
  
  // Детальная обработка различных типов данных для images
  if (images === null || images === undefined) {
    console.log('📷 Images is null/undefined, setting to empty array')
    images = []
  } else if (typeof images === 'string') {
    if (images.trim() === '') {
      console.log('📷 Images is empty string, setting to empty array')
      images = []
    } else {
      try {
        console.log('📷 Parsing images string:', images)
        images = JSON.parse(images)
      } catch (e) {
        console.warn('⚠️ Failed to parse images string:', images, e)
        images = []
      }
    }
  }
  
  if (!Array.isArray(images)) {
    console.warn('⚠️ Images is not an array, converting:', images, typeof images)
    images = []
  }
  
  console.log('📷 Images before filtering:', images)
  
  // Фильтруем изображения, оставляя только валидные строки
  const originalLength = images.length
  images = images.filter((img: any) => {
    if (typeof img !== 'string') {
      console.warn('⚠️ Non-string image found:', img, typeof img)
      return false
    }
    if (img.trim() === '') {
      console.warn('⚠️ Empty image string found')
      return false
    }
    // Проверяем, что это похоже на URL
    if (!img.startsWith('http') && !img.startsWith('/') && !img.startsWith('data:')) {
      console.warn('⚠️ Invalid image URL format:', img)
      return false
    }
    return true
  })
  
  console.log('📷 Images after filtering:', {
    original: originalLength,
    filtered: images.length,
    images: images
  })

  // Определяем имя варианта - используем name, если есть, иначе sizeName
  const variantName = formData.name?.trim() || formData.sizeName?.trim() || ''
  
  const result: any = {
    name: variantName,
    sku: formData.sku,
    article_number: formData.articleNumber,
    description: formData.description,
    price: formData.price,
    discount_price: formData.discountPrice,
    stock_quantity: formData.stockQuantity || 0,
    weight: formData.weight,
    primary_image_url: formData.imageUrl,
    images: images, // Используем обработанный массив images
    attributes: {
      size: formData.sizeName,
      size_value: formData.sizeValue,
      dimensions: formData.dimensions,
      specifications: formData.specifications,
      article_number: formData.articleNumber,
      selection_tables: formData.selectionTables
    },
    meta_title: formData.metaTitle,
    meta_description: formData.metaDescription,
    meta_keywords: formData.metaKeywords,
    is_featured: formData.isFeatured || false,
    is_new: formData.isNew || false,
    is_bestseller: formData.isBestseller || false,
    is_active: formData.isAvailable !== false,
    show_price: formData.show_price !== undefined ? formData.show_price : true,
    warranty_months: formData.warranty ? parseInt(formData.warranty) : null,
    battery_life_hours: formData.batteryLife ? parseInt(formData.batteryLife) : null,
    custom_fields: formData.customFields || {},
    sort_order: formData.sortOrder || 0
  }
  
  // Добавляем конфигурируемые характеристики в custom_fields
  if (formData.configurableCharacteristics && formData.configurableCharacteristics.length > 0) {
    result.custom_fields = {
      ...result.custom_fields,
      configurableCharacteristics: formData.configurableCharacteristics
    }
  }
  
  // Добавляем master_id только для создания нового варианта
  if (!formData.id) {
    result.master_id = formData.productId
  }
  
  // Дополнительная валидация и логирование
  console.log('transformFormDataToVariant result:', {
    originalName: formData.name,
    originalSizeName: formData.sizeName,
    finalName: result.name,
    nameLength: result.name ? result.name.length : 0,
    originalImages: formData.images,
    processedImages: result.images,
    imagesType: typeof result.images,
    imagesLength: Array.isArray(result.images) ? result.images.length : 'not an array',
    hasRequiredFields: !!(result.name && result.name.trim()),
    show_price_input: formData.show_price,
    show_price_output: result.show_price,
    show_price_type: typeof result.show_price
  })
  
  return result
}

export default function ProductVariantsPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params?.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<any | undefined>(undefined)

  const fetchProduct = useCallback(async () => {
      try {
        const response = await fetch(`/api/products/${productId}`)
        const data = await response.json()
        if (data.success) {
          setProduct(data.data)
        }
      } catch (error) {
        console.error('Error fetching product:', error)
        toast.error('Не удалось загрузить информацию о товаре')
      }
    }, [productId])

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  const fetchVariants = useCallback(async () => {
      try {
        setLoading(true)
        const url = `/api/v2/product-variants?master_id=${productId}&include_images=true&include_characteristics=true&only_active=false`
        console.log('🔍 VARIANTS PAGE - Запрос:', url)
        
        const response = await fetch(url)
        const data = await response.json()
        
        console.log('📊 VARIANTS PAGE - Ответ:', {
          success: data.success,
          totalCount: data.data?.length || 0,
          variants: data.data?.map((v: any) => ({
            id: v.id,
            name: v.name,
            is_active: v.is_active,
            master_id: v.master_id
          }))
        })
        
        if (data.success) {
          console.log('📊 VARIANTS PAGE - Загруженные варианты с show_price:', data.data.map((v: any) => ({
            id: v.id,
            name: v.name,
            show_price: v.show_price,
            show_price_type: typeof v.show_price
          })))
          setVariants(data.data)
        }
      } catch (error) {
        console.error('Error fetching variants:', error)
        toast.error('Не удалось загрузить варианты')
      } finally {
        setLoading(false)
      }
    }, [productId])

  useEffect(() => {
    fetchVariants()
  }, [fetchVariants])

  const handleSaveVariant = async (formData: any) => {
    try {
      console.log('💾 handleSaveVariant начинает работу с данными:', {
        variantId: formData.id,
        hasImages: !!formData.images,
        imagesCount: formData.images?.length || 0,
        images: formData.images
      })

      const url = formData.id 
        ? `/api/v2/product-variants/${formData.id}`
        : '/api/v2/product-variants'
      
      const _method = formData.id ? 'PUT' : 'POST'
      const payload = transformFormDataToVariant(formData)

      console.log('💾 Финальный payload для API:', {
        url,
        method: _method,
        images: payload.images,
        imagesCount: payload.images?.length || 0,
        hasImages: !!payload.images?.length
      })

      // Debug logging
      console.log('Saving variant:', {
        url,
        method: _method,
        formData,
        transformedPayload: payload,
        imagesField: payload.images,
        imagesType: typeof payload.images,
        imagesIsArray: Array.isArray(payload.images),
        imagesLength: Array.isArray(payload.images) ? payload.images.length : 'not array',
        originalImages: formData.images,
        originalImagesType: typeof formData.images
      })
      
      // Дополнительная проверка перед отправкой
      if (payload.images && !Array.isArray(payload.images)) {
        console.error('Images field is not an array before sending:', payload.images)
        payload.images = []
      }
      
      // Проверяем, что все JSONB поля можно сериализовать
      const jsonbFields = ['images', 'videos', 'documents', 'attributes', 'custom_fields']
      for (const field of jsonbFields) {
        if (payload[field] !== undefined) {
          try {
            const serialized = JSON.stringify(payload[field])
            JSON.parse(serialized) // Проверяем, что можно десериализовать
          } catch (e) {
            console.error(`Invalid JSON in field ${field}:`, payload[field], e.message)
            // Исправляем проблемное поле
            if (['images', 'videos', 'documents'].includes(field)) {
              payload[field] = []
            } else {
              payload[field] = {}
            }
          }
        }
      }

      const response = await fetch(url, {
        method: _method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('API Error:', {
          status: response.status,
          data: data,
          payload: payload,
          url: url,
          // Дополнительная детальная информация
          errorDetails: {
            error: data.error,
            details: data.details,
            errorCode: data.errorCode,
            success: data.success
          },
          payloadDetails: {
            images: payload.images,
            imagesType: typeof payload.images,
            imagesLength: Array.isArray(payload.images) ? payload.images.length : 'not array',
            name: payload.name,
            hasRequiredFields: !!(payload.name || payload.sku)
          }
        })
        
        // Более детальное сообщение об ошибке
        let errorMessage = `Ошибка ${response.status}`
        if (data.error) {
          errorMessage += `: ${data.error}`
        }
        if (data.details) {
          errorMessage += ` (${data.details})`
        }
        if (data.errorCode) {
          errorMessage += ` [${data.errorCode}]`
        }
        
        toast.error(errorMessage)
        return
      }

      if (data.success) {
        // Получаем ID варианта (для новых вариантов он будет в data.data.id)
        const variantId = formData.id || data.data.id
        
        // Сохраняем характеристики, если они есть
        if (formData.characteristics && formData.characteristics.length > 0 && variantId) {
          try {
            // Используем новый API для характеристик вариантов
            const charResponse = await fetch(`/api/product-variants/${variantId}/characteristics-simple`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                characteristics: formData.characteristics
              })
            })
            
            if (!charResponse.ok) {
              const charError = await charResponse.json()
              console.error('Ошибка сохранения характеристик:', charError)
              toast.error('Вариант сохранен, но характеристики не удалось сохранить')
            } else {
              const charResult = await charResponse.json()
              console.log('Характеристики успешно сохранены:', charResult)
            }
          } catch (charError) {
            console.error('Error saving characteristics:', charError)
            toast.error('Вариант сохранен, но произошла ошибка при сохранении характеристик')
          }
        }
        
        toast.success(formData.id ? 'Вариант обновлен' : 'Вариант создан')
        setIsFormOpen(false)
        setEditingVariant(undefined)
        fetchVariants()
      } else {
        toast.error(data.error || 'Произошла ошибка')
      }
    } catch (error) {
      console.error('Error saving variant:', error)
      if (error instanceof Error) {
        toast.error(`Ошибка: ${error.message}`)
      } else {
        toast.error('Не удалось сохранить вариант')
      }
    }
  }

  const handleEdit = async (variant: ProductVariant) => {
    const formData = transformVariantToFormData(variant)
    
    // Загружаем характеристики варианта
    try {
      const charResponse = await fetch(`/api/product-variants/${variant.id}/characteristics-simple`)
      if (charResponse.ok) {
        const charData = await charResponse.json()
        if (charData.success && charData.data) {
          formData.characteristics = charData.data.characteristics || []
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки характеристик варианта:', error)
    }
    
    setEditingVariant(formData)
    setIsFormOpen(true)
  }

  const handleDelete = async (variantId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот вариант?')) {
      return
    }

    try {
      const response = await fetch(`/api/v2/product-variants/${variantId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Вариант удален')
        fetchVariants()
      } else {
        toast.error(data.error || 'Не удалось удалить вариант')
      }
    } catch (error) {
      console.error('Error deleting variant:', error)
      toast.error('Произошла ошибка при удалении')
    }
  }

  const handleDuplicate = (variant: ProductVariant) => {
    const formData = transformVariantToFormData(variant)
    // Удаляем ID и модифицируем данные для дубликата
    delete formData.id
    formData.sizeName = `${formData.sizeName} (копия)`
    formData.name = `${formData.name} (копия)`
    if (formData.sku) {
      formData.sku = `${formData.sku}-copy`
    }
    formData.sortOrder = (formData.sortOrder || 0) + 1
    formData.isFeatured = false
    formData.isNew = false
    formData.isBestseller = false
    
    setEditingVariant(formData)
    setIsFormOpen(true)
  }

  const toggleVariantStatus = async (variantId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/v2/product-variants/${variantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(isActive ? 'Вариант деактивирован' : 'Вариант активирован')
        fetchVariants()
      }
    } catch (error) {
      console.error('Error toggling variant status:', error)
      toast.error('Не удалось изменить статус')
    }
  }

  const handleOpenForm = () => {
    setEditingVariant(undefined)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setEditingVariant(undefined)
    setIsFormOpen(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Заголовок */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Управление вариантами товара</h1>
            {product && (
              <div className="mt-2">
                <p className="text-lg font-medium text-gray-700">{product.name}</p>
                {product.article_number && <p className="text-sm text-gray-500">Артикул: {product.article_number}</p>}
                {product.sku && <p className="text-sm text-gray-500">SKU: {product.sku}</p>}
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => window.open(`/products/${productId}`, '_blank')}
              className="border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <Eye className="w-4 h-4 mr-2" />
              Посмотреть на сайте
            </Button>
            <Button onClick={handleOpenForm}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить вариант
            </Button>
          </div>
        </div>
      </div>

      {/* Таблица вариантов */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold">Название варианта</TableHead>
              <TableHead className="font-semibold">Атрибуты (размер, цвет)</TableHead>
              <TableHead className="font-semibold">Цена</TableHead>
              <TableHead className="font-semibold">Наличие на складе</TableHead>
              <TableHead className="font-semibold">Статусы</TableHead>
              <TableHead className="font-semibold">Активность</TableHead>
              <TableHead className="text-right font-semibold">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center">
                    <Package className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-lg font-medium text-gray-600 mb-2">Варианты товара не созданы</p>
                                          <p className="text-sm text-gray-500">
                        Нажмите &quot;Добавить вариант&quot; чтобы создать первый вариант товара
                      </p>
</div>
                </TableCell>
              </TableRow>
            ) : (
              variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{variant.name}</p>
                      {variant.sku && (
                        <p className="text-sm text-gray-500">SKU: {variant.sku}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {variant.characteristics && Array.isArray(variant.characteristics) && variant.characteristics.length > 0 ? (
                        (() => {
                          // Группируем характеристики по group_name
                          const grouped = variant.characteristics.reduce((acc: any, char: any) => {
                            const groupName = char.group_name || 'Другое';
                            if (!acc[groupName]) acc[groupName] = [];
                            acc[groupName].push(char);
                            return acc;
                          }, {});
                          
                          return Object.entries(grouped).map(([groupName, chars]) => (
                            <div key={groupName} className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs font-medium text-gray-600">{groupName}:</span>
                              {(chars as any[]).map((char: any, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {char.value_name || char.value || '-'}
                                  {char.additional_value && (
                                    <span className="text-gray-500 ml-1">({char.additional_value})</span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          ));
                        })()
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {variant.discount_price ? (
                      <div>
                        <p className="font-medium text-green-600">
                          {variant.discount_price.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-sm line-through text-gray-400">
                          {variant.price?.toLocaleString('ru-RU')} ₽
                        </p>
                      </div>
                    ) : variant.price ? (
                      <p className="font-medium">
                        {variant.price.toLocaleString('ru-RU')} ₽
                      </p>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className={cn(
                        "w-4 h-4",
                        variant.in_stock ? "text-green-600" : "text-red-600"
                      )} />
                      <span className={cn(
                        "text-sm",
                        variant.in_stock ? "text-green-600" : "text-red-600"
                      )}>
                        {variant.available_stock} шт.
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {variant.is_recommended && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                          Рекомендуем
                        </Badge>
                      )}
                      {variant.is_featured && (
                        <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                          Избранное
                        </Badge>
                      )}
                      {variant.is_new && (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          Новинка
                        </Badge>
                      )}
                      {variant.is_bestseller && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">
                          Хит
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVariantStatus(variant.id, variant.is_active)}
                      className="p-0"
                    >
                      {variant.is_active ? (
                        <Eye className="w-5 h-5 text-green-600" />
                      ) : (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(variant)}
                        title="Дублировать"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(variant)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(variant.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Форма для создания/редактирования варианта */}
      <ProductVariantForm
        variant={editingVariant}
        productId={productId}
        productName={product?.name}
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveVariant}
      />
    </div>
  )
}