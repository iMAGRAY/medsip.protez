#!/usr/bin/env node
const { discoverRoutes } = require('../utils/discover-api-routes')
const ApiHelper = require('../utils/api-helper')

const CONCURRENCY = parseInt(process.env.SMOKE_CONCURRENCY || '4', 10)
const GLOBAL_TIMEOUT_MS = parseInt(process.env.SMOKE_GLOBAL_TIMEOUT_MS || '240000', 10)

// Допустимые статусы по маршрутам (регексы)
const ALLOWED_STATUS = [
  { pattern: /^\/api\/catalog-subgroups$/, codes: [200, 400] },
  { pattern: /^\/api\/recommendations$/, codes: [200, 400] },
  { pattern: /^\/api\/media\/check$/, codes: [200, 400] },
  { pattern: /^\/api\/product-images$/, codes: [200, 400] },
  { pattern: /^\/api\/variant-images$/, codes: [200, 400, 404] },
  { pattern: /^\/api\/sql-table\//, codes: [200, 400] },
  { pattern: /^\/api\/log-404$/, codes: [405] },
  { pattern: /^\/api\/warehouse\/sections\/\d+$/, codes: [200, 405] },
  { pattern: /^\/api\/warehouse\/setup-hierarchy$/, codes: [405] },
  { pattern: /^\/api\/media\/check-duplicate$/, codes: [405] },
  { pattern: /^\/api\/orders\/\d+\/items\/\d+$/, codes: [405] },
  { pattern: /^\/api\/variants\/\d+\/personal-tags\/\d+$/, codes: [405] },
]

function isAllowedStatus(url, status) {
  for (const rule of ALLOWED_STATUS) {
    if (rule.pattern.test(url) && rule.codes.includes(status)) return true
  }
  // Общее правило: ресурсы по id могут легитимно вернуть 404
  if (/^\/api\/[^?]*\/[0-9]+(\/.*)?$/.test(url) && [200, 404].includes(status)) return true
  return false
}

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

  const killer = setTimeout(() => {
    console.error(`⏱️ Smoke script timeout ${GLOBAL_TIMEOUT_MS}ms reached`)
    try { process.exit(124) } catch(_) {}
  }, GLOBAL_TIMEOUT_MS)

  const routes = discoverRoutes(require('path').join(process.cwd(), 'app', 'api'))
  const stats = { total: 0, ok: 0, fail: 0, errors: [] }

  const worker = async (route) => {
    if (/\/(upload|delete|cleanup|admin\/auth|seed|reset|sync|init|register|db-reset|cache\/clear|test-)/i.test(route)) return null
    const url = route
    try {
      const start = Date.now()
      const res = await api.get(url)
      const ms = Date.now() - start
      stats.total++
      if (res.ok || isAllowedStatus(url, res.status)) {
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

  clearTimeout(killer)
  console.log('\nSmoke summary:', stats)
  process.exit(stats.fail > 0 ? 1 : 0)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('💥 Smoke runner crashed:', e)
    process.exit(1)
  })
}