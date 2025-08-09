#!/usr/bin/env node

const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')
const { Pool } = require('pg')
const os = require('os')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })

const OUTPUT_DIR = process.env.DB_AUDIT_OUTPUT || path.join(process.cwd(), 'database', 'reports')

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function nowTs() { return new Date().toISOString().replace(/[:.]/g, '-') }

function buildPool() {
  const connectionString = process.env.DATABASE_URL || (
    `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}` +
    `@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`
  )
  const ssl = process.env.NODE_ENV === 'production' || /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : false
  return new Pool({ connectionString, ssl })
}

async function safeQuery(pool, sql, params = []) {
  try {
    const res = await pool.query(sql, params)
    return { rows: res.rows, error: null }
  } catch (error) {
    return { rows: [], error }
  }
}

async function getRuntimeInfo(pool) {
  const info = {}
  const { rows } = await pool.query(`
    SELECT 
      version(), current_database() AS db, current_user AS usr, inet_server_addr()::text AS host, inet_server_port()::int AS port, now() AS now
  `)
  Object.assign(info, rows[0])

  const settingsNames = [
    'max_connections','shared_buffers','work_mem','maintenance_work_mem','effective_cache_size',
    'autovacuum','autovacuum_vacuum_scale_factor','autovacuum_analyze_scale_factor','autovacuum_vacuum_threshold','autovacuum_analyze_threshold',
    'random_page_cost','seq_page_cost','timezone'
  ]
  const s = await pool.query(`SELECT name, setting FROM pg_settings WHERE name = ANY($1) ORDER BY name`, [settingsNames])
  info.settings = s.rows

  const ext = await safeQuery(pool, `SELECT extname FROM pg_extension ORDER BY 1`)
  info.extensions = ext.rows.map(r => r.extname)

  return info
}

async function getTables(pool) {
  const sql = `
    SELECT c.relname AS table_name,
           n.nspname AS schema,
           c.reltuples::bigint AS est_rows,
           pg_total_relation_size(c.oid) AS total_bytes,
           pg_relation_size(c.oid) AS table_bytes,
           (pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
  `
  const { rows } = await pool.query(sql)
  return rows
}

async function getIndexes(pool) {
  const sql = `
    SELECT
      s.schemaname,
      s.relname AS table_name,
      s.indexrelname AS index_name,
      s.idx_scan,
      i.indexdef
    FROM pg_stat_user_indexes s
    JOIN pg_indexes i ON (i.schemaname = s.schemaname AND i.tablename = s.relname AND i.indexname = s.indexrelname)
    ORDER BY s.relname, s.idx_scan DESC
  `
  const { rows } = await pool.query(sql)
  return rows
}

async function getForeignKeys(pool) {
  const sql = `
    SELECT
      c.conname AS fk_name,
      confrelid::regclass::text AS ref_table,
      conrelid::regclass::text AS table_name,
      pg_get_constraintdef(c.oid) AS definition,
      (
        SELECT array_agg(a.attname ORDER BY a.attnum)
        FROM unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) AS columns
    FROM pg_constraint c
    WHERE c.contype = 'f'
    ORDER BY conrelid::regclass::text
  `
  const { rows } = await pool.query(sql)
  return rows
}

function normalizeColumns(value) {
  if (Array.isArray(value)) return value.map(v => String(v))
  if (value == null) return []
  if (typeof value === 'string') {
    const trimmed = value.replace(/^\{/, '').replace(/\}$/, '')
    if (trimmed === '') return []
    return trimmed.split(',').map(s => s.trim()).filter(Boolean)
  }
  try {
    return Array.from(value).map(String)
  } catch {
    return []
  }
}

