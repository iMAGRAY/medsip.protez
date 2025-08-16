/**
 * Field mapping helper для конвертации между product_sizes и product_variants
 * Обеспечивает backward compatibility и правильное сопоставление полей
 */

import { ProductVariant } from '@/lib/api/types';

/**
 * Интерфейс для входящих данных от API (legacy format)
 */
export interface LegacySizeInput {
  // Legacy поля из product_sizes
  sizeName: string;
  sizeValue?: string;
  
  // Стандартные поля ProductVariant
  name?: string;
  description?: string;
  sku?: string;
  price?: number;
  discountPrice?: number;
  stockQuantity?: number;
  weight?: number;
  dimensions?: any;
  specifications?: any;
  isAvailable?: boolean;
  sortOrder?: number;
  imageUrl?: string;
  images?: string[];
  warranty?: string;
  batteryLife?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  isFeatured?: boolean;
  isNew?: boolean;
  isBestseller?: boolean;
  customFields?: Record<string, any>;
  characteristics?: any[];
  selectionTables?: any[];
}

/**
 * Интерфейс для данных product_variants (новый формат)
 */
export interface VariantInsertData {
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
  
  // Legacy fields для совместимости
  size_name?: string;
  size_value?: string;
  dimensions?: Record<string, any>;
  specifications?: Record<string, any>;
  
  // Дополнительные поля
  weight?: number;
  warranty_months?: number;
  battery_life_hours?: number;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  custom_fields?: Record<string, any>;
  cost_price?: number;
}

/**
 * Конвертирует legacy размер в формат product_variants для INSERT
 */
export function mapLegacySizeToVariant(
  input: LegacySizeInput,
  masterProductId: number,
  generatedSlug: string
): VariantInsertData {
  // Генерируем name если не указан
  const variantName = input.name || input.sizeName || `Размер ${input.sizeName}`;
  
  // Конвертируем warranty из строки в месяцы (базовая логика)
  const warrantyMonths = input.warranty ? parseWarrantyToMonths(input.warranty) : undefined;
  
  // Конвертируем batteryLife из строки в часы
  const batteryLifeHours = input.batteryLife ? parseBatteryLifeToHours(input.batteryLife) : undefined;
  
  return {
    master_id: masterProductId,
    name: variantName,
    slug: generatedSlug,
    sku: input.sku || undefined,
    description: input.description || undefined,
    price: input.price || undefined,
    discount_price: input.discountPrice || undefined,
    stock_quantity: input.stockQuantity || 0,
    reserved_quantity: 0, // Новое поле, по умолчанию 0
    attributes: {}, // Новое поле, базовые атрибуты
    primary_image_url: input.imageUrl || undefined,
    images: input.images || [],
    is_active: input.isAvailable !== false,
    is_featured: input.isFeatured || false,
    is_new: input.isNew || false,
    is_bestseller: input.isBestseller || false,
    sort_order: input.sortOrder || 0,
    
    // Legacy поля для backward compatibility
    size_name: input.sizeName,
    size_value: input.sizeValue || undefined,
    dimensions: input.dimensions || undefined,
    specifications: input.specifications || undefined,
    
    // Дополнительные поля
    weight: input.weight || undefined,
    warranty_months: warrantyMonths,
    battery_life_hours: batteryLifeHours,
    meta_title: input.metaTitle || undefined,
    meta_description: input.metaDescription || undefined,
    meta_keywords: input.metaKeywords || undefined,
    custom_fields: input.customFields || {},
    cost_price: undefined // Новое поле, потребует отдельной логики
  };
}

/**
 * Конвертирует данные из product_variants обратно в legacy формат для API response
 */
