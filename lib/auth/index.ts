// Database auth
export { 
  createUserSession, 
  validateUserSession, 
  destroyUserSession, 
  authenticateUser, 
  requireAuth as requireUserAuth,
  hasPermission,
  cleanupExpiredSessions
} from './database-auth'
export { AUTH_CONFIG as DATABASE_AUTH_CONFIG } from './database-auth'

// Secure auth (in-memory)
export { 
  createSession, 
  validateSession, 
  destroySession, 
  authenticateAdmin, 
  requireAuth as requireAdminAuth
} from './secure-auth'
export { AUTH_CONFIG as SECURE_AUTH_CONFIG } from './secure-auth'

// Secure DB config
export * from './secure-db-config'