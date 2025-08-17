// Константы URL и конфигурации для проекта MedSIP-Protez

// API Endpoints
export const API_ENDPOINTS = {
  // Аутентификация
  AUTH: {
    LOGIN: '/api/admin/auth/login',
    LOGOUT: '/api/admin/auth/logout',
    STATUS: '/api/admin/auth/status',
  },

  // Управление пользователями
  USERS: {
    BASE: '/api/admin/users',
    BY_ID: (id: number | string) => `/api/admin/users/${id}`,
  },

  // Роли
  ROLES: {
    BASE: '/api/admin/roles',
  },

  // Продукты
  PRODUCTS: {
    BASE: '/api/products',
    BY_ID: (id: number | string) => `/api/products/${id}`,
    CHARACTERISTICS: (id: number | string) => `/api/products/${id}/characteristics`,
    EXPORT: '/api/products/export',
  },

  // Категории
  CATEGORIES: {
    BASE: '/api/categories',
    FLAT: '/api/categories-flat',
  },

  // Медиа
  MEDIA: {
    BASE: '/api/media',
    CHECK: '/api/media/check',
    DELETE: '/api/media/delete',
    REGISTER: '/api/media/register',
    SYNC: '/api/media/sync',
  },

  // Производители
  MANUFACTURERS: {
    BASE: '/api/manufacturers',
    BY_ID: (id: number | string) => `/api/manufacturers/${id}`,
    MODEL_LINES: (id: number | string) => `/api/manufacturers/${id}/model-lines`,
  },

  // Характеристики
  SPECIFICATIONS: {
    BASE: '/api/specifications',
    AVAILABLE: '/api/specifications/available',
  },

  // Склад
  WAREHOUSE: {
    ANALYTICS: '/api/warehouse/analytics',
    ARTICLES: '/api/warehouse/articles',
    CITIES: '/api/warehouse/cities',
    INVENTORY: '/api/warehouse/inventory',
    MOVEMENTS: '/api/warehouse/movements',
    REGIONS: '/api/warehouse/regions',
    SECTIONS: '/api/warehouse/sections',
    SETTINGS: '/api/warehouse/settings',
    WAREHOUSES: '/api/warehouse/warehouses',
    ZONES: '/api/warehouse/zones',
  },
} as const

// Административные страницы
export const ADMIN_ROUTES = {
  DASHBOARD: '/admin',
  USERS: '/admin/users',
  PRODUCTS: '/admin/products',
  CATEGORIES: '/admin/categories',
  MANUFACTURERS: '/admin/manufacturers',
  SPECIFICATIONS: '/admin/specifications',
  MEDIA: '/admin/media',
  WAREHOUSE: '/admin/warehouse',
  SETTINGS: '/admin/settings',
  REDIS_MONITOR: '/admin/redis-monitor',
} as const

// Публичные страницы
export const PUBLIC_ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  CONTACTS: '/contacts',
  MANUFACTURERS: '/manufacturers',
  PRODUCTS: {
    BY_ID: (id: number | string) => `/products/${id}`,
  },
} as const

// Конфигурация окружения
export const CONFIG = {
  // Базовый URL (определяется из окружения)
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',

  // API URL
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',

  // S3 конфигурация
  S3: {
    ENDPOINT: process.env.S3_ENDPOINT || 'https://s3.amazonaws.com',
    BUCKET: process.env.S3_BUCKET_NAME || 'medsip-protez',
    REGION: process.env.S3_REGION || 'us-east-1',
  },

  // Социальные сети (по умолчанию)
  SOCIAL: {
    VK: 'https://vk.com/medsip_prosthetics',
    TELEGRAM: 'https://t.me/medsip_prosthetics',
    YOUTUBE: 'https://youtube.com/@medsip_prosthetics',
    OK: 'https://ok.ru/medsip.prosthetics',
  },

  // Лимиты
  LIMITS: {
    MAX_PRODUCT_IMAGES: 20,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    PRODUCTS_PER_PAGE: 20,
    MAX_SEARCH_RESULTS: 100,
  },

  // Формат
  DATE_FORMAT: 'dd.MM.yyyy',
  CURRENCY: 'RUB',
  LOCALE: 'ru-RU',
} as const

