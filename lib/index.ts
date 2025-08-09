// Core utilities
export * from './utils'
export * from './validation'
export * from './logger'

// Config (with renamed exports to avoid conflicts)
export type { AppConfig as ConstantsAppConfig } from './constants'
export type { AppConfig as ConfigAppConfig } from './app-config'

// Database
export * from './database'

// Authentication
export * from './auth'

// Services
export * from './services'

// Clients
export * from './clients'

// Contexts
export * from './contexts'

// Admin
export * from './admin-data'
export * from './admin-store'

// Cache
export { SecureCacheManager, apiCache as secureCacheManager } from './cache-manager'
export * from './api-cache-headers'

// Performance
export * from './performance-monitor'

// Legacy compatibility (to be removed)
export * from './data'
export * from './fallback-image'
export * from './file-hash'
export * from './main-parameters-utils'
export * from './theme-colors'
export * from './dependency-injection'