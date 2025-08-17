import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  try {
    // Проверяем структуру таблиц
    const tables = {
      product_categories: await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'product_categories'
        ORDER BY ordinal_position
      `),
      characteristics_values_simple: await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'characteristics_values_simple'
        ORDER BY ordinal_position
      `),
      product_variants: await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'product_variants'
        ORDER BY ordinal_position
      `)
    }
    
    return NextResponse.json({
      success: true,
      schema: {
        product_categories: tables.product_categories.rows,
        characteristics_values_simple: tables.characteristics_values_simple.rows,
        product_variants: tables.product_variants.rows
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}