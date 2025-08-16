/**
 * Utility для генерации slug для product variants
 * Обеспечивает уникальность и SEO-дружественность
 */

import { executeQuery } from '@/lib/db-connection';

/**
 * Конвертирует строку в slug формат
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Заменяем русские символы на латинские
    .replace(/[а-я]/g, (char) => {
      const map: Record<string, string> = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return map[char] || char;
    })
    // Удаляем специальные символы, оставляем только буквы, цифры и дефисы
    .replace(/[^a-z0-9\s-]/g, '')
    // Заменяем пробелы и множественные дефисы на одиночные дефисы
    .replace(/[\s-]+/g, '-')
    // Убираем дефисы в начале и конце
    .replace(/^-+|-+$/g, '');
}

/**
 * Генерирует уникальный slug для product variant
 */
export async function generateUniqueSlug(
  baseName: string,
  masterProductId: number,
  existingSlug?: string
): Promise<string> {
  let baseSlug = createSlug(baseName);
  
  // Если пустой базовый slug, используем fallback
  if (!baseSlug) {
    baseSlug = `variant-${masterProductId}`;
  }
  
  // Если это обновление существующего варианта и slug не изменился
  if (existingSlug && existingSlug === baseSlug) {
    return baseSlug;
  }
  
  let slug = baseSlug;
  let counter = 1;
  
  while (await isSlugExists(slug, masterProductId, existingSlug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

/**
 * Проверяет существует ли slug в таблице product_variants
 */
async function isSlugExists(
  slug: string, 
  masterProductId: number, 
  excludeSlug?: string
): Promise<boolean> {
  try {
    let query = `
      SELECT 1 FROM product_variants 
      WHERE slug = $1 AND master_id = $2
    `;
    const params = [slug, masterProductId];
    
    // Если это обновление существующего варианта, исключаем его из проверки
    if (excludeSlug) {
      query += ` AND slug != $3`;
      params.push(excludeSlug);
    }
    
    query += ` LIMIT 1`;
    
    const result = await executeQuery(query, params);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking slug existence:', error);
    // В случае ошибки возвращаем true для безопасности (будет сгенерирован новый slug)
    return true;
  }
}

/**
 * Генерирует slug для размера варианта (legacy support)
 */
export function generateSizeSlug(sizeName: string, sizeValue?: string): string {
  let parts = [sizeName];
  
  if (sizeValue && sizeValue !== sizeName) {
    parts.push(sizeValue);
  }
  
  return createSlug(parts.join(' '));
}