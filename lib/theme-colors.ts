/**
 * Централизованная система цветов для MedSIP Prosthetics
 * Соответствует предпочтениям пользователя: серые тона в стиле Obsidian
 */

export const themeColors = {
  // Основные цвета интерфейса
  primary: 'rgb(59 130 246)',      // Синий
  secondary: 'rgb(241 245 249)',   // Светло-серый
  accent: 'rgb(148 163 184)',      // Средне-серый
  muted: 'rgb(248 249 250)',       // Очень светло-серый

  // Состояния (без красных цветов)
  success: 'rgb(34 197 94)',       // Зеленый
  warning: 'rgb(251 191 36)',      // Желтый
  error: 'rgb(148 163 184)',       // Серый вместо красного
  info: 'rgb(59 130 246)',         // Синий

  // Текстовые цвета
  text: {
    primary: 'rgb(52 58 64)',      // Темно-серый
    secondary: 'rgb(100 116 139)', // Средне-серый
    muted: 'rgb(139 144 153)',     // Светло-серый
    accent: 'rgb(73 80 87)',       // Акцентный серый
  },

  // Фоновые цвета
  background: {
    primary: 'rgb(255 255 255)',   // Белый
    secondary: 'rgb(248 249 250)', // Очень светло-серый
    muted: 'rgb(241 245 249)',     // Светло-серый
    accent: 'rgb(245 247 244)',    // Акцентный фон
  },

  // Границы
  border: {
    default: 'rgb(226 232 240)',   // Светло-серый
    muted: 'rgb(241 245 249)',     // Очень светло-серый
    accent: 'rgb(148 163 184)',    // Средне-серый
  }
} as const

/**
 * Цветовая карта для характеристик продуктов
 * Все розовые/красные цвета заменены на серые
 */
export const characteristicColors = {
  'телесный': '#D1D5DB',
  'черный матовый': '#1F1F1F',
  'белый глянцевый': '#FFFFFF',
  'серебристый металлик': '#B8B8B8',
  'синий': '#2563EB',
  'красный': '#6B7280',          // Серый вместо красного
  'зеленый': '#16A34A',
  'камуфляж': '#8B7355',
  'под заказ': 'linear-gradient(45deg, #E5E7EB, #F3F4F6, #F9FAFB, #E5E7EB, #D1D5DB)',
  'коричневый': '#8B4513',
  'желтый': '#9CA3AF',           // Серый вместо ярко-желтого
  'фиолетовый': '#7C3AED',
  'оранжевый': '#9CA3AF',        // Серый вместо оранжевого
  'розовый': '#9CA3AF',          // Серый вместо розового
  'серый': '#6B7280',
  'золотой': '#D4AF37',
  'серебряный': '#C0C0C0'
} as const

/**
 * Получить цвет для характеристики
 */
export function getCharacteristicColor(name: string): string {
  const normalizedName = name.toLowerCase().trim()
  return characteristicColors[normalizedName as keyof typeof characteristicColors] || '#E5E7EB'
}

/**
 * CSS переменные для использования в Tailwind
 */
export const cssVariables = {
  '--theme-primary': themeColors.primary,
  '--theme-secondary': themeColors.secondary,
  '--theme-accent': themeColors.accent,
  '--theme-success': themeColors.success,
  '--theme-warning': themeColors.warning,
  '--theme-error': themeColors.error,
  '--theme-info': themeColors.info,
} as const

/**
 * Типы для TypeScript
 */
export type ThemeColor = keyof typeof themeColors
export type CharacteristicColorName = keyof typeof characteristicColors
export type TextColor = keyof typeof themeColors.text
export type BackgroundColor = keyof typeof themeColors.background
export type BorderColor = keyof typeof themeColors.border