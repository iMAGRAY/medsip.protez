import { useState, useEffect } from 'react'
import { toast } from 'sonner'

export interface FormCategory {
  id: number
  name: string
  description?: string
  parent_id?: number
  type: string
  level: number
  full_path: string
  display_name: string
  is_root: boolean
}

export interface FormManufacturer {
  id: number
  name: string
  description?: string
  website?: string
  country?: string
  logo_url?: string
  model_lines_count: number
  is_active: boolean
}

export interface FormModelLine {
  id: number
  name: string
  description?: string
  manufacturer_id: number
  manufacturer_name: string
  category_name: string
  launch_year?: number
  products_count: number
  is_active: boolean
}

export function useProductFormData() {
  const [categories, setCategories] = useState<FormCategory[]>([])
  const [manufacturers, setManufacturers] = useState<FormManufacturer[]>([])
  const [modelLines, setModelLines] = useState<FormModelLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Загрузка категорий
  const loadCategories = async () => {
    try {

      const response = await fetch('/api/categories-flat')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load categories')
      }

      setCategories(data.data)
      return data.data
    } catch (err) {
      console.error('❌ Error loading categories:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load categories'
      setError(errorMessage)
      toast.error(`Ошибка загрузки категорий: ${errorMessage}`)
      return []
    }
  }

  // Загрузка производителей
  const loadManufacturers = async () => {
    try {

      const response = await fetch('/api/manufacturers')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load manufacturers')
      }

      setManufacturers(data.data)
      return data.data
    } catch (err) {
      console.error('❌ Error loading manufacturers:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load manufacturers'
      setError(errorMessage)
      toast.error(`Ошибка загрузки производителей: ${errorMessage}`)
      return []
    }
  }

  // Загрузка модельных рядов
  const loadModelLines = async () => {
    try {

      const response = await fetch('/api/model-lines')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load model lines')
      }

      setModelLines(data.data)
      return data.data
    } catch (err) {
      console.error('❌ Error loading model lines:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load model lines'
      setError(errorMessage)
      toast.error(`Ошибка загрузки модельных рядов: ${errorMessage}`)
      return []
    }
  }

  // Загрузка всех данных при монтировании
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true)
      setError(null)

      try {
        await Promise.all([
          loadCategories(),
          loadManufacturers(),
          loadModelLines()
        ])
      } catch (err) {
        console.error('❌ Error loading form data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAllData()
  }, [])

  // Получение модельных рядов по производителю
  const getModelLinesByManufacturer = (manufacturerId: number) => {
    return modelLines.filter(ml => ml.manufacturer_id === manufacturerId)
  }

  // Получение категории по ID
  const getCategoryById = (categoryId: number) => {
    return categories.find(cat => cat.id === categoryId)
  }

  // Получение производителя по ID
  const getManufacturerById = (manufacturerId: number) => {
    return manufacturers.find(man => man.id === manufacturerId)
  }

  // Получение модельного ряда по ID
  const getModelLineById = (modelLineId: number) => {
    return modelLines.find(ml => ml.id === modelLineId)
  }

  return {
    // Данные
    categories,
    manufacturers,
    modelLines,

    // Состояние
    loading,
    error,

    // Методы загрузки
    loadCategories,
    loadManufacturers,
    loadModelLines,

    // Вспомогательные методы
    getModelLinesByManufacturer,
    getCategoryById,
    getManufacturerById,
    getModelLineById
  }
}