async function findMissingFkIndexes(pool, fks) {
  // Build map of existing indexes per table with column list
  const idxSql = `
    SELECT 
      t.relname AS table_name,
      i.relname AS index_name,
      array_agg(a.attname ORDER BY a.attnum) FILTER (WHERE a.attnum IS NOT NULL) AS columns
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid
    LEFT JOIN LATERAL unnest(x.indkey) AS k(attnum) ON TRUE
    LEFT JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = k.attnum
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.relname, i.relname
  `
  const { rows: idxRows } = await pool.query(idxSql)
  const tableToIndexes = new Map()
  for (const r of idxRows) {
    const key = r.table_name
    const arr = tableToIndexes.get(key) || []
    arr.push({ index_name: r.index_name, columns: normalizeColumns(r.columns) })
    tableToIndexes.set(key, arr)
  }

  const missing = []
  for (const fk of fks) {
    const idxs = tableToIndexes.get(fk.table_name) || []
    const cols = normalizeColumns(fk.columns)
    if (cols.length === 0) continue
    const has = idxs.some(ix => {
      if (!ix.columns || ix.columns.length === 0) return false
      if (ix.columns.length < cols.length) return false
      for (let i = 0; i < cols.length; i++) {
        if (ix.columns[i] !== cols[i]) return false
      }
      return true
    })
    if (!has) {
      missing.push({ table: fk.table_name, columns: cols, fk_name: fk.fk_name })
    }
  }
  return missing
}

function buildIndexName(table, columns) {
  return `${table}_${columns.join('_')}_idx`
}

function ddlCreateIndex(table, columns, concurrently = true) {
  const idx = buildIndexName(table, columns)
  return `CREATE INDEX ${concurrently ? 'CONCURRENTLY ' : ''}${idx} ON ${table} (${columns.join(', ')});`
}

function pick(a, keys) { const o = {}; for (const k of keys) o[k] = a[k]; return o }

async function detectCodeUsageIndexes(pool) {
  const candidates = [
    { table: 'products', columns: ['category_id'] },
    { table: 'products', columns: ['manufacturer_id'] },
    { table: 'products', columns: ['is_active'] },
    { table: 'product_variants', columns: ['master_id'] },
    { table: 'product_variants', columns: ['is_active'] },
    { table: 'product_images', columns: ['product_id', 'image_order'] },
    { table: 'product_images', columns: ['product_id', 'is_main'] },
    { table: 'order_items', columns: ['order_id'] },
    { table: 'variant_tag_relations', columns: ['variant_id'] },
    { table: 'variant_tag_relations', columns: ['tag_id'] },
    { table: 'product_tags', columns: ['product_id'] },
    { table: 'product_tags', columns: ['variant_id'] },
    { table: 'warehouse_inventory', columns: ['product_id'] },
    { table: 'warehouse_inventory', columns: ['section_id'] },
    { table: 'warehouse_sections', columns: ['zone_id'] },
    { table: 'warehouse_zones', columns: ['warehouse_id'] },
    { table: 'warehouse_warehouses', columns: ['city_id'] },
  ]

  // Existing indexes: collect sets of leading column sequences per table
  const idxSql = `
    SELECT t.relname AS table_name,
           i.relname AS index_name,
           array_agg(a.attname ORDER BY a.attnum) FILTER (WHERE a.attnum IS NOT NULL) AS columns
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid
    LEFT JOIN LATERAL unnest(x.indkey) AS k(attnum) ON TRUE
    LEFT JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = k.attnum
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.relname, i.relname
  `
  const { rows } = await pool.query(idxSql)
  const tableToIndexCols = new Map()
  for (const r of rows) {
    const cols = normalizeColumns(r.columns)
    const list = tableToIndexCols.get(r.table_name) || []
    list.push(cols)
    tableToIndexCols.set(r.table_name, list)
  }

  const missing = []
  for (const c of candidates) {
    const list = tableToIndexCols.get(c.table) || []
    const has = list.some(cols => {
      if (cols.length < c.columns.length) return false
      for (let i = 0; i < c.columns.length; i++) {
        if (cols[i] !== c.columns[i]) return false
      }
      return true
    })
    if (!has) missing.push(c)
  }
  return missing
}

