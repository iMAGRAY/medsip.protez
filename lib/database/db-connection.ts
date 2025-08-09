import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg"
import { logger } from "../logger"
import { performanceMonitor } from "../performance-monitor"

// Singleton Pool instance
let pool: Pool | null = null

// Add legacy synchronous availability flag for existing routes
let connectionFailed = false

// Environment validation
function validateEnvironment(): void {
  // Разрешаем: либо DATABASE_URL, либо набор POSTGRESQL_HOST/USER/DBNAME
  const hasDatabaseUrl = !!process.env.DATABASE_URL
  const hasPgParts = !!(process.env.POSTGRESQL_HOST && process.env.POSTGRESQL_USER && process.env.POSTGRESQL_DBNAME)
  if (!hasDatabaseUrl && !hasPgParts) {
    const missing: string[] = []
    if (!hasDatabaseUrl) missing.push('DATABASE_URL|POSTGRESQL_HOST+POSTGRESQL_USER+POSTGRESQL_DBNAME')
    logger.error('Missing required environment variables', { missing })
    logger.info('Please create .env.local file based on .env.example')
    throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  }
}

function createPool(): Pool {
  // Validate environment first
  validateEnvironment()

  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || process.env.POSTGRESQL_HOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.POSTGRESQL_PORT || 5432),
    user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
    password: process.env.DB_PASSWORD || process.env.POSTGRESQL_PASSWORD || "",
    database: process.env.DB_NAME || process.env.POSTGRESQL_DBNAME || "medsip_protez",
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    query_timeout: 30_000,
    ssl: (process.env.PGSSL === "true" || process.env.DATABASE_SSL === "true" || process.env.DATABASE_URL?.includes("sslmode=require")) ? { rejectUnauthorized: false } : undefined,
  }

  logger.info('Connecting to database', {
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: !!config.ssl
  })

  return new Pool(config)
}

export function getPool(): Pool {
  if (!pool) {
    pool = createPool()
    pool.on("error", (err) => {
      logger.error("PostgreSQL Pool error", err)
      connectionFailed = true
    })
    pool.on("connect", () => {
      logger.debug("New database connection established")
    })
  }
  return pool
}

export function isDatabaseAvailableSync(): boolean {
  return !connectionFailed
}

// Force reset connection function
export function forceResetConnection(): void {
  connectionFailed = false
  if (pool) {
    pool.end().catch(err => logger.error("Error closing pool", err))
    pool = null
  }
  logger.info("Database connection reset")
}

// Test connection function
export async function testConnection(): Promise<boolean> {
  const startTime = Date.now()
  try {
    const db = getPool()
    await db.query("SELECT 1")
    connectionFailed = false
    const duration = Date.now() - startTime
    logger.info("Database connection test successful", { duration })
    performanceMonitor.recordQuery("SELECT 1", duration, true)
    return true
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error("Database connection test failed", error, 'DATABASE')
    performanceMonitor.recordQuery("SELECT 1", duration, false, (error as Error).message)
    connectionFailed = true
    return false
  }
}

// Типы для параметров запросов (включая массивы)
export type QueryParam = string | number | boolean | null | undefined | QueryParam[]

// Простая защита от записывающих запросов в режиме READONLY_SQL
function isWriteQuery(sql: string): boolean {
  const q = sql.trim().toUpperCase()
  // Разрешаем SELECT/VALUES/SHOW/EXPLAIN/WITH (без DML) и CALL? По умолчанию блокируем типичные DML/DDL
  if (/^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE|GRANT|REVOKE|VACUUM|ANALYZE|LOCK|MERGE|UPSERT)\b/.test(q)) {
    return true
  }
  // WITH ... INSERT/UPDATE - грубая проверка на вхождение операций
  if (q.startsWith('WITH') && /(INSERT|UPDATE|DELETE)\b/.test(q)) {
    return true
  }
  return false
}

// Улучшенная типизация для executeQuery
export async function executeQuery<T extends QueryResultRow = QueryResultRow>(
  query: string,
  params: QueryParam[] = []
): Promise<QueryResult<T>> {
  const startTime = Date.now()
  try {
    const db = getPool()

    if (process.env.READONLY_SQL === 'true' && isWriteQuery(query)) {
      const err = new Error('Write operation blocked by READONLY_SQL mode')
      logger.error('Blocked write query in READONLY_SQL mode', { query: query.substring(0, 120) + '...' })
      throw err
    }

    logger.info('Database query starting', {
      query: query.substring(0, 100) + '...',
      paramsCount: params?.length || 0,
      poolTotalCount: db.totalCount,
      poolIdleCount: db.idleCount,
      poolWaitingCount: db.waitingCount
    })

    const result = await db.query<T>(query, params)
    const duration = Date.now() - startTime
    connectionFailed = false

    logger.info('Database query completed', {
      query: query.substring(0, 100) + '...',
      duration,
      rowCount: result.rowCount,
      poolTotalCount: db.totalCount,
      poolIdleCount: db.idleCount,
      poolWaitingCount: db.waitingCount
    })

    logger.dbQuery(query, params, duration)
    performanceMonitor.recordQuery(query, duration, true)

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = (error as Error).message
    const db = getPool()

    logger.error('Database query error', {
      error: error,
      query: query.substring(0, 100) + '...',
      params: params?.length || 0,
      duration,
      poolTotalCount: db.totalCount,
      poolIdleCount: db.idleCount,
      poolWaitingCount: db.waitingCount,
      errorCode: (error as any).code,
      errorMessage: errorMessage
    }, 'DB')

    logger.dbError(query, error as Error, params)
    performanceMonitor.recordQuery(query, duration, false, errorMessage)
    connectionFailed = true
    throw error
  }
}

// Legacy alias used in routes (synchronous)
export const isDatabaseAvailable = isDatabaseAvailableSync;

// Asynchronous deep health-check (can be used in cron/monitoring)
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const db = getPool()
    await db.query("SELECT 1")
    return true
  } catch (error) {
    logger.error("Database health check failed", error)
    return false
  }
}

// Graceful shutdown (useful for tests / Vercel edge)
export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
    logger.info("Database pool closed")
  }
}

// Get performance metrics
export function getDatabaseMetrics() {
  return performanceMonitor.getMetrics()
}

// Get performance report
export function getDatabaseReport(): string {
  return performanceMonitor.generateReport()
}

// Database service interface for backward compatibility
export interface DbSiteSettings {
  id: number
  site_name: string
  site_description: string | null
  hero_title: string | null
  hero_subtitle: string | null
  hero_cta: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  social_links: any
  created_at: string
  updated_at: string
}

export interface DbCategory {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbFeature {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DatabaseProduct {
  id: number
  name: string
  category_id: number
  description: string | null
  image_url: string | null
  images: string | null
  weight: string | null
  battery_life: string | null
  warranty: string | null
  in_stock: boolean
  materials?: string[]
  features?: string[]
  category_name?: string
  created_at: Date
  updated_at: Date
}

// Экспорт pool для совместимости (ленивая инициализация через Proxy)
export const db = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as any
    return real[prop as any]
  }
})
