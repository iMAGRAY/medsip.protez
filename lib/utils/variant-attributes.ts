// Утилиты для работы с атрибутами вариантов товаров

export interface AttributeObject {
  group_id?: number;
  value_id?: number;
  group_name?: string;
  value_name?: string;
  additional_value?: string;
  color_hex?: string | null;
}

export type VariantAttributes = AttributeObject[] | Record<string, any> | null | undefined;

/**
 * Проверяет, являются ли атрибуты массивом объектов
 */
export function isAttributeArray(attributes: VariantAttributes): attributes is AttributeObject[] {
  return Array.isArray(attributes);
}

/**
 * Проверяет, являются ли атрибуты объектом
 */
export function isAttributeObject(attributes: VariantAttributes): attributes is Record<string, any> {
  return (
    typeof attributes === 'object' &&
    attributes !== null &&
    !Array.isArray(attributes)
  );
}

/**
 * Группирует атрибуты по группам
 */
export function groupAttributesByGroup(attributes: AttributeObject[]): Record<string, AttributeObject[]> {
  return attributes.reduce((groups: Record<string, AttributeObject[]>, attr) => {
    const groupName = attr.group_name || 'Другое';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(attr);
    return groups;
  }, {});
}

/**
 * Преобразует атрибуты в единый формат для отображения
 */
export function normalizeAttributes(attributes: VariantAttributes): Array<{ key: string; label: string; value: string }> {
  const result: Array<{ key: string; label: string; value: string }> = [];

  if (isAttributeArray(attributes)) {
    attributes.forEach((attr, index) => {
      if (attr.group_name && attr.value_name) {
        result.push({
          key: `${attr.group_id}-${attr.value_id}-${index}`,
          label: attr.group_name,
          value: attr.value_name + (attr.additional_value ? ` (${attr.additional_value})` : '')
        });
      }
    });
  } else if (isAttributeObject(attributes)) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        let displayValue = '';
        
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          displayValue = String(value);
        } else if (typeof value === 'object') {
          if ('value_name' in value) {
            displayValue = value.value_name;
          } else if ('name' in value) {
            displayValue = value.name;
          } else {
            displayValue = JSON.stringify(value);
          }
        }
        
        if (displayValue) {
          result.push({
            key,
            label: key,
            value: displayValue
          });
        }
      }
    });
  }

  return result;
}

/**
 * Получает основные атрибуты для краткого отображения
 */
export function getMainAttributes(attributes: VariantAttributes, limit: number = 2): string[] {
  const normalized = normalizeAttributes(attributes);
  return normalized.slice(0, limit).map(attr => attr.value);
}
