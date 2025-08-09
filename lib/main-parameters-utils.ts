export interface MainParameter {
  id: number
  label: string
  value: string
  priority: number
  group_name: string
  display_name: string
}

export interface CharacteristicGroup {
  group_id: number
  group_name: string
  group_ordering?: number
  show_in_main_params?: boolean
  main_params_priority?: number
  main_params_label_override?: string
  characteristics: Array<{
    id: number
    label: string
    type: string
    value_numeric?: number
    value_text?: string
    value_color?: string
    enum_value?: string
    size_name?: string
    unit_code?: string
  }>
}

/**
 * Извлекает основные параметры из групп характеристик
 */
export function extractMainParameters(groups: CharacteristicGroup[]): MainParameter[] {
  const mainParams: MainParameter[] = [];

  if (!groups || !Array.isArray(groups)) {
    return mainParams;
  }

  // Фильтруем только группы с show_in_main_params = true
  const mainParamsGroups = groups.filter(group => group.show_in_main_params === true);

  mainParamsGroups.forEach(group => {
    const displayName = group.main_params_label_override || group.group_name;
    const priority = group.main_params_priority || 999;

    group.characteristics.forEach(characteristic => {
      const value = formatCharacteristicValue(characteristic);

      // Добавляем только характеристики с значениями
      if (value && value.trim()) {
        mainParams.push({
          id: characteristic.id,
          label: characteristic.label || displayName,
          value: value.trim(),
          priority,
          group_name: group.group_name,
          display_name: displayName
        });
      }
    });
  });

  // Сортируем по приоритету
  return mainParams.sort((a, b) => a.priority - b.priority);
}

/**
 * Форматирует значение характеристики
 */
export function formatCharacteristicValue(characteristic: any): string {
  // Приоритет значений: value_text > value_numeric > enum_value > size_name > value_color
  if (characteristic.value_text && characteristic.value_text.trim()) {
    let value = characteristic.value_text.trim();
    if (characteristic.unit_code && characteristic.unit_code.trim()) {
      value += ` ${characteristic.unit_code.trim()}`;
    }
    return value;
  }

  if (characteristic.value_numeric !== null && characteristic.value_numeric !== undefined) {
    let value = characteristic.value_numeric.toString();
    if (characteristic.unit_code && characteristic.unit_code.trim()) {
      value += ` ${characteristic.unit_code.trim()}`;
    }
    return value;
  }

  if (characteristic.enum_value && characteristic.enum_value.trim()) {
    return characteristic.enum_value.trim();
  }

  if (characteristic.size_name && characteristic.size_name.trim()) {
    return characteristic.size_name.trim();
  }

  if (characteristic.value_color && characteristic.value_color.trim()) {
    return characteristic.value_color.trim();
  }

  return '';
}

/**
 * Получает топ N основных параметров для краткого отображения
 */
export function getTopMainParameters(groups: CharacteristicGroup[], limit: number = 3): MainParameter[] {
  const mainParams = extractMainParameters(groups);
  return mainParams.slice(0, limit);
}

/**
 * Проверяет, является ли значение важным (для выделения)
 */
export function isImportantValue(value: string): boolean {
  const importantKeywords = ['есть', 'да', 'независимый', 'автоматический', 'встроенный', 'высокий', 'премиум'];
  return importantKeywords.some(keyword => value.toLowerCase().includes(keyword));
}

/**
 * Форматирует параметры для отображения в одну строку
 */
export function formatParametersInline(parameters: MainParameter[], separator: string = ' • '): string {
  return parameters
    .map(param => `${param.display_name}: ${param.value}`)
    .join(separator);
}

/**
 * Группирует параметры по типам для разного отображения
 */
export function groupParametersByType(parameters: MainParameter[]) {
  return {
    critical: parameters.filter(p => p.priority <= 2), // Самые важные
    important: parameters.filter(p => p.priority > 2 && p.priority <= 4), // Важные
    additional: parameters.filter(p => p.priority > 4) // Дополнительные
  };
}