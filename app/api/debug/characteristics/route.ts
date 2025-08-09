import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')
    
    // Проверяем количество товаров в категории
    const productsQuery = categoryId 
      ? `SELECT COUNT(*) as count FROM products WHERE category_id = $1 AND is_deleted = false`
      : `SELECT COUNT(*) as count FROM products WHERE is_deleted = false`
    
    const productsResult = await pool.query(productsQuery, categoryId ? [categoryId] : [])
    
    // Проверяем количество характеристик для товаров
    const characteristicsQuery = categoryId
      ? `
        SELECT COUNT(DISTINCT pcs.id) as count 
        FROM product_characteristics_simple pcs
        INNER JOIN products p ON pcs.product_id = p.id
        WHERE p.category_id = $1 AND p.is_deleted = false
      `
      : `
        SELECT COUNT(DISTINCT pcs.id) as count 
        FROM product_characteristics_simple pcs
        INNER JOIN products p ON pcs.product_id = p.id
        WHERE p.is_deleted = false
      `
    
    const characteristicsResult = await pool.query(characteristicsQuery, categoryId ? [categoryId] : [])
    
    // Проверяем структуру таблиц
    const tablesQuery = `
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name IN (
        'product_characteristics_simple',
        'characteristics_values_simple',
        'characteristics_groups_simple'
      )
      ORDER BY table_name, ordinal_position
    `
    
    const tablesResult = await pool.query(tablesQuery)
    
    // Пример характеристик
    const sampleQuery = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.category_id,
        pcs.value_id,
        cv.value,
        cg.name as group_name
      FROM products p
      LEFT JOIN product_characteristics_simple pcs ON p.id = pcs.product_id
      LEFT JOIN characteristics_values_simple cv ON pcs.value_id = cv.id
      LEFT JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
      WHERE p.is_deleted = false
      ${categoryId ? 'AND p.category_id = $1' : ''}
      LIMIT 10
    `
    
    const sampleResult = await pool.query(sampleQuery, categoryId ? [categoryId] : [])
    
    return NextResponse.json({
      success: true,
      data: {
        productsCount: productsResult.rows[0].count,
        characteristicsCount: characteristicsResult.rows[0].count,
        tables: tablesResult.rows,
        sampleData: sampleResult.rows
      }
    })
    
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Debug failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}