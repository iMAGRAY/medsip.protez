/**
 * CENTRALIZED APPLICATION CONFIGURATION
 * Централизованная конфигурация приложения для устранения магических чисел
 */

// ========================================================================================
// NETWORK & API CONFIGURATION
// ========================================================================================
export const NETWORK_CONFIG = {
  // Таймауты для HTTP запросов
  TIMEOUTS: {
    DEFAULT_FETCH: 10_000,           // 10 секунд
    SLOW_OPERATION: 30_000,          // 30 секунд (для больших операций)
    QUICK_OPERATION: 5_000,          // 5 секунд (для быстрых операций)
    RECONNECT_DELAY: 5_000,          // 5 секунд (Redis переподключение)
    ABORT_TIMEOUT: 10_000,           // 10 секунд (AbortController)
  },

  // Retry логика
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_BASE: 1_000,             // 1 секунда базовая задержка
    EXPONENTIAL_MULTIPLIER: 2,       // Экспоненциальный множитель
  },

  // Rate limiting
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: process.env.NODE_ENV === 'production' ? 60 : 300, // 300 req/min для development
    BURST_LIMIT: process.env.NODE_ENV === 'production' ? 10 : 50,          // 50 burst для development
  }
} as const

// ========================================================================================
// CACHE CONFIGURATION
// ========================================================================================
export const CACHE_CONFIG = {
  // TTL для различных типов данных
  TTL: {
    SHORT: 300,                      // 5 минут (временные данные)
    MEDIUM: 1_800,                   // 30 минут (справочники)
    LONG: 3_600,                     // 1 час (статические данные)
    DAILY: 86_400,                   // 24 часа (медиа, файлы)
    WEEKLY: 604_800,                 // 7 дней (архивные данные)
  },

  // Размеры кэша
  LIMITS: {
    MAX_ITEMS: 1_000,
    MAX_SIZE_MB: 50,
    CACHE_SIZE_LIMIT: 100,           // Максимум записей в memory cache
  },

  // Redis конфигурация
  REDIS: {
    HOST: process.env.REDIS_HOST || '77.233.221.46',
    PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    USERNAME: process.env.REDIS_USERNAME || 'default',
    PASSWORD: process.env.REDIS_PASSWORD || 'TIC8lkAAX~ND-u',
    DATABASE: parseInt(process.env.REDIS_DATABASE || '0', 10),
    CONNECT_TIMEOUT: 10_000,
    RECONNECT_DELAY: 5_000,
  }
} as const

// ========================================================================================
// DATABASE CONFIGURATION
// ========================================================================================
export const DATABASE_CONFIG = {
  // Connection pool настройки
  POOL: {
    MIN_CONNECTIONS: 2,
    MAX_CONNECTIONS: 20,
    IDLE_TIMEOUT: 30_000,
    CONNECTION_TIMEOUT: 5_000,
    ACQUIRE_TIMEOUT: 10_000,
  },

  // Query настройки
  QUERY: {
    SLOW_QUERY_THRESHOLD: 1_000,     // 1 секунда для slow query
    MAX_QUERY_TIMEOUT: 30_000,       // 30 секунд максимум
    DEFAULT_LIMIT: 50,               // Лимит по умолчанию для пагинации
    MAX_LIMIT: 1_000,                // Максимальный лимит
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    LARGE_PAGE_SIZE: 50,
  }
} as const

// ========================================================================================
// MEDIA & FILE CONFIGURATION
// ========================================================================================
export const MEDIA_CONFIG = {
  // Размеры файлов
  FILE_LIMITS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100MB
    CHUNK_SIZE: 1024 * 1024,         // 1MB chunks
  },

  // S3 конфигурация
  S3: {
    BUCKET_ID: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET_NAME || "b71e5c4b-4a3b3109-65a0-4e48-b7ad-86e55fabe3b5",
    ENDPOINT: process.env.S3_ENDPOINT || 'https://s3.twcstorage.ru',
    REGION: process.env.S3_REGION || process.env.AWS_REGION || 'ru-1',
    ACCESS_KEY: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || 'IA1BWYIMK9CDTD4H32ZG',
    SECRET_KEY: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'qDtZCRN0t9WIYxEe2PbA7yfT0wcNlom1dIMHMR4p',
    SIGNED_URL_EXPIRES: 3_600,       // 1 час
    UPLOAD_TIMEOUT: 30_000,          // 30 секунд
  },

  // Оптимизация
  OPTIMIZATION: {
    IMAGE_QUALITY: 85,
    THUMBNAIL_SIZE: 200,
    PREVIEW_SIZE: 800,
    MAX_DIMENSIONS: 2048,
  }
} as const

// ========================================================================================
// UI & UX CONFIGURATION
// ========================================================================================
export const UI_CONFIG = {
  // Таймауты UI взаимодействий
  TIMEOUTS: {
    DEBOUNCE_SEARCH: 150,            // Задержка поиска
    TOAST_DURATION: 5_000,           // 5 секунд уведомления
    LOADING_DELAY: 200,              // Задержка показа лоадера
    BLUR_DELAY: 200,                 // Задержка при потере фокуса
    STATE_UPDATE_DELAY: 0,           // Для синхронизации state updates
  },

  // Пагинация UI
  PAGINATION: {
    ITEMS_PER_PAGE: 20,
    LOAD_MORE_THRESHOLD: 5,          // Подгружать когда остается 5 элементов
    INFINITE_SCROLL_THRESHOLD: 200,  // 200px до конца
  },

  // Производительность
  PERFORMANCE: {
    VIRTUAL_LIST_BUFFER: 5,          // Буфер для виртуального списка
    MAX_RECENT_QUERIES: 100,         // Максимум недавних запросов
    THROTTLE_INTERVAL: 300,          // Throttling интервал
  }
} as const