// Типы для безопасности
export type ApiEndpoint = typeof API_ENDPOINTS
export type AdminRoute = typeof ADMIN_ROUTES
export type PublicRoute = typeof PUBLIC_ROUTES
export type AppConfig = typeof CONFIG

// Утилиты для работы с URL
export const urlHelpers = {
  // Создание полного URL
  getFullUrl: (path: string) => `${CONFIG.BASE_URL}${path}`,

  // Создание API URL
  getApiUrl: (endpoint: string) => `${CONFIG.API_URL}${endpoint}`,

  // Проверка является ли URL локальным
  isLocalUrl: (url: string) => url.startsWith(CONFIG.BASE_URL),

  // Создание URL для продукта
  getProductUrl: (id: number | string) => PUBLIC_ROUTES.PRODUCTS.BY_ID(id),

  // Создание URL для производителя
  getManufacturerUrl: (id: number | string) => ADMIN_ROUTES.MANUFACTURERS + `/${id}`,
} as const

export const RUSSIAN_REGIONS = [
  { code: '01', name: 'Адыгея', fullName: 'Республика Адыгея', federal_district: 'Южный ФО' },
  { code: '02', name: 'Башкортостан', fullName: 'Республика Башкортостан', federal_district: 'Приволжский ФО' },
  { code: '03', name: 'Бурятия', fullName: 'Республика Бурятия', federal_district: 'Дальневосточный ФО' },
  { code: '04', name: 'Алтай', fullName: 'Республика Алтай', federal_district: 'Сибирский ФО' },
  { code: '05', name: 'Дагестан', fullName: 'Республика Дагестан', federal_district: 'Северо-Кавказский ФО' },
  { code: '06', name: 'Ингушетия', fullName: 'Республика Ингушетия', federal_district: 'Северо-Кавказский ФО' },
  { code: '07', name: 'Кабардино-Балкария', fullName: 'Кабардино-Балкарская Республика', federal_district: 'Северо-Кавказский ФО' },
  { code: '08', name: 'Калмыкия', fullName: 'Республика Калмыкия', federal_district: 'Южный ФО' },
  { code: '09', name: 'Карачаево-Черкесия', fullName: 'Карачаево-Черкесская Республика', federal_district: 'Северо-Кавказский ФО' },
  { code: '10', name: 'Карелия', fullName: 'Республика Карелия', federal_district: 'Северо-Западный ФО' },
  { code: '11', name: 'Коми', fullName: 'Республика Коми', federal_district: 'Северо-Западный ФО' },
  { code: '12', name: 'Марий Эл', fullName: 'Республика Марий Эл', federal_district: 'Приволжский ФО' },
  { code: '13', name: 'Мордовия', fullName: 'Республика Мордовия', federal_district: 'Приволжский ФО' },
  { code: '14', name: 'Саха (Якутия)', fullName: 'Республика Саха (Якутия)', federal_district: 'Дальневосточный ФО' },
  { code: '15', name: 'Северная Осетия', fullName: 'Республика Северная Осетия — Алания', federal_district: 'Северо-Кавказский ФО' },
  { code: '16', name: 'Татарстан', fullName: 'Республика Татарстан', federal_district: 'Приволжский ФО' },
  { code: '17', name: 'Тыва', fullName: 'Республика Тыва', federal_district: 'Сибирский ФО' },
  { code: '18', name: 'Удмуртия', fullName: 'Удмуртская Республика', federal_district: 'Приволжский ФО' },
  { code: '19', name: 'Хакасия', fullName: 'Республика Хакасия', federal_district: 'Сибирский ФО' },
  { code: '20', name: 'Чечня', fullName: 'Чеченская Республика', federal_district: 'Северо-Кавказский ФО' },
  { code: '21', name: 'Чувашия', fullName: 'Чувашская Республика', federal_district: 'Приволжский ФО' },
  { code: '22', name: 'Алтайский край', fullName: 'Алтайский край', federal_district: 'Сибирский ФО' },
  { code: '23', name: 'Краснодарский край', fullName: 'Краснодарский край', federal_district: 'Южный ФО' },
  { code: '24', name: 'Красноярский край', fullName: 'Красноярский край', federal_district: 'Сибирский ФО' },
  { code: '25', name: 'Приморский край', fullName: 'Приморский край', federal_district: 'Дальневосточный ФО' },
  { code: '26', name: 'Ставропольский край', fullName: 'Ставропольский край', federal_district: 'Северо-Кавказский ФО' },
  { code: '27', name: 'Хабаровский край', fullName: 'Хабаровский край', federal_district: 'Дальневосточный ФО' },
  { code: '28', name: 'Амурская область', fullName: 'Амурская область', federal_district: 'Дальневосточный ФО' },
  { code: '29', name: 'Архангельская область', fullName: 'Архангельская область', federal_district: 'Северо-Западный ФО' },
  { code: '30', name: 'Астраханская область', fullName: 'Астраханская область', federal_district: 'Южный ФО' },
  { code: '31', name: 'Белгородская область', fullName: 'Белгородская область', federal_district: 'Центральный ФО' },
  { code: '32', name: 'Брянская область', fullName: 'Брянская область', federal_district: 'Центральный ФО' },
  { code: '33', name: 'Владимирская область', fullName: 'Владимирская область', federal_district: 'Центральный ФО' },
  { code: '34', name: 'Волгоградская область', fullName: 'Волгоградская область', federal_district: 'Южный ФО' },
  { code: '35', name: 'Вологодская область', fullName: 'Вологодская область', federal_district: 'Северо-Западный ФО' },
  { code: '36', name: 'Воронежская область', fullName: 'Воронежская область', federal_district: 'Центральный ФО' },
  { code: '37', name: 'Ивановская область', fullName: 'Ивановская область', federal_district: 'Центральный ФО' },
  { code: '38', name: 'Иркутская область', fullName: 'Иркутская область', federal_district: 'Сибирский ФО' },
  { code: '39', name: 'Калининградская область', fullName: 'Калининградская область', federal_district: 'Северо-Западный ФО' },
  { code: '40', name: 'Калужская область', fullName: 'Калужская область', federal_district: 'Центральный ФО' },
  { code: '41', name: 'Камчатский край', fullName: 'Камчатский край', federal_district: 'Дальневосточный ФО' },
  { code: '42', name: 'Кемеровская область', fullName: 'Кемеровская область', federal_district: 'Сибирский ФО' },
  { code: '43', name: 'Кировская область', fullName: 'Кировская область', federal_district: 'Приволжский ФО' },
  { code: '44', name: 'Костромская область', fullName: 'Костромская область', federal_district: 'Центральный ФО' },
  { code: '45', name: 'Курганская область', fullName: 'Курганская область', federal_district: 'Уральский ФО' },
  { code: '46', name: 'Курская область', fullName: 'Курская область', federal_district: 'Центральный ФО' },
  { code: '47', name: 'Ленинградская область', fullName: 'Ленинградская область', federal_district: 'Северо-Западный ФО' },
  { code: '48', name: 'Липецкая область', fullName: 'Липецкая область', federal_district: 'Центральный ФО' },
  { code: '49', name: 'Магаданская область', fullName: 'Магаданская область', federal_district: 'Дальневосточный ФО' },
  { code: '50', name: 'Московская область', fullName: 'Московская область', federal_district: 'Центральный ФО' },
  { code: '51', name: 'Мурманская область', fullName: 'Мурманская область', federal_district: 'Северо-Западный ФО' },
  { code: '52', name: 'Нижегородская область', fullName: 'Нижегородская область', federal_district: 'Приволжский ФО' },
  { code: '53', name: 'Новгородская область', fullName: 'Новгородская область', federal_district: 'Северо-Западный ФО' },
  { code: '54', name: 'Новосибирская область', fullName: 'Новосибирская область', federal_district: 'Сибирский ФО' },
  { code: '55', name: 'Омская область', fullName: 'Омская область', federal_district: 'Сибирский ФО' },
  { code: '56', name: 'Оренбургская область', fullName: 'Оренбургская область', federal_district: 'Приволжский ФО' },
  { code: '57', name: 'Орловская область', fullName: 'Орловская область', federal_district: 'Центральный ФО' },
  { code: '58', name: 'Пензенская область', fullName: 'Пензенская область', federal_district: 'Приволжский ФО' },
  { code: '59', name: 'Пермский край', fullName: 'Пермский край', federal_district: 'Приволжский ФО' },
  { code: '60', name: 'Псковская область', fullName: 'Псковская область', federal_district: 'Северо-Западный ФО' },
  { code: '61', name: 'Ростовская область', fullName: 'Ростовская область', federal_district: 'Южный ФО' },
  { code: '62', name: 'Рязанская область', fullName: 'Рязанская область', federal_district: 'Центральный ФО' },
  { code: '63', name: 'Самарская область', fullName: 'Самарская область', federal_district: 'Приволжский ФО' },
  { code: '64', name: 'Саратовская область', fullName: 'Саратовская область', federal_district: 'Приволжский ФО' },
  { code: '65', name: 'Сахалинская область', fullName: 'Сахалинская область', federal_district: 'Дальневосточный ФО' },
  { code: '66', name: 'Свердловская область', fullName: 'Свердловская область', federal_district: 'Уральский ФО' },
  { code: '67', name: 'Смоленская область', fullName: 'Смоленская область', federal_district: 'Центральный ФО' },
  { code: '68', name: 'Тамбовская область', fullName: 'Тамбовская область', federal_district: 'Центральный ФО' },
  { code: '69', name: 'Тверская область', fullName: 'Тверская область', federal_district: 'Центральный ФО' },
  { code: '70', name: 'Томская область', fullName: 'Томская область', federal_district: 'Сибирский ФО' },
  { code: '71', name: 'Тульская область', fullName: 'Тульская область', federal_district: 'Центральный ФО' },
  { code: '72', name: 'Тюменская область', fullName: 'Тюменская область', federal_district: 'Уральский ФО' },
  { code: '73', name: 'Ульяновская область', fullName: 'Ульяновская область', federal_district: 'Приволжский ФО' },
  { code: '74', name: 'Челябинская область', fullName: 'Челябинская область', federal_district: 'Уральский ФО' },
  { code: '75', name: 'Забайкальский край', fullName: 'Забайкальский край', federal_district: 'Дальневосточный ФО' },
  { code: '76', name: 'Ярославская область', fullName: 'Ярославская область', federal_district: 'Центральный ФО' },
  { code: '77', name: 'Москва', fullName: 'город Москва', federal_district: 'Центральный ФО' },
  { code: '78', name: 'Санкт-Петербург', fullName: 'город Санкт-Петербург', federal_district: 'Северо-Западный ФО' },
  { code: '79', name: 'Еврейская АО', fullName: 'Еврейская автономная область', federal_district: 'Дальневосточный ФО' },
  { code: '83', name: 'Ненецкий АО', fullName: 'Ненецкий автономный округ', federal_district: 'Северо-Западный ФО' },
  { code: '86', name: 'Ханты-Мансийский АО', fullName: 'Ханты-Мансийский автономный округ — Югра', federal_district: 'Уральский ФО' },
  { code: '87', name: 'Чукотский АО', fullName: 'Чукотский автономный округ', federal_district: 'Дальневосточный ФО' },
  { code: '89', name: 'Ямало-Ненецкий АО', fullName: 'Ямало-Ненецкий автономный округ', federal_district: 'Уральский ФО' }
]

export const FEDERAL_DISTRICTS = [
  'Центральный ФО',
  'Северо-Западный ФО',
  'Южный ФО',
  'Северо-Кавказский ФО',
  'Приволжский ФО',
  'Уральский ФО',
  'Сибирский ФО',
  'Дальневосточный ФО'
]