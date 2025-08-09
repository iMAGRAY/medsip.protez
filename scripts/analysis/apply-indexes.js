#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })

function buildPool() {
  const connectionString = process.env.DATABASE_URL || (
    `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}` +
    `@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`
  )
  const ssl = process.env.NODE_ENV === 'production' || /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : false
  return new Pool({ connectionString, ssl })
}

function parseIndexName(sqlLine) {
  const m = sqlLine.match(/CREATE\s+INDEX\s+(?:CONCURRENTLY\s+)?([^\s]+)\s+ON\s+([^(\s]+)\s*\(([^)]+)\)/i)
  if (!m) return null
  return { indexName: m[1], table: m[2], columns: m[3].split(',').map(s => s.trim()) }
}

async function indexExists(pool, indexName) {
  const { rows } = await pool.query(`SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1`, [indexName])
  return rows.length > 0
}

async function applyFile(pool, filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/;\s*\n|;\s*$/).map(s => s.trim()).filter(Boolean)
  console.log(`Found ${lines.length} statements`)
  let applied = 0, skipped = 0, failed = 0

  for (const stmt of lines) {
    const meta = parseIndexName(stmt)
    if (!meta) {
      console.log('Skip non-index statement or unparsable line')
      continue
    }
    if (await indexExists(pool, meta.indexName)) {
      console.log(`Skip existing index: ${meta.indexName}`)
      skipped++
      continue
    }
    const sql = stmt.endsWith(';') ? stmt : stmt + ';'
    try {
      console.log(`Creating ${meta.indexName} ON ${meta.table}(${meta.columns.join(',')})`)
      await pool.query(sql)
      applied++
    } catch (e) {
      console.error(`Failed: ${meta.indexName}:`, e.message)
      failed++
    }
  }

  return { applied, skipped, failed }
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'database', 'reports')
  const files = fs.readdirSync(reportsDir)
    .filter(f => /^db-audit-indexes-.*\.sql$/.test(f))
    .sort()
  if (files.length === 0) {
    console.error('No db-audit-indexes-*.sql found in database/reports')
    process.exit(1)
  }
  const latest = path.join(reportsDir, files[files.length - 1])
  console.log('Using file:', latest)

  const pool = buildPool()
  try {
    const res = await applyFile(pool, latest)
    console.log('Result:', res)
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1) })
}