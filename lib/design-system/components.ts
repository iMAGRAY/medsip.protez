/**
 * Стили компонентов Design System
 * Централизованные варианты для всех UI компонентов
 */


// Варианты кнопок (без красных цветов)
export const buttonVariants = {
  default: {
    base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:pointer-events-none disabled:opacity-50",
    variants: {
      primary: "bg-blue-500 text-white hover:bg-blue-600 border border-blue-500",
      secondary: "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200",
      destructive: "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200", // Серый вместо красного
      outline: "border border-gray-200 bg-white hover:bg-gray-50 text-gray-700",
      ghost: "text-gray-600 hover:bg-gray-50 hover:text-gray-700",
      success: "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100",
    }
  }
} as const

// Варианты Badge (без красных цветов)
export const badgeVariants = {
  default: {
    base: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300",
    variants: {
      default: "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100",
      secondary: "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
      destructive: "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200", // Серый вместо красного
      outline: "border-gray-200 text-gray-600 hover:bg-gray-50",
      success: "border-green-200 bg-green-50 text-green-600 hover:bg-green-100",
      warning: "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100",
      info: "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100",
    }
  }
} as const

// Варианты Alert (без красных цветов)
export const alertVariants = {
  default: {
    base: "relative w-full rounded-lg border p-4",
    variants: {
      default: "bg-background text-foreground",
      destructive: "border-slate-300 bg-slate-50 text-slate-700", // Серый вместо красного
      success: "border-green-200 bg-green-50 text-green-700",
      warning: "border-orange-200 bg-orange-50 text-orange-700",
      info: "border-blue-200 bg-blue-50 text-blue-700",
    }
  }
} as const

// Состояния форм (без красных цветов)
export const formStates = {
  default: "border-gray-200 focus:border-blue-400 focus:ring-blue-400/20",
  success: "border-green-300 focus:border-green-400 focus:ring-green-400/20",
  warning: "border-orange-300 focus:border-orange-400 focus:ring-orange-400/20",
  error: "border-slate-300 focus:border-slate-400 focus:ring-slate-400/20", // Серый вместо красного
} as const

// Цветовые схемы для статусов
export const statusColors = {
  active: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-400"
  },
  inactive: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400"
  },
  warning: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-400"
  },
  error: {
    bg: "bg-slate-50",    // Серый вместо красного
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400"
  }
} as const