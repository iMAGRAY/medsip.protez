"use client"

import React from 'react'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SearchableCategorySelect } from '@/components/ui/searchable-category-select'
import type {
  ProductFormData,
  ProductValidationErrors,
  ProductCategory,
  ProductManufacturer,
  ProductModelLine
} from '@/lib/types/product-form'

interface ProductCategorySectionProps {
  formData: ProductFormData
  validationErrors: ProductValidationErrors
  onChange: (data: Partial<ProductFormData>) => void
  categories: ProductCategory[]
  manufacturers: ProductManufacturer[]
  modelLines: ProductModelLine[]
  loading: boolean
}

export function ProductCategorySection({
  formData,
  validationErrors,
  onChange,
  categories,
  manufacturers,
  modelLines,
  loading
}: ProductCategorySectionProps) {
  // Фильтрация линеек моделей по выбранному производителю
  const filteredModelLines = modelLines.filter(
    line => formData.manufacturer_id ? line.manufacturer_id === formData.manufacturer_id : true
  )

  // Преобразование данных для SearchableSelect
  const manufacturerOptions = manufacturers.map(m => ({
    value: m.id.toString(),
    label: m.name
  }))

  const modelLineOptions = filteredModelLines.map(ml => ({
    value: ml.id.toString(),
    label: ml.name
  }))

  const handleManufacturerChange = (manufacturerId: string) => {
    const id = manufacturerId === 'none' ? null : parseInt(manufacturerId)
    onChange({
      manufacturer_id: id,
      model_line_id: null // Сбрасываем линейку при смене производителя
    })
  }

  const handleModelLineChange = (modelLineId: string) => {
    const id = modelLineId === 'none' ? null : parseInt(modelLineId)
    onChange({ model_line_id: id })
  }

  const handleCategoryChange = (categoryId: string) => {
    const id = categoryId === 'none' ? null : parseInt(categoryId)
    onChange({ category_id: id })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Категория */}
      <div>
        <Label htmlFor="category" className="text-sm font-medium">
          Категория *
        </Label>
        <SearchableCategorySelect
          categories={categories}
          value={formData.category_id?.toString() || 'none'}
          onValueChange={handleCategoryChange}
          placeholder="Выберите категорию"
          className={`h-10 sm:h-9 ${validationErrors.category ? 'border-red-500' : ''}`}
          includeNoneOption={true}
          noneOptionText="Не выбрана"
          noneValue="none"
        />
        {validationErrors.category && (
          <p className="text-sm text-red-600 mt-1">Категория обязательна для выбора</p>
        )}
      </div>

      {/* Производитель */}
      <div>
        <Label htmlFor="manufacturer" className="text-sm font-medium">
          Производитель
        </Label>
        <SearchableSelect
          options={manufacturerOptions}
          value={formData.manufacturer_id?.toString() || 'none'}
          onValueChange={handleManufacturerChange}
          placeholder="Выберите производителя"
          className={`h-10 sm:h-9 ${validationErrors.manufacturer ? 'border-red-500' : ''}`}
          includeNoneOption={true}
          noneOptionText="Не выбран"
          noneValue="none"
        />
        {validationErrors.manufacturer && (
          <p className="text-sm text-red-600 mt-1">Производитель обязателен для выбора</p>
        )}
      </div>

      {/* Линейка модели */}
      <div>
        <Label htmlFor="model_line" className="text-sm font-medium">
          Линейка модели
        </Label>
        <SearchableSelect
          options={modelLineOptions}
          value={formData.model_line_id?.toString() || 'none'}
          onValueChange={handleModelLineChange}
          disabled={!formData.manufacturer_id}
          placeholder={
              formData.manufacturer_id
                ? "Выберите линейку модели"
                : "Сначала выберите производителя"
          }
          className={`h-10 sm:h-9 ${validationErrors.model_line ? 'border-red-500' : ''}`}
          includeNoneOption={true}
          noneOptionText="Не выбрана"
          noneValue="none"
        />
        {validationErrors.model_line && (
          <p className="text-sm text-red-600 mt-1">Линейка модели обязательна для выбора</p>
        )}
      </div>
    </div>
  )
}