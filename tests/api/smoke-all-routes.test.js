#!/usr/bin/env node
const { discoverRoutes } = require('../utils/discover-api-routes')
const ApiHelper = require('../utils/api-helper')

async function main() {
  const api = new ApiHelper()
  const ok = await api.waitForServer(10, 1000)
  if (!ok) {
    console.error('❌ Server is not running; skip smoke test')
    process.exit(1)
  }

  const routes = discoverRoutes(require('path').join(process.cwd(), 'app', 'api'))
  const stats = { total: 0, ok: 0, fail: 0, errors: [] }

  for (const route of routes) {
    // Пропускаем сложные POST-only/PUT-only эндпоинты (выглядят как модифицирующие)
    if (/upload|delete|cleanup|admin\/auth|seed|reset|sync|init/i.test(route)) continue

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
  }

  console.log('\nSmoke summary:', stats)
  process.exit(stats.fail > 0 ? 1 : 0)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('💥 Smoke runner crashed:', e)
    process.exit(1)
  })
}