async function checkMissingTables(pool) {
  const expected = [
    'product_specifications',
    'product_variants',
    'product_images',
    'product_categories',
    'orders', 'order_items',
    'warehouse_inventory', 'warehouse_sections', 'warehouse_zones', 'warehouse_warehouses', 'warehouse_cities', 'warehouse_regions',
    'product_tags', 'variant_tag_relations'
  ]
  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type='BASE TABLE'
  `)
  const have = new Set(rows.map(r => r.table_name))
  const missing = expected.filter(t => !have.has(t))
  return { missing, have: Array.from(have) }
}

async function getVacuumStats(pool) {
  const { rows } = await pool.query(`
    SELECT relname AS table_name, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
    FROM pg_stat_user_tables ORDER BY n_dead_tup DESC
  `)
  return rows
}

async function main() {
  ensureDirSync(OUTPUT_DIR)
  const pool = buildPool()
  const startedAt = new Date().toISOString()
  const report = { startedAt }

  try {
    const [info, tables, indexes, fks, vac] = await Promise.all([
      getRuntimeInfo(pool),
      getTables(pool),
      getIndexes(pool),
      getForeignKeys(pool),
      getVacuumStats(pool)
    ])

    report.info = info
    report.tables = tables.map(t => ({
      table: t.table_name,
      est_rows: Number(t.est_rows),
      total_bytes: Number(t.total_bytes),
      table_bytes: Number(t.table_bytes),
      index_bytes: Number(t.index_bytes)
    }))

    report.indexes = indexes.map(ix => pick(ix, ['table_name','index_name','idx_scan','indexdef']))
    report.foreignKeys = fks
    report.vacuum = vac

    // Missing FK indexes
    report.missingFkIndexes = await findMissingFkIndexes(pool, fks)

    // Code usage based indexes
    report.recommendedIndexes = await detectCodeUsageIndexes(pool)

    // Missing tables referenced by code
    report.schemaGaps = await checkMissingTables(pool)

    // Build SQL for indexes
    const ddl = []
    for (const m of report.missingFkIndexes) {
      ddl.push(ddlCreateIndex(m.table, m.columns))
    }
    for (const r of report.recommendedIndexes) {
      ddl.push(ddlCreateIndex(r.table, r.columns))
    }

    // Output files
    const ts = nowTs()
    const jsonPath = path.join(OUTPUT_DIR, `db-audit-${ts}.json`)
    const sqlPath = path.join(OUTPUT_DIR, `db-audit-indexes-${ts}.sql`)
    const mdPath = path.join(OUTPUT_DIR, `db-audit-${ts}.md`)

    await fsp.writeFile(jsonPath, JSON.stringify(report, null, 2))
    await fsp.writeFile(sqlPath, ddl.join(os.EOL) + os.EOL)

    // Markdown summary
    const topTables = [...report.tables].sort((a,b)=>b.total_bytes-a.total_bytes).slice(0, 15)
    const lines = []
    lines.push(`# DB Audit Summary (${ts})`)
    lines.push('')
    lines.push(`- DB: ${info.db} / User: ${info.usr} / Host: ${info.host}:${info.port}`)
    lines.push(`- Extensions: ${info.extensions.join(', ') || '—'}`)
    lines.push('')
    lines.push('## Largest tables')
    for (const t of topTables) {
      const mb = (t.total_bytes/1024/1024).toFixed(1)
      lines.push(`- ${t.table}: ~${t.est_rows} rows, ${mb} MB (index ${(t.index_bytes/1024/1024).toFixed(1)} MB)`) 
    }
    lines.push('')
    lines.push('## Missing FK indexes')
    if (report.missingFkIndexes.length === 0) lines.push('- None')
    for (const m of report.missingFkIndexes) {
      lines.push(`- ${m.table}(${m.columns.join(', ')})`) 
    }
    lines.push('')
    lines.push('## Recommended indexes by code usage patterns')
    if (report.recommendedIndexes.length === 0) lines.push('- None')
    for (const r of report.recommendedIndexes) {
      lines.push(`- ${r.table}(${r.columns.join(', ')})`) 
    }
    lines.push('')
    lines.push('## Missing tables expected by API')
    if (report.schemaGaps.missing.length === 0) lines.push('- None')
    for (const t of report.schemaGaps.missing) lines.push(`- ${t}`)

    await fsp.writeFile(mdPath, lines.join(os.EOL))

    console.log(`✅ Audit complete`)
    console.log(`- JSON: ${jsonPath}`)
    console.log(`- SQL:  ${sqlPath}`)
    console.log(`- MD:   ${mdPath}`)

  } catch (error) {
    console.error('❌ Audit failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  main()
}