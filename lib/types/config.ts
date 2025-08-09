/**
 * CONFIGURATION TYPES - Типизированная конфигурация для всех сервисов
 * Обеспечивает type safety и автокомплит для конфигурационных параметров
 */

// ========================================================================================
// ENVIRONMENT TYPES
// ========================================================================================
export type Environment = 'development' | 'production' | 'test' | 'staging'

export interface EnvironmentConfig {
  NODE_ENV: Environment
  DATABASE_URL?: string
  REDIS_URL?: string
  S3_ENDPOINT?: string
  S3_ACCESS_KEY?: string
  S3_SECRET_KEY?: string
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'
}

// ========================================================================================
// NETWORK & API CONFIGURATION TYPES
// ========================================================================================
export interface NetworkTimeouts {
  readonly DEFAULT_FETCH: number
  readonly SLOW_OPERATION: number
  readonly QUICK_OPERATION: number
  readonly RECONNECT_DELAY: number
  readonly ABORT_TIMEOUT: number
}

export interface RetryConfig {
  readonly MAX_ATTEMPTS: number
  readonly BACKOFF_BASE: number
  readonly EXPONENTIAL_MULTIPLIER: number
}

export interface RateLimits {
  readonly REQUESTS_PER_MINUTE: number
  readonly BURST_LIMIT: number
}

export interface NetworkConfig {
  readonly TIMEOUTS: NetworkTimeouts
  readonly RETRY: RetryConfig
  readonly RATE_LIMITS: RateLimits
}

// ========================================================================================
// CACHE CONFIGURATION TYPES
// ========================================================================================
export interface CacheTTL {
  readonly SHORT: number      // 5 минут
  readonly MEDIUM: number     // 30 минут
  readonly LONG: number       // 1 час
  readonly DAILY: number      // 24 часа
  readonly WEEKLY: number     // 7 дней
}

export interface CacheLimits {
  readonly MAX_ITEMS: number
  readonly MAX_SIZE_MB: number
  readonly CACHE_SIZE_LIMIT: number
}

export interface RedisConfig {
  readonly HOST: string
  readonly PORT: number
  readonly CONNECT_TIMEOUT: number
  readonly RECONNECT_DELAY: number
  password?: string
  database?: number
}

export interface CacheConfig {
  readonly TTL: CacheTTL
  readonly LIMITS: CacheLimits
  readonly REDIS: RedisConfig
}

// ========================================================================================
// DATABASE CONFIGURATION TYPES
// ========================================================================================
export interface DatabasePool {
  readonly MIN_CONNECTIONS: number
  readonly MAX_CONNECTIONS: number
  readonly IDLE_TIMEOUT: number
  readonly CONNECTION_TIMEOUT: number
  readonly ACQUIRE_TIMEOUT: number
}

export interface DatabaseQuery {
  readonly SLOW_QUERY_THRESHOLD: number
  readonly MAX_QUERY_TIMEOUT: number
  readonly DEFAULT_LIMIT: number
  readonly MAX_LIMIT: number
}

export interface DatabasePagination {
  readonly DEFAULT_PAGE_SIZE: number
  readonly MAX_PAGE_SIZE: number
  readonly LARGE_PAGE_SIZE: number
}

export interface DatabaseConfig {
  readonly POOL: DatabasePool
  readonly QUERY: DatabaseQuery
  readonly PAGINATION: DatabasePagination
}

// ========================================================================================
// MEDIA & FILE CONFIGURATION TYPES
// ========================================================================================
export interface FileLimits {
  readonly MAX_FILE_SIZE: number
  readonly MAX_TOTAL_SIZE: number
  readonly CHUNK_SIZE: number
}

export interface S3Config {
  readonly BUCKET_ID: string
  readonly SIGNED_URL_EXPIRES: number
  readonly UPLOAD_TIMEOUT: number
  endpoint?: string
  accessKey?: string
  secretKey?: string
  region?: string
}

export interface MediaOptimization {
  readonly IMAGE_QUALITY: number
  readonly THUMBNAIL_SIZE: number
  readonly PREVIEW_SIZE: number
  readonly MAX_DIMENSIONS: number
}

export interface MediaConfig {
  readonly FILE_LIMITS: FileLimits
  readonly S3: S3Config
  readonly OPTIMIZATION: MediaOptimization
}

// ========================================================================================
// UI & UX CONFIGURATION TYPES
// ========================================================================================
export interface UITimeouts {
  readonly DEBOUNCE_SEARCH: number
  readonly TOAST_DURATION: number
  readonly LOADING_DELAY: number
  readonly BLUR_DELAY: number
  readonly STATE_UPDATE_DELAY: number
}

export interface UIPagination {
  readonly ITEMS_PER_PAGE: number
  readonly LOAD_MORE_THRESHOLD: number
  readonly INFINITE_SCROLL_THRESHOLD: number
}

export interface UIPerformance {
  readonly VIRTUAL_LIST_BUFFER: number
  readonly MAX_RECENT_QUERIES: number
  readonly THROTTLE_INTERVAL: number
}

export interface UIConfig {
  readonly TIMEOUTS: UITimeouts
  readonly PAGINATION: UIPagination
  readonly PERFORMANCE: UIPerformance
}

// ========================================================================================
// SECURITY CONFIGURATION TYPES
// ========================================================================================
export interface SessionConfig {
  readonly NORMAL_TTL: number
  readonly EXTENDED_TTL: number
  readonly CLEANUP_INTERVAL: number
}

