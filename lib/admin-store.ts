"use client"

import { create } from "zustand"
import type { Prosthetic } from "./data"
import { apiClient } from "./api-client"
import {
  type SiteSettings,
  type Category,
  type ModelLine,
} from "./admin-data"

// Transform API responses to frontend types
const transformApiProduct = (apiProduct: any): Prosthetic => {
  return {
    id: apiProduct.id.toString(),
    name: apiProduct.name,
    short_name: apiProduct.short_name || apiProduct.name,
    category: apiProduct.category_name || '',
    category_id: apiProduct.category_id || null,
    category_name: apiProduct.category_name || '',
    manufacturer: apiProduct.manufacturer_name || '',
    manufacturer_name: apiProduct.manufacturer_name || '',
    modelLine: apiProduct.model_line_name || '',
    model_line_name: apiProduct.model_line_name || '',
    modelLineId: apiProduct.series_id?.toString() || '',
    manufacturerId: apiProduct.manufacturer_id?.toString() || '',
    description: apiProduct.description || '',
    sku: apiProduct.sku || '',
    article_number: apiProduct.article_number || '',
    price: apiProduct.price || null,
    discount_price: apiProduct.discount_price || null,
    imageUrl: apiProduct.image_url || '',
    images: Array.isArray(apiProduct.images) ? apiProduct.images :
            (apiProduct.images ? JSON.parse(apiProduct.images) : []),
    weight: apiProduct.weight || '',
    batteryLife: apiProduct.battery_life || '',
    warranty: apiProduct.warranty || '',
    inStock: apiProduct.in_stock || false,
    stock_quantity: apiProduct.stock_quantity || 0,
    stock_status: apiProduct.stock_status || 'in_stock',
    show_price: apiProduct.show_price !== undefined ? apiProduct.show_price : true,
    has_variants: apiProduct.has_variants || false,
    variants_count: apiProduct.variants_count ? parseInt(apiProduct.variants_count, 10) : 0,
    specifications: Array.isArray(apiProduct.specifications) ? apiProduct.specifications :
                   (apiProduct.specifications ?
                     (typeof apiProduct.specifications === 'string' ?
                       JSON.parse(apiProduct.specifications) : apiProduct.specifications) : [])
  }
}

const _transformApiCategory = (apiCategory: any): Category => ({
  id: apiCategory.id.toString(),
  name: apiCategory.name,
  description: apiCategory.description || "",
  isActive: Boolean(apiCategory.is_active),
  parentId: apiCategory.parent_id ?? undefined,
  type: apiCategory.type || 'product',
  children: [],
  createdAt: apiCategory.created_at,
  updatedAt: apiCategory.updated_at || new Date().toISOString(),
})

const transformApiModelLine = (apiModelLine: any): ModelLine => ({
  id: apiModelLine.id,
  name: apiModelLine.name,
  description: apiModelLine.description || "",
  categoryId: apiModelLine.categoryId || apiModelLine.category_id,
  categoryName: apiModelLine.categoryName || apiModelLine.category_name || "",
  manufacturerId: apiModelLine.manufacturerId || apiModelLine.manufacturer_id,
  manufacturerName: apiModelLine.manufacturerName || apiModelLine.manufacturer_name || "",
  imageUrl: apiModelLine.imageUrl || apiModelLine.image_url || "",
  isActive: apiModelLine.isActive || apiModelLine.is_active,
  sortOrder: apiModelLine.sortOrder || apiModelLine.sort_order || 0,
  productsCount: Number(apiModelLine.products_count) || 0,
  createdAt: apiModelLine.createdAt || apiModelLine.created_at,
  updatedAt: apiModelLine.updatedAt || apiModelLine.updated_at,
})

const _transformApiSiteSettings = (apiSettings: any): SiteSettings => ({
  id: apiSettings.id || 0,
  siteName: apiSettings.siteName || apiSettings.site_name || "",
  siteDescription: apiSettings.siteDescription || apiSettings.site_description || "",
  heroTitle: apiSettings.heroTitle || apiSettings.hero_title || "",
  heroSubtitle: apiSettings.heroSubtitle || apiSettings.hero_subtitle || "",
  contactEmail: apiSettings.contactEmail || apiSettings.contact_email || "",
  contactPhone: apiSettings.contactPhone || apiSettings.contact_phone || "",
  address: apiSettings.address || apiSettings.contact_address || "",
  socialMedia: apiSettings.socialMedia || apiSettings.social_media || {},
  additionalContacts: apiSettings.additionalContacts || apiSettings.additional_contacts || [],
  createdAt: apiSettings.createdAt || apiSettings.created_at || new Date().toISOString(),
  updatedAt: apiSettings.updatedAt || apiSettings.updated_at || new Date().toISOString(),
})

