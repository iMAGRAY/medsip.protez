/**
 * Утилиты для санитизации данных и предотвращения XSS атак
 */

/**
 * Санитизирует строку для безопасного использования в DOM
 * Удаляет потенциально опасные символы и последовательности
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input) return ''
  
  return String(input)
    // Удаляем HTML теги
    .replace(/<[^>]*>/g, '')
    // Удаляем script теги (дополнительная защита)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Экранируем специальные символы
    .replace(/[<>'"&]/g, (match) => {
      switch (match) {
        case '<': return '&lt;'
        case '>': return '&gt;'
        case '"': return '&quot;'
        case "'": return '&#x27;'
        case '&': return '&amp;'
        default: return match
      }
    })
    // Удаляем потенциально опасные последовательности
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Ограничиваем длину для title
    .slice(0, 200)
}

/**
 * Санитизирует заголовок страницы
 */
export function sanitizeTitle(title: string | undefined | null): string {
  const sanitized = sanitizeString(title)
  // Дополнительная очистка для заголовков
  return sanitized
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Санитизирует URL параметры
 */
export function sanitizeUrlParam(param: string | undefined | null): string {
  if (!param) return ''
  
  return String(param)
    .replace(/[<>'"&]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .slice(0, 100)
}

/**
 * Проверяет, является ли строка безопасной для использования в URL
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false
  
  // Разрешаем только относительные URL и безопасные протоколы
  const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:']
  
  try {
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return true // Относительные URL безопасны
    }
    
    const urlObj = new URL(url)
    return safeProtocols.includes(urlObj.protocol)
  } catch {
    return false
  }
}