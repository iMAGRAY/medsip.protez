// Re-export pool from db-connection for backward compatibility
import { getPool, executeQuery } from './db-connection'
import type { Pool } from 'pg'

// Export lazy pool instance via Proxy to avoid connection during build stage
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as any
    return real[prop as any]
  }
})

export { executeQuery }

// Also export db alias lazily
export const db = pool