import { NextResponse } from 'next/server'
import { getDatabaseMetrics, getDatabaseReport } from '@/lib/db-connection'
import { performanceMonitor } from '@/lib/performance-monitor'

// Маршрут использует request.url, поэтому должен быть динамическим
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const action = searchParams.get('action')

    // Handle different actions
    if (action === 'reset') {
      performanceMonitor.resetMetrics()
      return NextResponse.json({
        success: true,
        message: 'Performance metrics reset successfully'
      })
    }

    if (action === 'report') {
      const report = getDatabaseReport()

      if (format === 'text') {
        return new Response(report, {
          headers: {
            'Content-Type': 'text/plain',
          },
        })
      }

      return NextResponse.json({
        success: true,
        report
      })
    }

    // Default: return metrics
    const _metrics = getDatabaseMetrics()
    const _recentQueries = performanceMonitor.getRecentQueries(10)
    const _slowQueries = performanceMonitor.getSlowQueries(5)
    const _failedQueries = performanceMonitor.getFailedQueries(5)

    return NextResponse.json({
      success: true,
      data: {
        metrics: _metrics,
        recentQueries: _recentQueries,
        slowQueries: _slowQueries,
        failedQueries: _failedQueries,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get performance metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}