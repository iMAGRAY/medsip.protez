"use client"

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ProductFormData, ProductValidationErrors } from '@/lib/types/product-form'

interface ProductBasicInfoSectionProps {
  formData: ProductFormData
  validationErrors: ProductValidationErrors
  onChange: (data: Partial<ProductFormData>) => void
}

export function ProductBasicInfoSection({
  formData,
  validationErrors,
  onChange
}: ProductBasicInfoSectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
      {/* Краткое название */}
      <div className="sm:col-span-2">
        <Label htmlFor="short_name" className="text-sm font-medium">
          Краткое название (для карточек)
        </Label>
        <Input
          id="short_name"
          value={formData.short_name || ''}
          onChange={(e) => onChange({ short_name: e.target.value })}
          className={`h-10 sm:h-9`}
          placeholder="Введите краткое название для отображения в карточках"
        />
        <p className="text-sm text-gray-500 mt-1">
          Используется в карточках товаров на главной странице и в каталоге. Если не заполнено, будет использоваться полное название.
        </p>
      </div>

      {/* Полное название */}
      <div className="sm:col-span-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Полное название товара *
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={`h-10 sm:h-9 ${validationErrors.name ? 'border-red-500' : ''}`}
          placeholder="Введите полное название товара"
        />
        {validationErrors.name && (
          <p className="text-sm text-red-600 mt-1">Название обязательно для заполнения</p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Используется на странице товара
        </p>
      </div>

      {/* Артикул и SKU */}
      <div>
        <Label htmlFor="sku" className="text-sm font-medium">
          SKU
        </Label>
        <Input
          id="sku"
          value={formData.sku}
          onChange={(e) => onChange({ sku: e.target.value })}
          className={`h-10 sm:h-9 ${validationErrors.sku ? 'border-red-500' : ''}`}
          placeholder="Введите SKU"
        />
        {validationErrors.sku && (
          <p className="text-sm text-red-600 mt-1">Укажите SKU или Артикул товара</p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Уникальный код товара. Достаточно заполнить либо SKU, либо Артикул.
        </p>
      </div>

      <div>
        <Label htmlFor="article_number" className="text-sm font-medium">
          Артикул
        </Label>
        <Input
          id="article_number"
          value={formData.article_number}
          onChange={(e) => onChange({ article_number: e.target.value })}
          className={`h-10 sm:h-9 ${validationErrors.article_number ? 'border-red-500' : ''}`}
          placeholder="Введите артикул"
        />
        {validationErrors.article_number && (
          <p className="text-sm text-red-600 mt-1">Укажите SKU или Артикул товара</p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Код производителя. Достаточно заполнить либо SKU, либо Артикул.
        </p>
      </div>

      {/* Гарантия */}
      <div>
        <Label htmlFor="warranty" className="text-sm font-medium">
          Гарантия
        </Label>
        <Input
          id="warranty"
          value={formData.warranty || ''}
          onChange={(e) => onChange({ warranty: e.target.value })}
          className="h-10 sm:h-9"
          placeholder="Например: 2 года, 12 месяцев"
        />
      </div>

      {/* Вес и время работы от батареи */}
      <div>
        <Label htmlFor="weight" className="text-sm font-medium">
          Вес (кг)
        </Label>
        <Input
          id="weight"
          type="number"
          step="0.001"
          value={formData.weight ?? ''}
          onChange={(e) => onChange({ weight: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="h-10 sm:h-9"
          placeholder="0.000"
        />
      </div>

      <div>
        <Label htmlFor="batteryLife" className="text-sm font-medium">
          Время работы от батареи
        </Label>
        <Input
          id="batteryLife"
          value={formData.batteryLife || ''}
          onChange={(e) => onChange({ batteryLife: e.target.value })}
          className="h-10 sm:h-9"
          placeholder="Например: 8 ч."
        />
      </div>
       
      {/* Описание */}
      <div className="sm:col-span-2">
        <Label htmlFor="description" className="text-sm font-medium">
          Описание *
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={`min-h-[100px] sm:min-h-[80px] ${validationErrors.description ? 'border-red-500' : ''}`}
          placeholder="Введите описание товара"
          rows={4}
        />
        {validationErrors.description && (
          <p className="text-sm text-red-600 mt-1">Описание обязательно для заполнения</p>
        )}
      </div>
    </div>
  )
}