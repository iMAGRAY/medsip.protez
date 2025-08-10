import { NextResponse } from 'next/server'
import { executeQuery, testConnection, isDatabaseAvailable } from '@/lib/db-connection'

export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

export async function guardDbOr503(): Promise<NextResponse | null> {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
  }
  const ok = await testConnection().catch(() => false)
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 503 })
  }
  return null
}

export function guardDbOr503Fast(): NextResponse | null {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
  }
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 503 })
  }
  return null
}

export async function tablesExist(tableNames: string[]): Promise<Record<string, boolean>> {
  if (!tableNames || tableNames.length === 0) return {}
  const placeholders = tableNames.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN (${placeholders})
  `
  const res = await executeQuery(sql, tableNames)
  const set = new Set(res.rows.map((r: any) => r.table_name))
  const map: Record<string, boolean> = {}
  for (const t of tableNames) map[t] = set.has(t)
  return map
}

export async function columnsExist(table: string, columns: string[]): Promise<Record<string, boolean>> {
  if (!columns || columns.length === 0) return {}
  const sql = `
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name = $1 AND column_name = ANY($2)
  `
  const res = await executeQuery(sql, [table, columns])
  const set = new Set(res.rows.map((r: any) => r.column_name))
  const map: Record<string, boolean> = {}
  for (const c of columns) map[c] = set.has(c)
  return map
}

export function okEmpty(dataKey: string = 'data', extra: Record<string, any> = {}) {
  return NextResponse.json({ success: true, [dataKey]: Array.isArray(extra[dataKey]) ? extra[dataKey] : [], ...extra })
}