export interface SecurityRateLimiting {
  readonly LOGIN_ATTEMPTS: number
  readonly LOCKOUT_DURATION: number
  readonly API_REQUESTS_PER_MINUTE: number
}

export interface ValidationConfig {
  readonly MIN_PASSWORD_LENGTH: number
  readonly MAX_NAME_LENGTH: number
  readonly MAX_DESCRIPTION_LENGTH: number
  readonly MAX_SLUG_LENGTH: number
  readonly MIN_FOUNDED_YEAR: number
}

export interface SecurityConfig {
  readonly SESSION: SessionConfig
  readonly RATE_LIMITING: SecurityRateLimiting
  readonly VALIDATION: ValidationConfig
}

// ========================================================================================
// BUSINESS LOGIC CONFIGURATION TYPES
// ========================================================================================
export interface CharacteristicsConfig {
  readonly MAX_GROUPS: number
  readonly MAX_VALUES_PER_GROUP: number
  readonly DEFAULT_PRIORITY: number
  readonly MAX_HIERARCHY_DEPTH: number
}

export interface ProductsConfig {
  readonly MAX_IMAGES: number
  readonly MAX_SELECTION_TABLES: number
  readonly DEFAULT_SORT_ORDER: number
  readonly MAX_RELATED_PRODUCTS: number
}

export interface WarehouseConfig {
  readonly MAX_ZONES_PER_WAREHOUSE: number
  readonly MAX_SECTIONS_PER_ZONE: number
  readonly UTILIZATION_THRESHOLD: number
  readonly LOW_STOCK_THRESHOLD: number
}

export interface BusinessConfig {
  readonly CHARACTERISTICS: CharacteristicsConfig
  readonly PRODUCTS: ProductsConfig
  readonly WAREHOUSE: WarehouseConfig
}

// ========================================================================================
// MONITORING CONFIGURATION TYPES
// ========================================================================================
export interface PerformanceThresholds {
  readonly SLOW_COMPONENT_THRESHOLD: number
  readonly SLOW_API_THRESHOLD: number
  readonly MEMORY_WARNING_THRESHOLD: number
  readonly MAX_METRIC_HISTORY: number
}

export interface LoggingConfig {
  readonly LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
  readonly MAX_LOG_SIZE: number
  readonly LOG_ROTATION_DAYS: number
}

export interface MonitoringConfig {
  readonly PERFORMANCE: PerformanceThresholds
  readonly LOGGING: LoggingConfig
}

// ========================================================================================
// COLOR SYSTEM TYPES
// ========================================================================================
export interface SystemColors {
  readonly PRIMARY: string
  readonly SECONDARY: string
  readonly SUCCESS: string
  readonly WARNING: string
  readonly ERROR: string
  readonly INFO: string
}

export interface ProductColors {
  readonly [colorName: string]: string
}

export interface ColorConfig {
  readonly SYSTEM: SystemColors
  readonly PRODUCT_COLORS: ProductColors
}

// ========================================================================================
// UNIFIED APPLICATION CONFIGURATION TYPE
// ========================================================================================
export interface AppConfig {
  readonly NETWORK: NetworkConfig
  readonly CACHE: CacheConfig
  readonly DATABASE: DatabaseConfig
  readonly MEDIA: MediaConfig
  readonly UI: UIConfig
  readonly SECURITY: SecurityConfig
  readonly BUSINESS: BusinessConfig
  readonly MONITORING: MonitoringConfig
  readonly COLORS: ColorConfig
}

// ========================================================================================
// RUNTIME CONFIGURATION TYPES
// ========================================================================================
export interface RuntimeConfig extends AppConfig {
  environment: Environment
  isDevelopment: boolean
  isProduction: boolean
  isTest: boolean
}

// ========================================================================================
// SERVICE-SPECIFIC CONFIGURATION TYPES
// ========================================================================================
export interface ApiClientConfig {
  baseUrl: string
  timeout: number
  retries: number
  headers: Record<string, string>
  rateLimiting: boolean
}

export interface DatabaseClientConfig {
  connectionString: string
  poolConfig: DatabasePool
  queryConfig: DatabaseQuery
  ssl: boolean
  debug: boolean
}

export interface RedisClientConfig {
  host: string
  port: number
  password?: string
  database?: number
  connectTimeout: number
  lazyConnect: boolean
}

export interface S3ClientConfig {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
  region: string
  forcePathStyle: boolean
}

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  format: 'json' | 'pretty'
  output: 'console' | 'file' | 'both'
  maxFileSize: number
  maxFiles: number
}

// ========================================================================================
// VALIDATION SCHEMAS TYPES
// ========================================================================================
export interface ConfigValidator<T> {
  validate(config: unknown): T
  validatePartial(config: unknown): Partial<T>
  merge(base: T, override: Partial<T>): T
}

// ========================================================================================
// FEATURE FLAGS TYPES
// ========================================================================================
export interface FeatureFlags {
  enableNewCharacteristics: boolean
  enableAdvancedSearch: boolean
  enableRealTimeUpdates: boolean
  enablePerformanceMonitoring: boolean
  enableDebugMode: boolean
}

export interface FeatureFlagsConfig {
  flags: FeatureFlags
  provider: 'static' | 'remote' | 'database'
  refreshInterval?: number
}

// ========================================================================================
// ERROR HANDLING TYPES
// ========================================================================================
export interface ErrorHandlingConfig {
  captureUncaughtExceptions: boolean
  captureUnhandledPromiseRejections: boolean
  enableStackTrace: boolean
  maxErrorHistory: number
  errorReportingUrl?: string
}

// Default export
export default AppConfig