interface AdminStore {
  // State
  loading: boolean
  error: string | null
  siteSettings: SiteSettings | null
  categories: Category[]
  modelLines: ModelLine[]
  products: Prosthetic[]

  // Computed getters
  isLoading: boolean

  // Actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  initializeData: () => Promise<void>
  forceRefresh: () => Promise<void>
  syncWarehouseData: () => Promise<any>

  // Site Settings
  loadSiteSettings: () => Promise<void>
  updateSiteSettings: (data: any) => Promise<void>

  // Categories
  loadCategories: () => Promise<void>
  addCategory: (data: any) => Promise<void>
  updateCategory: (id: string, data: any) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  // Model Lines
  loadModelLines: () => Promise<void>
  addModelLine: (data: any) => Promise<void>
  updateModelLine: (id: string, data: any) => Promise<void>
  deleteModelLine: (id: string) => Promise<void>

  // Products
  loadProducts: (forceRefresh?: boolean) => Promise<void>
  addProduct: (data: any) => Promise<void>
  updateProduct: (id: string, data: any) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  // Initial state
  loading: false,
  error: null,
  siteSettings: null,
  categories: [],
  modelLines: [],
  products: [],

  // Computed getters
  get isLoading() {
    return get().loading
  },

  // Basic actions
  setLoading: (_loading) => set({ loading: _loading }),
  setError: (_error) => set({ error: _error }),

