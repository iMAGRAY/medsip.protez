import { NextRequest, NextResponse } from 'next/server'
import { getCacheManager } from '@/lib/dependency-injection'
import { invalidateRelated } from '@/lib/cache-manager'

export async function POST(request: NextRequest) {
  try {
    const { patterns } = await request.json()

    // Очищаем кэш через cache manager
    const cacheManager = getCacheManager()
    await cacheManager.clear()

    // Очищаем кэш через Redis
    if (patterns && Array.isArray(patterns)) {
      await invalidateRelated(patterns)
    } else {
      // Очищаем все кэши продуктов по умолчанию
      await invalidateRelated([
        'medsip:products:*',
        'products:*',
        'product:*'
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    })
  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}