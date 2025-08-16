import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TABLES = [
  'products',
  'categories',
  'model_series',
  'manufacturers',
  'product_sizes',      // @deprecated: Use product_variants instead
  'product_variants',   // Unified table for product variants
  'product_images',
  'site_settings',
  'product_characteristics',
  'catalog_menu_settings',
  'spec_groups',
  'characteristic_groups',
]

export async function GET(
  _req: Request,
  { params }: { params: { table: string } }
) {
  const { table } = params
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })
  }
  const limit = 50
  try {
    const result = await executeQuery(`SELECT * FROM ${table} ORDER BY 1 LIMIT $1`, [limit])
    return NextResponse.json({ rows: result.rows })
  } catch (error) {
    console.error('Fetch table error:', error)
    return NextResponse.json({ error: 'Failed to fetch table' }, { status: 500 })
  }
}