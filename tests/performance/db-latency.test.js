#!/usr/bin/env node
const DatabaseHelper = require('../utils/db-helper')

async function main() {
  const db = new DatabaseHelper()
  const results = []

  async function measure(name, sql) {
    const start = Date.now()
    try {
      const rows = await db.query(sql)
      const ms = Date.now() - start
      results.push({ name, ms, rows: rows.length })
      console.log(`✅ ${name}: ${ms}ms, rows=${rows.length}`)
    } catch (e) {
      const ms = Date.now() - start
      results.push({ name, ms, error: e.message })
      console.error(`❌ ${name}: ${ms}ms error=${e.message}`)
    }
  }

  await measure('ping', 'SELECT 1')
  await measure('products_count', 'SELECT COUNT(*)::int AS c FROM products')
  await measure('manufacturers_count', 'SELECT COUNT(*)::int AS c FROM manufacturers')
  await measure('recent_products', 'SELECT id, name, created_at FROM products ORDER BY created_at DESC LIMIT 10')

  const slow = results.filter(r => r.ms > 500)
  if (slow.length > 0) {
    console.warn('⚠️ Slow queries detected:', slow)
  }

  await db.close()
  const hasErrors = results.some(r => r.error)
  process.exit(hasErrors ? 1 : 0)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('💥 DB latency test crashed:', e)
    process.exit(1)
  })
}