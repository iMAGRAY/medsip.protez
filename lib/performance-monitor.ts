import { logger } from './logger'
import { RUNTIME_CONFIG } from './app-config'

interface PerformanceMetrics {
  totalQueries: number
  totalDuration: number
  averageDuration: number
  slowQueries: number
  errorCount: number
  lastReset: Date
}

interface QueryMetric {
  query: string
  duration: number
  timestamp: Date
  success: boolean
  error?: string
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    totalQueries: 0,
    totalDuration: 0,
    averageDuration: 0,
    slowQueries: 0,
    errorCount: 0,
    lastReset: new Date()
  }

  private recentQueries: QueryMetric[] = []
  private readonly maxRecentQueries = RUNTIME_CONFIG.MONITORING.PERFORMANCE.MAX_METRIC_HISTORY
  private readonly slowQueryThreshold = RUNTIME_CONFIG.MONITORING.PERFORMANCE.SLOW_API_THRESHOLD

  recordQuery(query: string, duration: number, success: boolean = true, error?: string): void {
    // Update metrics
    this.metrics.totalQueries++
    this.metrics.totalDuration += duration
    this.metrics.averageDuration = this.metrics.totalDuration / this.metrics.totalQueries

    if (duration > this.slowQueryThreshold) {
      this.metrics.slowQueries++
      logger.warn('Slow query detected', { query, duration, threshold: this.slowQueryThreshold })
    }

    if (!success) {
      this.metrics.errorCount++
    }

    // Store recent query
    const queryMetric: QueryMetric = {
      query,
      duration,
      timestamp: new Date(),
      success,
      error
    }

    this.recentQueries.push(queryMetric)

    // Keep only recent queries
    if (this.recentQueries.length > this.maxRecentQueries) {
      this.recentQueries.shift()
    }

    // Log performance warning if needed
    if (this.metrics.errorCount > 10 && this.metrics.errorCount % 10 === 0) {
      logger.warn('High error rate detected', {
        errorCount: this.metrics.errorCount,
        totalQueries: this.metrics.totalQueries,
        errorRate: (this.metrics.errorCount / this.metrics.totalQueries * 100).toFixed(2) + '%'
      })
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getRecentQueries(limit: number = 10): QueryMetric[] {
    return this.recentQueries.slice(-limit)
  }

  getSlowQueries(limit: number = 10): QueryMetric[] {
    return this.recentQueries
      .filter(q => q.duration > this.slowQueryThreshold)
      .slice(-limit)
  }

  getFailedQueries(limit: number = 10): QueryMetric[] {
    return this.recentQueries
      .filter(q => !q.success)
      .slice(-limit)
  }

  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      totalDuration: 0,
      averageDuration: 0,
      slowQueries: 0,
      errorCount: 0,
      lastReset: new Date()
    }
    this.recentQueries = []
    logger.info('Performance metrics reset')
  }

  generateReport(): string {
    const metrics = this.getMetrics()
    const uptime = Date.now() - metrics.lastReset.getTime()
    const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2)

    return `
📊 Performance Report
====================
⏱️  Uptime: ${uptimeHours} hours
🔍 Total Queries: ${metrics.totalQueries}
⚡ Average Duration: ${metrics.averageDuration.toFixed(2)}ms
🐌 Slow Queries: ${metrics.slowQueries} (${(metrics.slowQueries / metrics.totalQueries * 100).toFixed(1)}%)
❌ Errors: ${metrics.errorCount} (${(metrics.errorCount / metrics.totalQueries * 100).toFixed(1)}%)
📈 QPS: ${(metrics.totalQueries / (uptime / 1000)).toFixed(2)}
    `.trim()
  }
}

export const performanceMonitor = new PerformanceMonitor()

// Utility function to measure execution time
export function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now()
  return fn().then(
    result => ({ result, duration: Date.now() - start }),
    error => {
      const duration = Date.now() - start
      throw { error, duration }
    }
  )
}

// Decorator for measuring function execution time
export function timed<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    const start = Date.now()
    try {
      const result = await fn(...args)
      const duration = Date.now() - start
      logger.debug('Function execution completed', {
        function: fn.name,
        duration,
        args: args.length
      })
      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error('Function execution failed', {
        function: fn.name,
        duration,
        args: args.length,
        error
      })
      throw error
    }
  }) as T
}