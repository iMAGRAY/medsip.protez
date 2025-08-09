export interface AdminUser {
  id: string
  email: string
  name: string
  role: "admin" | "editor"
}

export interface AdditionalContact {
  id: string
  type: "phone" | "email" | "address" | "website" | "other"
  label: string
  value: string
  isActive: boolean
}

export interface SiteSettings {
  id: number
  siteName: string
  siteDescription?: string
  heroTitle?: string
  heroSubtitle?: string
  heroCta?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  socialMedia?: any
  socialLinks?: any
  additionalContacts?: AdditionalContact[]
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  description?: string
  isActive: boolean
  parentId?: string
  type: 'product'
  children?: Category[]
  createdAt: string
  updatedAt: string
}

export interface Material {
  id: number
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Feature {
  id: number
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Manufacturer {
  id: number
  name: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  country?: string
  foundedYear?: number
  isActive: boolean
  sortOrder: number
  modelLinesCount?: number
  createdAt: string
  updatedAt: string
}

export interface ModelLine {
  id: number
  name: string
  description?: string
  categoryId?: number
  categoryName?: string
  manufacturerId?: number
  manufacturerName?: string
  imageUrl?: string
  isActive: boolean
  sortOrder: number
  productsCount?: number
  createdAt: string
  updatedAt: string
}
