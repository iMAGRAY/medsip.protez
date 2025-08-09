import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { variantId = 106, testData } = await request.json()
    
    // First, check if variant exists
    const checkResult = await pool.query(
      'SELECT * FROM product_variants WHERE id = $1',
      [variantId]
    )
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Variant not found',
        variantId
      })
    }
    
    const currentVariant = checkResult.rows[0]
    
    // Test simple update with minimal data
    const testPayload = testData || {
      name: 'Test Update ' + new Date().toISOString(),
      price: 99.99
    }
    
    // Log current state
    logger.info('Current variant state:', {
      id: currentVariant.id,
      name: currentVariant.name,
      price: currentVariant.price,
      is_deleted: currentVariant.is_deleted
    })
    
    // Try update
    try {
      const updateResult = await pool.query(
        `UPDATE product_variants 
         SET name = $1, price = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [testPayload.name, testPayload.price, variantId]
      )
      
      return NextResponse.json({
        success: true,
        message: 'Update successful',
        original: {
          name: currentVariant.name,
          price: currentVariant.price
        },
        updated: {
          name: updateResult.rows[0].name,
          price: updateResult.rows[0].price
        }
      })
    } catch (updateError) {
      logger.error('Update failed:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Update failed',
        details: updateError instanceof Error ? updateError.message : 'Unknown error',
        code: (updateError as any)?.code,
        hint: (updateError as any)?.hint
      }, { status: 500 })
    }
    
  } catch (error) {
    logger.error('Test endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}