"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { ProductImageUploader } from '@/components/admin/product-image-uploader'
import { CompactCharacteristics } from '@/components/admin/compact-characteristics'
import { VariantTagsSelector } from '@/components/admin/variant-tags-selector'
import { VariantWarehouseStockManager } from '@/components/admin/variant-warehouse-stock-manager'

interface ProductVariant {
  id?: number
  productId: number
  sizeName: string
  sizeValue?: string
  name?: string
  description?: string
  /**
   * Vendor code / Артикул – may differ from internal SKU.
   */
  articleNumber?: string
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
  stock_status?: string
  show_price?: boolean
  configurableCharacteristics?: any[] // Добавляем поле для конфигурируемых характеристик
}

interface ProductVariantFormProps {
  variant?: ProductVariant
  productId: string | number
  productName?: string
  isOpen: boolean
  onClose: () => void
  onSave: (variant: ProductVariant) => void
}

export function ProductVariantForm({
  variant,
  productId,
  productName,
  isOpen,
  onClose,
  onSave
}: ProductVariantFormProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<ProductVariant>({
    productId: Number(productId),
    sizeName: '',
    sizeValue: '',
    name: '',
    description: '',
    articleNumber: '',
    sku: '',
    price: undefined,
    discountPrice: undefined,
    stockQuantity: 0,
    weight: undefined,
    isAvailable: true,
    sortOrder: 0,
    imageUrl: '',
    images: [],
    warranty: '',
    batteryLife: '',
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    isFeatured: false,
    isNew: false,
    isBestseller: false,
    characteristics: [],
    selectionTables: [],
    stock_status: 'out_of_stock',
    show_price: true,
    configurableCharacteristics: [] // Инициализируем пустым массивом
  })
  
  const [activeTab, setActiveTab] = useState('basic')

  const handleTabChange = (value: string) => {
    // Если пользователь уходит с основной вкладки, а обязательные поля пусты – предупреждаем
    if (value !== 'basic' && !formData.sku?.trim() && !formData.articleNumber?.trim()) {
      toast({
        title: 'Обязательные поля не заполнены',
        description: 'Заполните SKU или Артикул – без них вариант не сохранится.',
        variant: 'destructive'
      })
      // Продолжаем переключение вкладки, просто предупреждаем пользователя
    }
    setActiveTab(value)
  }
  const [saving, setSaving] = useState(false)
  const [_attemptedSave, setAttemptedSave] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Функция валидации формы
  const validateForm = () => {
    const errors: Record<string, string> = {}

    // Обязательные поля
    if (!formData.sizeName?.trim()) {
      errors.sizeName = 'Название варианта обязательно'
    }

    // Требуется либо SKU либо Артикул
    if (!formData.sku?.trim() && !formData.articleNumber?.trim()) {
      errors.sku = 'Укажите SKU или Артикул товара'
      errors.articleNumber = 'Укажите SKU или Артикул товара'
    }

    // Валидация цены
    if (formData.price && (isNaN(Number(formData.price)) || Number(formData.price) < 0)) {
      errors.price = 'Цена должна быть положительным числом'
    }

    // Валидация цены со скидкой
    if (formData.discountPrice && (isNaN(Number(formData.discountPrice)) || Number(formData.discountPrice) < 0)) {
      errors.discountPrice = 'Цена со скидкой должна быть положительным числом'
    }

    // Проверка что цена со скидкой не больше основной цены
    if (formData.price && formData.discountPrice && Number(formData.discountPrice) >= Number(formData.price)) {
      errors.discountPrice = 'Цена со скидкой должна быть меньше основной цены'
    }

    // Валидация количества на складе
    if (formData.stockQuantity && (isNaN(Number(formData.stockQuantity)) || Number(formData.stockQuantity) < 0)) {
      errors.stockQuantity = 'Количество должно быть положительным числом'
    }

    // Валидация веса
    if (formData.weight && (isNaN(Number(formData.weight)) || Number(formData.weight) < 0)) {
      errors.weight = 'Вес должен быть положительным числом'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  useEffect(() => {
    if (variant) {
      setAttemptedSave(false)
      console.log('ProductVariantForm - Loading variant:', {
        variantId: variant.id,
        variantImages: variant.images,
        variantImagesLength: variant.images?.length || 0,
        variantImagesType: typeof variant.images,
        variantImagesIsArray: Array.isArray(variant.images)
      })
      // Убеждаемся, что images всегда массив
      const safeVariant = {
        ...variant,
        images: Array.isArray(variant.images) ? variant.images : [],
        stock_status: variant.stock_status || 'out_of_stock',
        show_price: variant.show_price !== undefined ? variant.show_price : true,
        configurableCharacteristics: variant.customFields?.configurableCharacteristics || []
      }
      setFormData(safeVariant)
    } else {
      setAttemptedSave(false)
      console.log('ProductVariantForm - Creating new variant', {
        productId,
        initialImages: []
      })
      setFormData({
        productId: Number(productId),
        sizeName: '',
        sizeValue: '',
        name: '',
        description: '',
        articleNumber: '',
        sku: '',
        price: undefined,
        discountPrice: undefined,
        stockQuantity: 0,
        weight: undefined,
        isAvailable: true,
        sortOrder: 0,
        imageUrl: '',
        images: [],
        warranty: '',
        batteryLife: '',
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
        isFeatured: false,
        isNew: false,
        isBestseller: false,
        characteristics: [],
        selectionTables: [],
        stock_status: 'out_of_stock',
        show_price: true,
        configurableCharacteristics: []
      })
    }
  }, [variant, productId])

  const handleSubmit = async () => {
    setAttemptedSave(true)
    
    // Валидация формы
    if (!validateForm()) {
      // Находим первую ошибку и показываем уведомление
      const firstError = Object.values(validationErrors)[0]
      if (firstError) {
        toast({
          title: "Ошибка валидации",
          description: firstError,
          variant: "destructive"
        })
      }
      return
    }
    
    // Убеждаемся, что поле name заполнено
    const finalFormData = { ...formData }
    if (!finalFormData.name?.trim()) {
      finalFormData.name = productName ? `${productName} - ${formData.sizeName}` : formData.sizeName
    }
    
    // Добавляем конфигурируемые характеристики в customFields
    if (finalFormData.configurableCharacteristics && finalFormData.configurableCharacteristics.length > 0) {
      finalFormData.customFields = {
        ...finalFormData.customFields,
        configurableCharacteristics: finalFormData.configurableCharacteristics
      }
    }

    console.log('ProductVariantForm - handleSubmit:', {
      variantId: finalFormData.id,
      sizeName: finalFormData.sizeName,
      name: finalFormData.name,
      hasName: !!finalFormData.name?.trim(),
      images: finalFormData.images,
      imagesLength: Array.isArray(finalFormData.images) ? finalFormData.images.length : 'not array',
      show_price: finalFormData.show_price,
      show_price_type: typeof finalFormData.show_price
    })

    setSaving(true)
    try {
      await onSave(finalFormData)
      onClose()
    } catch (error) {
      console.error('Error saving variant:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateField = useCallback((field: keyof ProductVariant, value: any) => {
    if (field === 'show_price') {
      console.log('ProductVariantForm - updateField show_price:', {
        field,
        newValue: value,
        valueType: typeof value
      })
    }
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      
      // Автоматически заполняем поле name на основе sizeName и productName
      if (field === 'sizeName' && value && !updated.name) {
        updated.name = productName ? `${productName} - ${value}` : value
      }
      
      return updated
    })
    
    // Очищаем ошибки для этого поля при изменении
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        
        // Очищаем также связанные ошибки для SKU/артикул
        if (field === 'sku' || field === 'articleNumber') {
          delete newErrors.sku
          delete newErrors.articleNumber
        }
        
        return newErrors
      })
    }
  }, [productName, validationErrors])

  const handleWarehouseStockTotalChange = useCallback((total: number) => {
    updateField('stockQuantity', total)
  }, [updateField])

  const handleImagesChange = (images: string[]) => {
    console.log('📷 ProductVariantForm - handleImagesChange:', {
      oldImages: formData.images,
      oldImagesCount: formData.images?.length || 0,
      newImages: images,
      newImagesCount: images?.length || 0,
      variantId: formData.id,
      imageUrlWillChange: images.length > 0 && images[0] !== formData.imageUrl
    })
    
    setFormData(prev => {
      const updated = {
        ...prev,
        images: images,
        imageUrl: images.length > 0 ? images[0] : prev.imageUrl
      }
      
      console.log('📷 FormData updated with new images:', {
        variantId: updated.id,
        imagesCount: updated.images?.length || 0,
        primaryImage: updated.imageUrl
      })
      
      return updated
    })
  }

  const handleCharacteristicsChange = (_characteristics: any[]) => {
    setFormData(prev => ({ ...prev, characteristics: _characteristics }))
  }
  
  const handleConfigurableCharacteristicsChange = (_configurableCharacteristics: any[]) => {
    setFormData(prev => ({ ...prev, configurableCharacteristics: _configurableCharacteristics }))
  }

    return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby="variant-form-description">
        <DialogHeader>
          <DialogTitle>
            {variant ? 'Редактировать вариант' : 'Новый вариант'}
            {productName && ` для "${productName}"`}
          </DialogTitle>
        </DialogHeader>
        <div id="variant-form-description" className="sr-only">
          {variant ? 'Форма редактирования варианта товара' : 'Форма создания нового варианта товара'}
        </div>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="basic">Основное</TabsTrigger>
              <TabsTrigger value="pricing">Цены</TabsTrigger>
              <TabsTrigger value="warehouse">Склады</TabsTrigger>
              <TabsTrigger value="images">Изображения</TabsTrigger>
              <TabsTrigger value="characteristics">Характеристики</TabsTrigger>
              <TabsTrigger value="configuration">Конфигурация</TabsTrigger>
              <TabsTrigger value="tags">Теги</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="basic" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Основная информация</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sizeName">Название варианта *</Label>
                        <Input
                          id="sizeName"
                          value={formData.sizeName}
                          onChange={(e) => updateField('sizeName', e.target.value)}
                          placeholder="Например: Размер L, Синий, Базовая комплектация"
                          className={validationErrors.sizeName ? 'border-red-500' : ''}
                        />
                        {validationErrors.sizeName && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.sizeName}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="sizeValue">Значение варианта</Label>
                        <Input
                          id="sizeValue"
                          value={formData.sizeValue || ''}
                          onChange={(e) => updateField('sizeValue', e.target.value)}
                          placeholder="Например: 42-44, RGB(0,0,255)"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="name">Полное название</Label>
                      <Input
                        id="name"
                        value={formData.name || ''}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="Полное название варианта товара"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Описание</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        placeholder="Подробное описание варианта"
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="articleNumber">Артикул</Label>
                        <Input
                          id="articleNumber"
                          value={formData.articleNumber || ''}
                          onChange={(e) => updateField('articleNumber', e.target.value)}
                          placeholder="Код производителя / Артикул"
                          className={validationErrors.articleNumber ? 'border-red-500' : ''}
                        />
                        {validationErrors.articleNumber && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.articleNumber}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Достаточно заполнить либо Артикул, либо SKU
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="sku">SKU</Label>
                        <Input
                          id="sku"
                          value={formData.sku || ''}
                          onChange={(e) => updateField('sku', e.target.value)}
                          placeholder="Уникальный SKU варианта"
                          className={validationErrors.sku ? 'border-red-500' : ''}
                        />
                        {validationErrors.sku && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.sku}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Достаточно заполнить либо SKU, либо Артикул
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="warranty">Гарантия</Label>
                        <Input
                          id="warranty"
                          value={formData.warranty || ''}
                          onChange={(e) => updateField('warranty', e.target.value)}
                          placeholder="Например: 12 месяцев"
                        />
                      </div>
                      <div>
                        <Label htmlFor="batteryLife">Время работы от батареи</Label>
                        <Input
                          id="batteryLife"
                          value={formData.batteryLife || ''}
                          onChange={(e) => updateField('batteryLife', e.target.value)}
                          placeholder="Например: 8 часов"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="isAvailable">Доступен для заказа</Label>
                        <Switch
                          id="isAvailable"
                          checked={formData.isAvailable}
                          onCheckedChange={(checked) => updateField('isAvailable', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="isFeatured">Рекомендуемый</Label>
                        <Switch
                          id="isFeatured"
                          checked={formData.isFeatured || false}
                          onCheckedChange={(checked) => updateField('isFeatured', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="isNew">Новинка</Label>
                        <Switch
                          id="isNew"
                          checked={formData.isNew || false}
                          onCheckedChange={(checked) => updateField('isNew', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="isBestseller">Хит продаж</Label>
                        <Switch
                          id="isBestseller"
                          checked={formData.isBestseller || false}
                          onCheckedChange={(checked) => updateField('isBestseller', checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Цены и складские остатки</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sortOrder">Порядок сортировки</Label>
                        <Input
                          id="sortOrder"
                          type="number"
                          value={formData.sortOrder || 0}
                          onChange={(e) => updateField('sortOrder', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="price">Цена</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price || ''}
                          onChange={(e) => updateField('price', e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="0.00"
                          className={validationErrors.price ? 'border-red-500' : ''}
                        />
                        {validationErrors.price && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.price}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="discountPrice">Цена со скидкой</Label>
                        <Input
                          id="discountPrice"
                          type="number"
                          step="0.01"
                          value={formData.discountPrice || ''}
                          onChange={(e) => updateField('discountPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="0.00"
                          className={validationErrors.discountPrice ? 'border-red-500' : ''}
                        />
                        {validationErrors.discountPrice && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.discountPrice}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="stockQuantity">Количество на складе</Label>
                        <Input
                          id="stockQuantity"
                          type="number"
                          value={formData.stockQuantity || 0}
                          onChange={(e) => updateField('stockQuantity', parseInt(e.target.value) || 0)}
                          className={validationErrors.stockQuantity ? 'border-red-500' : ''}
                        />
                        {validationErrors.stockQuantity && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.stockQuantity}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="weight">Вес (кг)</Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.001"
                          value={formData.weight || ''}
                          onChange={(e) => updateField('weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className={validationErrors.weight ? 'border-red-500' : ''}
                          placeholder="0.000"
                        />
                        {validationErrors.weight && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.weight}</p>
                        )}
                      </div>
                    </div>

                    {/* Новый блок: Статус склада */}
                    <div className="mt-4">
                      <Label htmlFor="stock_status">Статус склада</Label>
                      <Select
                        value={formData.stock_status || 'out_of_stock'}
                        onValueChange={(value) => updateField('stock_status', value)}
                      >
                        <SelectTrigger className="w-full h-10">
                          <SelectValue placeholder="Выберите статус склада" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_stock">В наличии</SelectItem>
                          <SelectItem value="nearby_warehouse">Ближний склад</SelectItem>
                          <SelectItem value="distant_warehouse">Дальний склад</SelectItem>
                          <SelectItem value="on_order">Под заказ</SelectItem>
                          <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Новый переключатель: скрыть цену */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="hidePrice">Не показывать цену на сайте</Label>
                          <p className="text-sm text-gray-500">
                            Если включено, вместо цены будет показано &quot;По запросу&quot;
                          </p>
                        </div>
                        <Switch
                          id="hidePrice"
                          checked={formData.show_price === false}
                          onCheckedChange={(checked) => updateField('show_price', !checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="warehouse">
                <VariantWarehouseStockManager
                  variantId={variant?.id}
                  variantName={formData.name}
                  onTotalChange={handleWarehouseStockTotalChange}
                  disabled={saving}
                />
              </TabsContent>

              <TabsContent value="images">
                <Card>
                  <CardHeader>
                    <CardTitle>Изображения варианта</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProductImageUploader
                      productId={formData.id ? formData.id.toString() : `new-variant-${productId}`}
                      productImages={Array.isArray(formData.images) ? formData.images : []}
                      onImagesChange={handleImagesChange}
                      maxImages={20}
                      isVariant={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="characteristics">
                <CompactCharacteristics
                  productId={formData.id ? formData.id : undefined}
                  onSave={handleCharacteristicsChange}
                  readonly={false}
                  initialCharacteristics={formData.characteristics || []}
                  isActive={activeTab === 'characteristics'}
                />
              </TabsContent>

              <TabsContent value="configuration">
                <Card>
                  <CardHeader>
                    <CardTitle>Конфигурируемые характеристики</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Выберите характеристики, которые клиент сможет настроить при заказе товара
                    </p>
                  </CardHeader>
                  <CardContent>
                    <CompactCharacteristics
                      productId={formData.id}
                      onSave={handleConfigurableCharacteristicsChange}
                      readonly={false}
                      initialCharacteristics={formData.configurableCharacteristics || []}
                      isActive={activeTab === 'configuration'}
                      mode="configurable"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="seo" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>SEO настройки</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="metaTitle">Meta заголовок</Label>
                      <Input
                        id="metaTitle"
                        value={formData.metaTitle || ''}
                        onChange={(e) => updateField('metaTitle', e.target.value)}
                        placeholder="SEO заголовок страницы"
                      />
                    </div>
                    <div>
                      <Label htmlFor="metaDescription">Meta описание</Label>
                      <Textarea
                        id="metaDescription"
                        value={formData.metaDescription || ''}
                        onChange={(e) => updateField('metaDescription', e.target.value)}
                        placeholder="SEO описание страницы"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="metaKeywords">Ключевые слова</Label>
                      <Input
                        id="metaKeywords"
                        value={formData.metaKeywords || ''}
                        onChange={(e) => updateField('metaKeywords', e.target.value)}
                        placeholder="Ключевые слова через запятую"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Теги варианта */}
              <TabsContent value="tags" className="space-y-4">
                {formData.id ? (
                  <VariantTagsSelector
                    variantId={formData.id}
                    className="w-full"
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8">
                      <p className="text-center text-slate-500">
                        Сохраните вариант, чтобы добавить теги
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {variant ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}