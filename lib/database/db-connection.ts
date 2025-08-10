import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg"
import { logger } from "../logger"
import { performanceMonitor } from "../performance-monitor"

// Singleton Pool instance
let pool: Pool | null = null

// Add legacy synchronous availability flag for existing routes
let connectionFailed = false

// Environment validation
function validateEnvironment(): void {
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
  validateEnvironment()

  const max = parseInt(process.env.DB_POOL_MAX || '20', 10)
  const idleTimeoutMillis = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10)
  const connectionTimeoutMillis = parseInt(process.env.DB_CONN_TIMEOUT_MS || '15000', 10)
  const query_timeout = parseInt(process.env.DB_QUERY_TIMEOUT_MS || '30000', 10)

  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || process.env.POSTGRESQL_HOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.POSTGRESQL_PORT || 5432),
    user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
    password: process.env.DB_PASSWORD || process.env.POSTGRESQL_PASSWORD || "",
    database: process.env.DB_NAME || process.env.POSTGRESQL_DBNAME || "medsip_protez",
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    query_timeout,
    ssl: (process.env.PGSSL === "true" || process.env.DATABASE_SSL === "true" || process.env.DATABASE_URL?.includes("sslmode=require")) ? { rejectUnauthorized: false } : undefined,
    keepAlive: true,
  }

  logger.info('Connecting to database', {
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: !!config.ssl
  })

  const p = new Pool(config)
  const stmtTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || String(query_timeout), 10)
  p.on('connect', (client) => {
    client.query(`SET application_name TO 'medsip-protez-app'`).catch(() => {})
    if (stmtTimeout > 0) {
      client.query(`SET statement_timeout TO ${stmtTimeout}`).catch(() => {})
      client.query(`SET idle_in_transaction_session_timeout TO ${stmtTimeout}`).catch(() => {})
    }
  })
  return p
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

export function forceResetConnection(): void {
  connectionFailed = false
  if (pool) {
    pool.end().catch(err => logger.error("Error closing pool", err))
    pool = null
  }
  logger.info("Database connection reset")
}

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

export type QueryParam = string | number | boolean | null | undefined | QueryParam[]

function isWriteQuery(sql: string): boolean {
  const q = sql.trim().toUpperCase()
  if (/^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE|GRANT|REVOKE|VACUUM|ANALYZE|LOCK|MERGE|UPSERT)\b/.test(q)) {
    return true
  }
  if (q.startsWith('WITH') && /(INSERT|UPDATE|DELETE)\b/.test(q)) {
    return true
  }
  return false
}

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

export const isDatabaseAvailable = isDatabaseAvailableSync;

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

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
    logger.info("Database pool closed")
  }
}

export function getDatabaseMetrics() {
  return performanceMonitor.getMetrics()
}

export function getDatabaseReport(): string {
  return performanceMonitor.generateReport()
}

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

export const db = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as any
    return real[prop as any]
  }
})
