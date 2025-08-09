'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save, X } from 'lucide-react'
import { ProductImageUploader } from '@/components/admin/product-image-uploader'
import { CompactCharacteristics } from '@/components/admin/compact-characteristics'
import { SelectionTablesEditor } from '@/components/admin/selection-tables-editor'
import { ProductVariantsManager } from '@/components/admin/product-variants-manager'
import { ProductTagsSelector } from '@/components/admin/product-tags-selector'
import { WarehouseStockManager } from '@/components/admin/warehouse-stock-manager'
import { toast } from 'sonner'

// Компоненты секций формы
import { ProductBasicInfoSection } from '@/components/admin/product-basic-info-section'
import { ProductCategorySection } from '@/components/admin/product-category-section'
import { ProductPricingSection } from '@/components/admin/product-pricing-section'

// Рефакторированный хук
import { useProductForm } from '@/hooks/use-product-form'

export interface ProductFormData {
  id?: string
  name: string
  short_name?: string
  description: string
  category_id: number | null
  manufacturer_id: number | null
  model_line_id: number | null
  sku: string
  article_number: string
  price: number | null
  discount_price: number | null
  show_price: boolean
  images: string[]
  in_stock: boolean
  stock_quantity: number
  stock_status: string
}

interface ProductFormModernProps {
  product?: any
  onSave?: (product: any) => void
  onCancel?: () => void
}

