enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
  data?: any
  context?: string
}

class Logger {
  private isDev = process.env.NODE_ENV !== 'production'
  private logLevel = this.isDev ? LogLevel.DEBUG : LogLevel.INFO

  private formatMessage(_level: string, _message: string, data?: any, context?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data && { data }),
      ...(context && { context })
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel
  }

  private writeLog(entry: LogEntry): void {
    const logStr = this.isDev
      ? `[${entry.timestamp}] ${entry.level}: ${entry.message}${entry.data ? ` ${JSON.stringify(entry.data)}` : ''}`
      : JSON.stringify(entry)

    switch (entry.level) {
      case 'ERROR':
        console.error(logStr)
        break
      case 'WARN':
        console.warn(logStr)
        break
      case 'INFO':
        console.info(logStr)
        break
      case 'DEBUG':
        break
      default:
    }
  }

  debug(message: string, data?: any, context?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.formatMessage('DEBUG', message, data, context))
    }
  }

  info(message: string, data?: any, context?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.formatMessage('INFO', message, data, context))
    }
  }

  warn(message: string, data?: any, context?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.formatMessage('WARN', message, data, context))
    }
  }

  error(message: string, error?: Error | any, context?: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorData = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error
      this.writeLog(this.formatMessage('ERROR', message, errorData, context))
    }
  }

  // Database specific logging
  dbQuery(_query: string, _params?: any[], _duration?: number): void {
    this.debug('Database query executed', { query, params, duration }, 'DATABASE')
  }

  dbError(_query: string, error: Error, _params?: any[]): void {
    this.error('Database query failed', { query, params, error: error.message }, 'DATABASE')
  }

  // API specific logging
  apiRequest(_method: string, _url: string, _userId?: string): void {
    this.info('API request', { method, url, userId }, 'API')
  }

  apiResponse(_method: string, _url: string, _status: number, _duration?: number): void {
    this.info('API response', { method, url, status, duration }, 'API')
  }

  apiError(_method: string, _url: string, error: Error, _userId?: string): void {
    this.error('API error', { method, url, error: error.message, userId }, 'API')
  }

  // Security logging
  securityEvent(_event: string, _data?: any, _userId?: string): void {
    this.warn('Security event', { event, data, userId }, 'SECURITY')
  }

  // Legacy compatibility
  log = this.info
}

export const logger = new Logger()
export default logger
