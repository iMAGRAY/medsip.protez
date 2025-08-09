import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility functions for product availability
export function isProductAvailable(product: any): boolean {
  // Товар считается доступным только на основе поля inStock (для интерфейса Prosthetic)
  // или in_stock (для API данных)
  // Поле stock_status используется только для информации, не влияет на доступность
  return Boolean(product.inStock || product.in_stock);
}

export function isProductOutOfStock(product: any): boolean {
  return !isProductAvailable(product);
}

export function getProductAvailabilityLabel(product: any): string {
  // Статус доступности на сайте - только на основе inStock или in_stock
  const available = product.inStock || product.in_stock;
  return available ? 'Доступен для заказа' : 'Недоступен для заказа';
}

export function getProductStockLabel(product: any): string {
  // Отображение складского статуса - только для информации
  if (product.stock_status) {
    switch (product.stock_status) {
      case 'in_stock': return 'В наличии на складе';
      case 'nearby_warehouse': return 'Ближний склад';
      case 'distant_warehouse': return 'Дальний склад';
      case 'on_order': return 'Под заказ';
      case 'out_of_stock': return 'Нет на складе';
      default: return 'Неизвестный статус склада';
    }
  }
  // Fallback на основе количества, если нет stock_status
  if (product.stock_quantity !== undefined) {
    return product.stock_quantity > 0 ? 'Есть на складе' : 'Нет на складе';
  }
  return 'Статус склада неизвестен';
}

export function formatPrice(price: number | string): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(numPrice);
}

/**
 * Получает актуальную цену товара с учетом скидки
 * @param product - объект товара с полями price и discount_price
 * @returns актуальная цена товара (со скидкой если есть, иначе обычная цена)
 */
export function getActualPrice(product: {
  price?: number | null;
  discount_price?: number | null;
}): number {
  // Если есть скидочная цена и она меньше обычной цены - используем её
  if (product.discount_price && product.price && product.discount_price < product.price) {
    return product.discount_price;
  }
  // Иначе используем обычную цену или скидочную если обычной нет
  return product.price || product.discount_price || 0;
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);
}

export function formatProductName(name: string): string {
  if (!name) return ''
  
  // Replace hyphens in product codes with non-breaking hyphens
  // This prevents breaking codes like "НРК-002" or "MPK-003"
  return name
    // Replace hyphen between uppercase letters/numbers with non-breaking hyphen
    .replace(/([А-ЯA-Z0-9]+)-([А-ЯA-Z0-9]+)/g, '$1\u2011$2')
    // Replace hyphen in codes like "Walk-001" with non-breaking hyphen
    .replace(/([a-zA-Zа-яА-Я]+)-(\d+)/g, '$1\u2011$2')
    // Replace spaces before hyphens with non-breaking spaces
    .replace(/\s+(-)/g, '\u00A0$1')
    // Replace spaces after hyphens with non-breaking spaces
    .replace(/(-)\s+/g, '$1\u00A0')
}
