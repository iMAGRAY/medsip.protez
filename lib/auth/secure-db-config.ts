import { Pool, PoolConfig } from 'pg'
import { config } from 'dotenv'

// Load environment variables
config()

export interface SecureDbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  connectionString?: string
}

export function getSecureDbConfig(): SecureDbConfig {
  // Check for DATABASE_URL first (recommended for production)
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL)
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      connectionString: process.env.DATABASE_URL
    }
  }

  // Fallback to individual environment variables
  const host = process.env.POSTGRESQL_HOST || process.env.PGHOST
  const port = parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432')
  const user = process.env.POSTGRESQL_USER || process.env.PGUSER
  const password = process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD
  const database = process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE

  if (!host || !user || !password || !database) {
    console.error('❌ Missing required database environment variables')
    console.error('Required: POSTGRESQL_HOST, POSTGRESQL_USER, POSTGRESQL_PASSWORD, POSTGRESQL_DBNAME')
    console.error('Or provide: DATABASE_URL')
    process.exit(1)
  }

  return {
    host,
    port,
    user,
    password,
    database,
    connectionString: `postgresql://${user}:${password}@${host}:${port}/${database}`
  }
}

export function createSecurePool(): Pool {
  const config = getSecureDbConfig()

  const poolConfig: PoolConfig = {
    connectionString: config.connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  }
  return new Pool(poolConfig)
}