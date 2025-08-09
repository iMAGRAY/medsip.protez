// Data types and interfaces
export interface Prosthetic {
  id: number | string
  name: string
  category?: string
  category_name?: string
  manufacturer?: string
  manufacturer_name?: string
  price?: number
  discount_price?: number
  imageUrl?: string
  image_url?: string
  images?: string[]
  specifications?: any[]
  modelLine?: string
  model_line_name?: string
  inStock?: boolean
  stock_status?: string
  stock_quantity?: number
  // Additional fields found in codebase
  sku?: string
  article_number?: string
  show_price?: boolean
  has_variants?: boolean
  variants_count?: number
  description?: string
  warranty?: string
  batteryLife?: string
  weight?: string
  short_name?: string
  category_id?: number | string
  primary_image_url?: string
  modelLineId?: string
  manufacturerId?: string
}

export interface SortOption {
  value: string
  label: string
  field: string
  direction: 'asc' | 'desc'
}

// Sort options for compatibility
export const sortOptions: SortOption[] = [
  { value: 'name-asc', label: 'По названию А-Я', field: 'name', direction: 'asc' },
  { value: 'name-desc', label: 'По названию Я-А', field: 'name', direction: 'desc' },
  { value: 'price-asc', label: 'По цене ↑', field: 'price', direction: 'asc' },
  { value: 'price-desc', label: 'По цене ↓', field: 'price', direction: 'desc' }
]