export function mapVariantToLegacySize(variant: any): any {
  return {
    id: variant.id,
    productId: variant.master_id,
    sizeName: variant.size_name,
    sizeValue: variant.size_value,
    name: variant.name,
    description: variant.description,
    sku: variant.sku,
    price: variant.price,
    discountPrice: variant.discount_price,
    stockQuantity: variant.stock_quantity,
    weight: variant.weight,
    dimensions: variant.dimensions,
    specifications: variant.specifications,
    isAvailable: variant.is_active,
    sortOrder: variant.sort_order,
    imageUrl: variant.primary_image_url,
    images: Array.isArray(variant.images) ? variant.images : 
            typeof variant.images === 'string' ? JSON.parse(variant.images || '[]') : [],
    warranty: formatWarrantyFromMonths(variant.warranty_months),
    batteryLife: formatBatteryLifeFromHours(variant.battery_life_hours),
    metaTitle: variant.meta_title,
    metaDescription: variant.meta_description,
    metaKeywords: variant.meta_keywords,
    isFeatured: variant.is_featured,
    isNew: variant.is_new,
    isBestseller: variant.is_bestseller,
    customFields: typeof variant.custom_fields === 'string' ? 
                 JSON.parse(variant.custom_fields || '{}') : (variant.custom_fields || {}),
    characteristics: [], // Потребует отдельной загрузки
    selectionTables: [], // Потребует отдельной загрузки
    createdAt: variant.created_at,
    updatedAt: variant.updated_at
  };
}

/**
 * Генерирует SQL поля для INSERT в product_variants
 */
export function generateInsertFields(): string {
  return `
    master_id, name, slug, sku, description, price, discount_price,
    stock_quantity, reserved_quantity, attributes, primary_image_url,
    images, is_active, is_featured, is_new, is_bestseller, sort_order,
    size_name, size_value, dimensions, specifications, weight,
    warranty_months, battery_life_hours, meta_title, meta_description,
    meta_keywords, custom_fields, cost_price
  `.trim();
}

/**
 * Генерирует SQL placeholders для INSERT
 */
export function generateInsertPlaceholders(): string {
  // 28 полей всего
  return Array.from({ length: 28 }, (_, i) => `$${i + 1}`).join(', ');
}

/**
 * Генерирует SQL SET clause для UPDATE
 */
export function generateUpdateFields(): string {
  return `
    name = $2, slug = $3, sku = $4, description = $5, price = $6,
    discount_price = $7, stock_quantity = $8, attributes = $9,
    primary_image_url = $10, images = $11, is_active = $12,
    is_featured = $13, is_new = $14, is_bestseller = $15,
    sort_order = $16, size_name = $17, size_value = $18,
    dimensions = $19, specifications = $20, weight = $21,
    warranty_months = $22, battery_life_hours = $23, meta_title = $24,
    meta_description = $25, meta_keywords = $26, custom_fields = $27,
    updated_at = CURRENT_TIMESTAMP
  `.trim();
}

/**
 * Конвертирует warranty строку в месяцы
 */
function parseWarrantyToMonths(warranty: string): number | undefined {
  if (!warranty) return undefined;
  
  const match = warranty.match(/(\d+)\s*(год|года|лет|месяц|месяца|месяцев)/i);
  if (!match) return undefined;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  if (unit.includes('год')) {
    return value * 12;
  } else if (unit.includes('месяц')) {
    return value;
  }
  
  return undefined;
}

/**
 * Конвертирует battery life строку в часы
 */
function parseBatteryLifeToHours(batteryLife: string): number | undefined {
  if (!batteryLife) return undefined;
  
  const match = batteryLife.match(/(\d+)\s*(час|часа|часов|сут|дня|дней)/i);
  if (!match) return undefined;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  if (unit.includes('час')) {
    return value;
  } else if (unit.includes('сут') || unit.includes('дн')) {
    return value * 24;
  }
  
  return undefined;
}

/**
 * Форматирует warranty из месяцев обратно в строку
 */
function formatWarrantyFromMonths(months?: number): string | undefined {
  if (!months) return undefined;
  
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return `${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`;
  }
  
  return `${months} ${months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев'}`;
}

/**
 * Форматирует battery life из часов обратно в строку
 */
function formatBatteryLifeFromHours(hours?: number): string | undefined {
  if (!hours) return undefined;
  
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;
  }
  
  return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`;
}