  // Принудительное обновление данных
  forceRefresh: async () => {
    const store = get()

    // Очищаем кэш перед обновлением
    apiClient.clearCache()

    // Принудительно очищаем Redis кэш
    try {
      const response = await fetch('/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patterns: [
            'medsip:products:*',
            'products:*',
            'product:*',
            'products-fast:*',
            'products-full:*',
            'products-detailed:*',
            'products-basic:*'
          ]
        })
      })

      if (response.ok) {

      }
    } catch (cacheError) {
      // Failed to clear cache via API in forceRefresh
    }

    // Перезагружаем данные с принудительным обновлением
    await store.loadProducts(true)
    await store.loadCategories()
    await store.loadModelLines()

  },

  // Синхронизация данных склада и каталога
  syncWarehouseData: async () => {

    try {
      const response = await fetch('/api/warehouse/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {

        // Перезагружаем данные после синхронизации
        const store = get()
        await store.loadProducts()

        return result.data
      } else {
        throw new Error(result.error || 'Ошибка синхронизации')
      }
    } catch (error) {
      // Ошибка синхронизации
      throw error
    }
  },

  // Initialize all data with PARALLEL loading for speed
  initializeData: async () => {
    const store = get()
    store.setLoading(true)
    store.setError(null)

    try {

      const startTime = performance.now()

      // Load all data in PARALLEL for maximum speed (only existing tables)
      const [
        siteSettings,
        categories,
        modelLines,
        products
      ] = await Promise.allSettled([
        store.loadSiteSettings(),
        store.loadCategories(),
        store.loadModelLines(),
        store.loadProducts()
      ])

      // Log results of each load
      const results = [
        { name: 'Site Settings', result: siteSettings },
        { name: 'Categories', result: categories },
        { name: 'Model Lines', result: modelLines },
        { name: 'Products', result: products }
      ]

      const failed = results.filter((r) => r.result.status === 'rejected') as {
        name: string
        result: PromiseRejectedResult
      }[]

      const _succeeded = results.filter((r) => r.result.status === 'fulfilled') as {
        name: string
        result: PromiseFulfilledResult<void>
      }[]

      const endTime = performance.now()
      const _loadTime = Math.round(endTime - startTime)

      if (failed.length > 0) {
        // Failed to load data sources
        // Individual load failures logged
      }

      if (failed.length === results.length) {
        throw new Error("All data loading failed")
      }

    } catch (_error) {

      store.setError("Failed to load data from database. Check console for details.")
    } finally {
      store.setLoading(false)
    }
  },

  // Site Settings
  loadSiteSettings: async () => {
    try {
      const settings = await apiClient.getSiteSettings()
      set({ siteSettings: settings })
    } catch (_error) {

      set({ siteSettings: null })
    }
  },

  updateSiteSettings: async (data) => {
    try {
      // Проверяем что data не null/undefined
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data provided to updateSiteSettings')
      }

      const updated = await apiClient.updateSiteSettings(data)
      set({ siteSettings: updated })
    } catch (error) {
      // Admin Store - updateSiteSettings failed
      throw error
    }
  },

  // Categories
  loadCategories: async () => {
    try {
      const apiResponse = await apiClient.getCategories()

      // API may return {success: true, data: [...]}
      const apiTree = Array.isArray(apiResponse)
        ? apiResponse
        : (apiResponse && Array.isArray(apiResponse.data) ? apiResponse.data : [])

      // Recursive mapping from API to Category type
      const mapTree = (nodes: any[]): Category[] =>
        nodes.map((n) => ({
          id: n.id.toString(),
          name: n.name,
          description: n.description || '',
          isActive: Boolean(n.is_active),
          parentId: n.parent_id ? n.parent_id.toString() : undefined,
          type: n.type || 'product',
          children: n.children ? mapTree(n.children) : [],
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        }))

      const mapped = mapTree(apiTree)
      set({ categories: mapped })
    } catch (_error) {

      set({ categories: [] })
    }
  },

  addCategory: async (data) => {
    try {
      const newCategory = await apiClient.createCategory({
        name: data.name,
        description: data.description,
        is_active: data.isActive ?? true,
        parent_id: data.parentId ?? null,
      })

      const category: Category = {
        id: newCategory.id.toString(),
        name: newCategory.name,
        description: newCategory.description || '',
        isActive: Boolean(newCategory.is_active),
        parentId: newCategory.parent_id ? newCategory.parent_id.toString() : undefined,
        type: 'product',
        children: [],
        createdAt: newCategory.created_at,
        updatedAt: newCategory.updated_at,
      }

      set((state) => {
        if (category.parentId) {
          // insert into parent's children recursively
          const insert = (arr: Category[]): Category[] =>
            arr.map((c) => {
              if (c.id === category.parentId) {
                return { ...c, children: [...(c.children || []), category] }
              }
              return { ...c, children: insert(c.children || []) }
            })
          return { categories: insert(state.categories) }
        }
        return { categories: [...state.categories, category] }
      })
    } catch (error) {

      throw error
    }
  },

  updateCategory: async (id, data) => {
    try {
      const updated = await apiClient.updateCategory(id, {
        name: data.name,
        description: data.description,
        is_active: data.isActive,
        parent_id: data.parentId ?? null,
      })

      const newCat: Category = {
        id: updated.id.toString(),
        name: updated.name,
        description: updated.description || '',
        isActive: Boolean(updated.is_active),
        parentId: updated.parent_id ? updated.parent_id.toString() : undefined,
        type: 'product',
        children: [], // will be preserved in replace logic
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      }

      const replace = (arr: Category[]): Category[] =>
        arr.map((c) => {
          if (c.id === newCat.id) {
            return { ...newCat, children: c.children }
          }
          return { ...c, children: replace(c.children || []) }
        })

      set((state) => ({ categories: replace(state.categories) }))
    } catch (error) {

      throw error
    }
  },

  deleteCategory: async (id) => {
    try {
      await apiClient.deleteCategory(id)
      const remove = (arr: Category[]): Category[] =>
        arr.filter((c) => c.id !== id.toString()).map((c) => ({ ...c, children: remove(c.children || []) }))
      set((state) => ({ categories: remove(state.categories) }))
    } catch (error) {

      throw error
    }
  },

  // Model Lines
  loadModelLines: async () => {
    try {
      const response = await fetch('/api/model-lines')
      if (!response.ok) throw new Error('Failed to fetch model lines')
      const result = await response.json()
      const apiModelLines = result.success ? result.data : (Array.isArray(result) ? result : [])
      const _modelLines = apiModelLines.map(transformApiModelLine)
      set({ modelLines: _modelLines })
    } catch (_error) {

      set({ modelLines: [] })
    }
  },

  addModelLine: async (data) => {
    try {
      const response = await fetch('/api/model-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          category_id: data.categoryId,
          manufacturer_id: data.manufacturerId,
          image_url: data.imageUrl,
          is_active: data.isActive ?? true,
          sort_order: data.sortOrder || 0
        })
      })

      if (!response.ok) throw new Error('Failed to create model line')
      const result = await response.json()
      const newModelLine = result.success ? result.data : result
      const modelLine = transformApiModelLine(newModelLine)
      set((state) => ({ modelLines: [...state.modelLines, modelLine] }))
    } catch (error) {

      throw error
    }
  },

  updateModelLine: async (id, data) => {
    try {
      const response = await fetch(`/api/model-lines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          category_id: data.categoryId,
          manufacturer_id: data.manufacturerId,
          image_url: data.imageUrl,
          is_active: data.isActive,
          sort_order: data.sortOrder,
        })
      })

      if (!response.ok) throw new Error('Failed to update model line')
      const result = await response.json()
      const updated = result.success ? result.data : result
      const modelLine = transformApiModelLine(updated)
      set((state) => ({
        modelLines: state.modelLines.map((ml) => (ml.id.toString() === id ? modelLine : ml))
      }))
    } catch (error) {

      throw error
    }
  },

  deleteModelLine: async (id) => {
    try {
      const response = await fetch(`/api/model-lines/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete model line')
      }

      set((state) => ({
        modelLines: state.modelLines.filter((ml) => ml.id.toString() !== id)
      }))
    } catch (error) {

      throw error
    }
  },

  // Products
  loadProducts: async (forceRefresh = false) => {
    try {
      // Загружаем товары
      const _startTime = performance.now()

      // Принудительно очищаем кэш если требуется
      if (forceRefresh) {

        apiClient.clearCache()

        // Принудительно очищаем Redis кэш
        try {
          const response = await fetch('/api/cache/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patterns: [
                'medsip:products:*',
                'products:*',
                'product:*',
                'products-fast:*',
                'products-full:*',
                'products-detailed:*',
                'products-basic:*'
              ]
            })
          })

          if (response.ok) {

          }
        } catch (cacheError) {
          // Failed to clear cache via API
        }
      }

      // Use full mode to get category names for filtering
      const response = await apiClient.getProducts({ fast: false })

      // API возвращает объект с полем data, а не массив напрямую
      const apiProducts = response?.data || response || []

      // Проверяем что это массив
      if (!Array.isArray(apiProducts)) {
        // API вернул не массив
        set({ products: [] })
        return
      }

      const _products = apiProducts.map(transformApiProduct)

      const _endTime = performance.now()

      set({ products: _products })
    } catch (error) {
      // Ошибка при загрузке товаров
      set({ products: [] })
    }
  },

  addProduct: async (data) => {
    try {
      // Find category ID by name
      const { categories } = get()
      const category = categories.find(cat => cat.name === data.category)

      const productData = {
        name: data.name,
        description: data.description,
        category_id: category?.id || null,
        model_line_id: data.modelLineId || null,
        image_url: data.imageUrl,
        images: data.images || [],
        in_stock: data.inStock ?? true,
      }

      const newProduct = await apiClient.createProduct(productData)

      // Принудительно перезагружаем список товаров после создания
      setTimeout(async () => {
        try {
          // Используем метод принудительного обновления
          await get().forceRefresh()

        } catch (reloadError) {
          // Error refreshing products after creation
          // Fallback к обычной загрузке с принудительным обновлением
          get().loadProducts(true)
        }
      }, 300)

      return newProduct
    } catch (error) {
      console.error('❌ Error creating product:', error)
      throw error
    }
  },

  updateProduct: async (id, data) => {
    try {
      // Find category ID by name
      const { categories } = get()
      const category = categories.find(cat => cat.name === data.category)

      const productData = {
        name: data.name,
        description: data.description,
        category_id: category?.id || null,
        model_line_id: data.modelLineId || null,
        image_url: data.imageUrl,
        images: data.images || [],
        in_stock: data.inStock ?? true,
        stock_quantity: data.stock_quantity || 0,
        stock_status: data.stock_status || 'in_stock',
        price: data.price || null,
        discount_price: data.discount_price || null,
        weight: data.weight || null,
        battery_life: data.battery_life || null,
        warranty: data.warranty || null,
        sku: data.sku || null,
        article_number: data.article_number || null,
        manufacturer_id: data.manufacturer_id || null,
        series_id: data.series_id || null,
        show_price: data.show_price !== undefined ? data.show_price : true,
      }

      const updated = await apiClient.updateProduct(id, productData)

      // Очищаем кэш после обновления
      apiClient.clearCache()

      const product = transformApiProduct(updated.data || updated)
      set((state) => ({
        products: state.products.map((prod) => (prod.id === id ? product : prod))
      }))

    } catch (error) {
      console.error('❌ Ошибка при обновлении товара:', error)
      throw error
    }
  },

  deleteProduct: async (id) => {
    try {

      const result = await apiClient.deleteProduct(id)

      if (result.success) {
        // Удаляем из локального состояния
        set((state) => ({
          products: state.products.filter((prod) => prod.id !== id)
        }))

        // Принудительно перезагружаем данные для синхронизации с принудительной очисткой кэша
        setTimeout(async () => {
          try {
            // Используем метод принудительного обновления
            await get().forceRefresh()

          } catch (reloadError) {
            console.error('❌ Error refreshing products after deletion:', reloadError)
            // Fallback к обычной загрузке
            get().loadProducts()
          }
        }, 300)
      } else {
        throw new Error(result.error || 'Delete failed')
      }
    } catch (error) {
      console.error('❌ Error deleting product:', error)
      throw error
    }
  },
}))
