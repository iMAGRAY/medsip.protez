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
  // Вес товара (кг)
  weight?: number | null
  // Время работы от батареи (например "8 ч.")
  batteryLife?: string
  warranty?: string
  characteristics?: Array<{
    value_id: number
    additional_value?: string | null
  }>
  custom_fields?: any
}

export interface ProductValidationErrors {
  name?: boolean
  category?: boolean
  price?: boolean
  sku?: boolean
  article_number?: boolean
  description?: boolean
  manufacturer?: boolean
  model_line?: boolean
}

export interface ProductFormState {
  formData: ProductFormData
  validationErrors: ProductValidationErrors
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  productImages: string[]
  productCharacteristics: any[]
  newProductSelectionTables: any
  existingProductSelectionTables: any
}

export interface ProductFormActions {
  setFormData: (data: Partial<ProductFormData>) => void
  setValidationErrors: (errors: Partial<ProductValidationErrors>) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setDirty: (dirty: boolean) => void
  setProductImages: (images: string[]) => void
  setProductCharacteristics: (characteristics: any[]) => void
  setNewProductSelectionTables: (tables: any) => void
  setExistingProductSelectionTables: (tables: any) => void
  resetForm: () => void
  validateForm: () => boolean
}

export interface ProductCategory {
  id: number
  name: string
  path?: string
}

export interface ProductManufacturer {
  id: number
  name: string
  description?: string
}

export interface ProductModelLine {
  id: number
  name: string
  manufacturer_id: number
  description?: string
}

export interface ProductCharacteristic {
  id: number
  name: string
  value: string
  type: 'text' | 'number' | 'boolean' | 'select'
  options?: string[]
  is_required: boolean
  display_order: number
}

export interface ProductFormHookReturn {
  state: ProductFormState
  actions: ProductFormActions
  data: {
    categories: ProductCategory[]
    manufacturers: ProductManufacturer[]
    modelLines: ProductModelLine[]
    loading: boolean
    error: string | null
  }
  operations: {
    loadProduct: (id: string) => Promise<void>
    saveProduct: () => Promise<string | null>
    handleSubmit: (e?: React.FormEvent) => Promise<void>
    handleImagesChange: (images: string[]) => void
    handleCharacteristicsChange: (characteristics: any[]) => void
    handleConfigurableCharacteristicsChange: (characteristics: any[]) => void
    handleNewProductSelectionTablesChange: (tables: any) => void
    handleExistingProductSelectionTablesChange: (tables: any) => void
  }
  utils: {
    getCategoryById: (id: number) => ProductCategory | undefined
    getManufacturerById: (id: number) => ProductManufacturer | undefined
    getModelLineById: (id: number) => ProductModelLine | undefined
  }
}