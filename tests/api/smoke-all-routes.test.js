#!/usr/bin/env node
const { discoverRoutes } = require('../utils/discover-api-routes')
const ApiHelper = require('../utils/api-helper')

const CONCURRENCY = parseInt(process.env.SMOKE_CONCURRENCY || '6', 10)

async function runWithPool(items, worker, concurrency) {
  const results = []
  let idx = 0
  const running = new Set()
  async function next() {
    if (idx >= items.length) return
    const current = idx++
    const p = worker(items[current]).then((r) => { results[current] = r }).catch((e) => { results[current] = e }).finally(() => { running.delete(p) })
    running.add(p)
    if (running.size < concurrency) return next()
    await Promise.race(running)
    return next()
  }
  const starters = Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  await Promise.all(starters)
  await Promise.all(running)
  return results
}

async function main() {
  const api = new ApiHelper()
  const ok = await api.waitForServer(20, 1000)
  if (!ok) {
    console.error('❌ Server is not running; skip smoke test')
    process.exit(1)
  }

  const routes = discoverRoutes(require('path').join(process.cwd(), 'app', 'api'))
  const stats = { total: 0, ok: 0, fail: 0, errors: [] }

  const worker = async (route) => {
    // Пропуск сложных модифицирующих
    if (/upload|delete|cleanup|admin\/auth|seed|reset|sync|init/i.test(route)) return null
    const url = route
    try {
      const start = Date.now()
      const res = await api.get(url)
      const ms = Date.now() - start
      stats.total++
      if (res.ok) {
        stats.ok++
        console.log(`✅ ${url} ${res.status} ${ms}ms`)
      } else {
        stats.fail++
        console.warn(`⚠️ ${url} ${res.status} ${ms}ms`)
      }
    } catch (e) {
      stats.fail++
      stats.errors.push({ route: url, error: e.message })
      console.error(`❌ ${url} error:`, e.message)
    }
    return null
  }

  await runWithPool(routes, worker, CONCURRENCY)

  console.log('\nSmoke summary:', stats)
  process.exit(stats.fail > 0 ? 1 : 0)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('💥 Smoke runner crashed:', e)
    process.exit(1)
  })
}