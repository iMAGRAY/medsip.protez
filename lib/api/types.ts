// Основные типы для API v3

// ============== Базовые типы ==============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    duration?: number;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TimestampFields {
  created_at: string;
  updated_at: string;
}

// ============== Продукты ==============
export interface Product extends TimestampFields {
  id: number;
  name: string;
  slug: string;
  sku?: string;
  description?: string;
  category_id: number;
  manufacturer_id?: number;
  model_line_id?: number;
  series_id?: number;
  price?: number;
  discount_price?: number;
  stock_quantity: number;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  is_bestseller: boolean;
  main_image_url?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  
  // Связанные данные (опционально загружаются)
  category?: ProductCategory;
  manufacturer?: Manufacturer;
  variants?: ProductVariant[];
  characteristics?: ProductCharacteristic[];
  images?: MediaFile[];
}

export interface ProductVariant extends TimestampFields {
  id: number;
  master_id: number;
  name: string;
  slug: string;
  sku?: string;
  description?: string;
  price?: number;
  discount_price?: number;
  stock_quantity: number;
  reserved_quantity: number;
  attributes: Record<string, any>;
  primary_image_url?: string;
  images?: string[];
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  is_bestseller: boolean;
  sort_order: number;
  
  // Связанные данные
  characteristics?: VariantCharacteristic[];
}

// ============== Категории ==============
export interface ProductCategory extends TimestampFields {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent_id?: number;
  image_url?: string;
  icon?: string;
  is_active: boolean;
  sort_order: number;
  type: 'category' | 'subcategory' | 'group';
  
  // Связанные данные
  parent?: ProductCategory;
  children?: ProductCategory[];
  products_count?: number;
}

// ============== Характеристики ==============
export interface CharacteristicGroup extends TimestampFields {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
  is_section: boolean;
  is_active: boolean;
  sort_order: number;
  
  // Связанные данные
  values?: CharacteristicValue[];
  children?: CharacteristicGroup[];
}

export interface CharacteristicValue extends TimestampFields {
  id: number;
  group_id: number;
  value: string;
  description?: string;
  color_hex?: string;
  is_active: boolean;
  sort_order: number;
}

export interface ProductCharacteristic {
  id: number;
  product_id: number;
  value_id: number;
  additional_value?: string;
  
  // Связанные данные для отображения
  group_name?: string;
  value_name?: string;
  color_hex?: string;
}

export interface VariantCharacteristic {
  id: number;
  variant_id: number;
  value_id: number;
  additional_value?: string;
  
  // Связанные данные для отображения
  group_name?: string;
  value_name?: string;
  color_hex?: string;
}

// ============== Производители ==============
export interface Manufacturer extends TimestampFields {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website?: string;
  country?: string;
  is_active: boolean;
  sort_order: number;
}

// ============== Медиафайлы ==============
export interface MediaFile extends TimestampFields {
  id: number;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  file_hash: string;
  width?: number;
  height?: number;
  alt_text?: string;
  title?: string;
  is_active: boolean;
  upload_count: number;
}

// ============== Пользователи ==============
export interface User extends TimestampFields {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role_id: number;
  is_active: boolean;
  last_login?: string;
  
  // Связанные данные
  role?: UserRole;
}

export interface UserRole extends TimestampFields {
  id: number;
  name: string;
  description?: string;
  permissions: string[];
  is_active: boolean;
}

// ============== Заказы ==============
export interface Order extends TimestampFields {
  id: number;
  order_number: string;
  user_id?: number;
  status: OrderStatus;
  total_amount: number;
  discount_amount?: number;
  tax_amount?: number;
  shipping_amount?: number;
  payment_method?: string;
  shipping_method?: string;
  notes?: string;
  
  // Связанные данные
  items?: OrderItem[];
  user?: User;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number;
  variant_id?: number;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  discount?: number;
  total: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

// ============== Фильтры ==============
export interface ProductFilter {
  category_id?: number;
  manufacturer_id?: number;
  price_min?: number;
  price_max?: number;
  in_stock?: boolean;
  is_active?: boolean;
  is_featured?: boolean;
  is_new?: boolean;
  is_bestseller?: boolean;
  characteristics?: Record<number, number[]>; // group_id -> value_ids[]
  search?: string;
}

// ============== Настройки сайта ==============
export interface SiteSettings {
  id: number;
  site_name: string;
  site_description?: string;
  site_keywords?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  social_links?: Record<string, string>;
  analytics_code?: string;
  custom_css?: string;
  custom_js?: string;
  maintenance_mode: boolean;
  updated_at: string;
}