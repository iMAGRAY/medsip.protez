// Re-export pool from db-connection for backward compatibility
import { getPool, executeQuery } from './db-connection'

// Export pool instance for backward compatibility
export const pool = getPool()
export { executeQuery }
export const db = getPool()