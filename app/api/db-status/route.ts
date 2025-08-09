import { NextResponse } from 'next/server'
import { testConnection } from '@/lib/db-connection'

export async function GET() {
  try {
    // Проверяем соединение с БД
    const isConnected = await testConnection()

    if (isConnected) {
      return NextResponse.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Database status check failed:', error)

    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}