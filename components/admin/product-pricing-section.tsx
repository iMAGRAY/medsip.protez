"use client"

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ProductFormData, ProductValidationErrors } from '@/lib/types/product-form'

interface ProductPricingSectionProps {
  formData: ProductFormData
  validationErrors: ProductValidationErrors
  onChange: (data: Partial<ProductFormData>) => void
}

export function ProductPricingSection({
  formData,
  validationErrors,
  onChange
}: ProductPricingSectionProps) {
  const handlePriceChange = (value: string, field: 'price' | 'discount_price') => {
    if (value === '') {
      onChange({ [field]: null })
      return
    }

    const numericValue = parseFloat(value)

    // Проверяем максимальное значение
    if (numericValue > 99999999.99) {
      // Обрезаем до максимального значения
      onChange({ [field]: 99999999.99 })
      return
    }

    onChange({ [field]: numericValue })
  }

  const _handleShowPriceChange = (checked: boolean) => {

    onChange({ show_price: checked })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Цены - всегда доступны для редактирования */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Основная цена */}
        <div>
          <Label htmlFor="price" className="text-sm font-medium">
            Цена
          </Label>
          <Input
            id="price"
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            value={formData.price || ''}
            onChange={(e) => handlePriceChange(e.target.value, 'price')}
            className={`h-10 sm:h-9 ${validationErrors.price ? 'border-red-500' : ''}`}
            placeholder="0.00"
          />
          {validationErrors.price && (
            <p className="text-sm text-red-600 mt-1">Укажите корректную цену</p>
          )}
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Максимум: 99,999,999.99 ₽
          </p>
        </div>

        {/* Цена со скидкой */}
        <div>
          <Label htmlFor="discount_price" className="text-sm font-medium">
            Цена со скидкой
          </Label>
          <Input
            id="discount_price"
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            value={formData.discount_price || ''}
            onChange={(e) => handlePriceChange(e.target.value, 'discount_price')}
            className="h-10 sm:h-9"
            placeholder="0.00"
          />
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Оставьте пустым, если скидки нет
          </p>
        </div>
      </div>

      {/* Наличие товара */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-3 sm:gap-0">
        <div className="space-y-0.5 flex-1">
          <Label className="text-sm font-medium">Товар в наличии</Label>
          <p className="text-xs sm:text-sm text-gray-500">
            Контролирует доступность товара для заказа на сайте
          </p>
        </div>
        <Switch
          checked={formData.in_stock}
          onCheckedChange={(checked) => onChange({ in_stock: checked })}
          className="self-start sm:self-center"
        />
      </div>

      {/* Отображение цены на сайте */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-3 sm:gap-0">
        <div className="space-y-0.5 flex-1">
          <Label className="text-sm font-medium">Не показывать цену на сайте</Label>
          <p className="text-xs sm:text-sm text-gray-500">
            Если включено, вместо цены будет показано &quot;По запросу&quot;
          </p>
        </div>
        <Switch
          checked={!formData.show_price}
          onCheckedChange={(checked) => onChange({ show_price: !checked })}
          className="self-start sm:self-center"
        />
      </div>

      {/* Информация о скидке */}
      {formData.price && formData.discount_price && formData.discount_price < formData.price && (
        <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-800">
              Размер скидки:
            </span>
            <span className="text-sm font-bold text-green-800">
              {Math.round(((formData.price - formData.discount_price) / formData.price) * 100)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-600">
              Экономия:
            </span>
            <span className="text-sm text-green-600">
              {(formData.price - formData.discount_price).toFixed(2)} ₽
            </span>
          </div>
        </div>
      )}
    </div>
  )
}