// ========================================================================================
// SECURITY CONFIGURATION
// ========================================================================================
export const SECURITY_CONFIG = {
  // Сессии
  SESSION: {
    NORMAL_TTL: 24 * 60 * 60 * 1000,      // 24 часа
    EXTENDED_TTL: 30 * 24 * 60 * 60 * 1000, // 30 дней
    CLEANUP_INTERVAL: 60 * 60 * 1000,      // 1 час
  },

  // Rate limiting
  RATE_LIMITING: {
    LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000,     // 15 минут
    API_REQUESTS_PER_MINUTE: 100,
  },

  // Validation
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 8,
    MAX_NAME_LENGTH: 255,
    MAX_DESCRIPTION_LENGTH: 2000,
    MAX_SLUG_LENGTH: 100,
    MIN_FOUNDED_YEAR: 1800,
  }
} as const

// ========================================================================================
// BUSINESS LOGIC CONFIGURATION
// ========================================================================================
export const BUSINESS_CONFIG = {
  // Характеристики
  CHARACTERISTICS: {
    MAX_GROUPS: 50,
    MAX_VALUES_PER_GROUP: 100,
    DEFAULT_PRIORITY: 999,
    MAX_HIERARCHY_DEPTH: 10,
  },

  // Продукты
  PRODUCTS: {
    MAX_IMAGES: 20,
    MAX_SELECTION_TABLES: 10,
    DEFAULT_SORT_ORDER: 0,
    MAX_RELATED_PRODUCTS: 12,
  },

  // Warehouse
  WAREHOUSE: {
    MAX_ZONES_PER_WAREHOUSE: 50,
    MAX_SECTIONS_PER_ZONE: 100,
    UTILIZATION_THRESHOLD: 85,       // 85% - высокая загрузка
    LOW_STOCK_THRESHOLD: 10,
  }
} as const

// ========================================================================================
// PERFORMANCE MONITORING
// ========================================================================================
export const MONITORING_CONFIG = {
  // Performance metrics
  PERFORMANCE: {
    SLOW_COMPONENT_THRESHOLD: 500,   // 500ms для медленного компонента
    SLOW_API_THRESHOLD: 1_000,       // 1 секунда для медленного API
    MEMORY_WARNING_THRESHOLD: 100,   // 100MB предупреждение
    MAX_METRIC_HISTORY: 100,         // Максимум записей метрик
  },

  // Logging
  LOGGING: {
    LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    MAX_LOG_SIZE: 10 * 1024 * 1024,  // 10MB лог файл
    LOG_ROTATION_DAYS: 7,
  }
} as const

// ========================================================================================
// COLOR SYSTEM CONFIGURATION
// ========================================================================================
export const COLOR_CONFIG = {
  // Системные цвета
  SYSTEM: {
    PRIMARY: 'rgb(59 130 246)',
    SECONDARY: 'rgb(241 245 249)',
    SUCCESS: 'rgb(34 197 94)',
    WARNING: 'rgb(251 191 36)',
    ERROR: 'rgb(239 68 68)',
    INFO: 'rgb(59 130 246)',
  },

  // Цвета продуктов
  PRODUCT_COLORS: {
    'синий': '#2563EB',
    'красный': '#EF4444',
    'зеленый': '#10B981',
    'черный': '#000000',
    'белый': '#FFFFFF',
    'серый': '#6B7280',
    'камуфляж': '#8B7355',
    'бежевый': '#D2B48C',
    'коричневый': '#8B4513',
  }
} as const

// ========================================================================================
// TYPE EXPORTS
// ========================================================================================
export type NetworkConfig = typeof NETWORK_CONFIG
export type CacheConfig = typeof CACHE_CONFIG
export type DatabaseConfig = typeof DATABASE_CONFIG
export type MediaConfig = typeof MEDIA_CONFIG
export type UIConfig = typeof UI_CONFIG
export type SecurityConfig = typeof SECURITY_CONFIG
export type BusinessConfig = typeof BUSINESS_CONFIG
export type MonitoringConfig = typeof MONITORING_CONFIG
export type ColorConfig = typeof COLOR_CONFIG

// ========================================================================================
// UNIFIED APP CONFIG
// ========================================================================================
export const APP_CONFIG = {
  NETWORK: NETWORK_CONFIG,
  CACHE: CACHE_CONFIG,
  DATABASE: DATABASE_CONFIG,
  MEDIA: MEDIA_CONFIG,
  UI: UI_CONFIG,
  SECURITY: SECURITY_CONFIG,
  BUSINESS: BUSINESS_CONFIG,
  MONITORING: MONITORING_CONFIG,
  COLORS: COLOR_CONFIG,
} as const

export type AppConfig = typeof APP_CONFIG

// ========================================================================================
// ENVIRONMENT-SPECIFIC OVERRIDES
// ========================================================================================
export const getEnvironmentConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    return {
      NETWORK: {
        ...NETWORK_CONFIG,
        TIMEOUTS: {
          ...NETWORK_CONFIG.TIMEOUTS,
          DEFAULT_FETCH: 15_000 as const,     // Больше таймаут в продакшене
        }
      },
      CACHE: {
        ...CACHE_CONFIG,
        TTL: {
          ...CACHE_CONFIG.TTL,
          DAILY: 172_800 as const,            // 48 часов в продакшене
        }
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return {
      CACHE: {
        ...CACHE_CONFIG,
        TTL: {
          ...CACHE_CONFIG.TTL,
          SHORT: 60 as const,                 // Короткий кэш в разработке
        }
      }
    }
  }

  return {}
}

// ========================================================================================
// RUNTIME CONFIG
// ========================================================================================
export const RUNTIME_CONFIG = {
  ...APP_CONFIG,
  ...getEnvironmentConfig()
}