export function ProductFormModern({ product, onSave, onCancel }: ProductFormModernProps) {
  const { toast: toastHook } = useToast()
  const [activeTab, setActiveTab] = useState('basic')

  // Обработчик смены вкладок с валидацией
  const handleTabChange = (value: string) => {
    // Если пользователь уходит с основной вкладки, а обязательные поля пусты – предупреждаем
    if (activeTab === 'basic' && value !== 'basic' && !formData.sku?.trim() && !formData.article_number?.trim()) {
      toast.error('Заполните SKU или Артикул – без них товар не сохранится', {
        description: 'Обязательные поля',
        duration: 4000,
      })
      // Продолжаем переключение вкладки, просто предупреждаем пользователя
    }
    setActiveTab(value)
  }

  // Использование рефакторированного хука вместо всех состояний
  const {
    state,
    actions,
    data,
    operations,
    utils
  } = useProductForm(product)

  const {
    formData,
    validationErrors,
    isLoading,
    isSaving,
    isDirty,
    productImages,
    productCharacteristics,
    newProductSelectionTables,
    existingProductSelectionTables
  } = state

  const {
    handleSubmit: originalHandleSubmit,
    handleImagesChange,
    handleCharacteristicsChange,
    handleConfigurableCharacteristicsChange,
    handleNewProductSelectionTablesChange,
    handleExistingProductSelectionTablesChange
  } = operations

  // Обработчик отправки формы с вызовом onSave
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    try {
      // Вызываем оригинальный handleSubmit из хука
      await originalHandleSubmit(e)

      // Показываем дополнительное уведомление через useToast для совместимости
      toastHook({
        title: "✅ Успешно",
        description: formData.id ? "Товар обновлен" : "Товар создан",
      })

    } catch (error) {
      console.error('Error in form submit:', error)
      toastHook({
        title: "❌ Ошибка",
        description: "Не удалось сохранить товар",
        variant: "destructive",
      })
    }
  }

  const { categories, manufacturers, modelLines, loading: dataLoading } = data

  // Обработчик отмены
  const handleCancel = () => {
    if (isDirty) {
      if (confirm('У вас есть несохраненные изменения. Вы уверены, что хотите выйти?')) {
        actions.resetForm()
        onCancel?.()
      }
    } else {
      onCancel?.()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg">Загрузка данных товара...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Заголовок с кнопками - адаптивный */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold truncate">
              {formData.id ? 'Редактирование товара' : 'Новый товар'}
            </h1>

          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="h-9 sm:h-10 px-3 sm:px-4"
            >
              <X className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{formData.id ? 'Назад' : 'Отмена'}</span>
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !isDirty}
              className="h-9 sm:h-10 px-3 sm:px-4"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Сохранить</span>
            </Button>
          </div>
        </div>

      </div>

      {/* Основной контент - с табами */}
      <div className="flex-1 overflow-hidden">
        <form onSubmit={handleSubmit} className="h-full">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
            <div className="flex-shrink-0 border-b bg-background px-3 sm:px-6">
              <TabsList className="grid w-full grid-cols-7 max-w-full sm:max-w-4xl">
                <TabsTrigger value="basic" className="text-xs sm:text-sm">Основное</TabsTrigger>
                <TabsTrigger value="specs" className="text-xs sm:text-sm">Характеристики</TabsTrigger>
                <TabsTrigger value="config" className="text-xs sm:text-sm">Конфигурация</TabsTrigger>
                <TabsTrigger value="variants" className="text-xs sm:text-sm">Варианты</TabsTrigger>
                <TabsTrigger value="warehouse" className="text-xs sm:text-sm">Склады</TabsTrigger>
                <TabsTrigger value="tables" className="text-xs sm:text-sm">Таблицы</TabsTrigger>
                <TabsTrigger value="tags" className="text-xs sm:text-sm">Теги</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="container max-w-7xl mx-auto p-3 sm:p-6">
                {/* Все вкладки рендерятся одновременно для сохранения состояния */}

                {/* Основная информация */}
                <TabsContent value="basic" className="mt-0 space-y-4 sm:space-y-6">
                  {/* Сетка с основными блоками */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Левая колонка */}
                    <div className="space-y-4 sm:space-y-6">
                      <Card>
                        <CardHeader className="pb-3 sm:pb-6">
                          <CardTitle className="text-base sm:text-lg">Основная информация</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ProductBasicInfoSection
                            formData={formData}
                            validationErrors={validationErrors}
                            onChange={actions.setFormData}
                          />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Правая колонка */}
                    <div className="space-y-4 sm:space-y-6">
                      <Card>
                        <CardHeader className="pb-3 sm:pb-6">
                          <CardTitle className="text-base sm:text-lg">Категория и производитель</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ProductCategorySection
                            formData={formData}
                            validationErrors={validationErrors}
                            categories={categories}
                            manufacturers={manufacturers}
                            modelLines={modelLines}
                            loading={dataLoading}
                            onChange={actions.setFormData}
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3 sm:pb-6">
                          <CardTitle className="text-base sm:text-lg">Цены и отображение</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ProductPricingSection
                            formData={formData}
                            validationErrors={validationErrors}
                            onChange={actions.setFormData}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Изображения товара - полная ширина */}
                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="text-base sm:text-lg">Изображения товара</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ProductImageUploader
                        productId={formData.id}
                        productImages={productImages}
                        onImagesChange={handleImagesChange}
                        maxImages={8}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Характеристики */}
                <TabsContent value="specs" className="mt-0">
                  <CompactCharacteristics
                    productId={formData.id ? parseInt(formData.id.toString()) : (product?.id ? parseInt(product.id.toString()) : undefined)}
                    onSave={handleCharacteristicsChange}
                    readonly={false}
                    initialCharacteristics={productCharacteristics}
                    isActive={activeTab === 'specs'}
                  />
                </TabsContent>

                {/* Конфигурация товара */}
                <TabsContent value="config" className="mt-0">
                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="text-base sm:text-lg">Конфигурируемые характеристики</CardTitle>
                      <p className="text-sm text-gray-500 mt-2">
                        Выберите характеристики, которые покупатель сможет настроить при заказе товара
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CompactCharacteristics
                        productId={formData.id ? parseInt(formData.id.toString()) : (product?.id ? parseInt(product.id.toString()) : undefined)}
                        onSave={handleConfigurableCharacteristicsChange}
                        readonly={false}
                        initialCharacteristics={formData.custom_fields?.configurableCharacteristics || []}
                        isActive={activeTab === 'config'}
                        mode="configurable"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Варианты товара */}
                <TabsContent value="variants" className="mt-0">
                  {formData.id ? (
                    <ProductVariantsManager
                      productId={formData.id}
                      productName={formData.name}
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-8">
                        <p className="text-center text-slate-500">
                          Сохраните товар, чтобы добавить варианты
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Таблицы подбора */}
                <TabsContent value="tables" className="mt-0">
                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="text-base sm:text-lg">Таблицы подбора товаров</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <SelectionTablesEditor
                        productId={formData.id ? parseInt(formData.id) : undefined}
                        productSku={formData.sku}
                        productName={formData.name}
                        isNewProduct={!formData.id}
                        onNewProductChange={handleNewProductSelectionTablesChange}
                        onExistingProductChange={handleExistingProductSelectionTablesChange}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Склады */}
                <TabsContent value="warehouse" className="mt-0">
                  <WarehouseStockManager
                    productId={formData.id}
                    productName={formData.name}
                    onTotalChange={(total) => actions.setFormData({ stock_quantity: total as number })}
                    disabled={isSaving}
                  />
                </TabsContent>

                {/* Теги товара */}
                <TabsContent value="tags" className="mt-0">
                  {formData.id ? (
                    <ProductTagsSelector
                      productId={formData.id}
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-8">
                        <p className="text-center text-slate-500">
                          Сохраните товар, чтобы добавить теги
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </form>
      </div>

    </div>
  )
}