#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')
const dotenv = require('dotenv')
const net = require('net')

dotenv.config({ path: '.env.local' })
dotenv.config({ path: 'database.env' })

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

function runCmd(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: 'inherit' })
    child.on('close', (code) => resolve(code))
    child.on('error', () => resolve(1))
  })
}

async function isUp(baseUrl) {
  try {
    const res = await fetch(baseUrl + '/api/health')
    return res.ok || res.status === 503
  } catch (_) { return false }
}

async function findFreePort(start = 3010, attempts = 20) {
  for (let p = start; p < start + attempts; p++) {
    const can = await new Promise((resolve) => {
      const srv = net.createServer()
      srv.once('error', () => resolve(false))
      srv.listen(p, () => {
        srv.close(() => resolve(true))
      })
    })
    if (can) return p
  }
  return start
}

async function main() {
  const env = { ...process.env }
  let port = Number(process.env.TEST_PORT || 3010)
  port = await findFreePort(port, 50)
  const baseUrl = `http://localhost:${port}`
  env.TEST_BASE_URL = baseUrl
  env.READONLY_SQL = env.READONLY_SQL || 'true'
  env.DB_CONN_TIMEOUT_MS = env.DB_CONN_TIMEOUT_MS || '5000'
  env.DB_QUERY_TIMEOUT_MS = env.DB_QUERY_TIMEOUT_MS || '8000'
  env.DB_STATEMENT_TIMEOUT_MS = env.DB_STATEMENT_TIMEOUT_MS || env.DB_QUERY_TIMEOUT_MS
  env.TEST_HTTP_TIMEOUT_MS = env.TEST_HTTP_TIMEOUT_MS || '12000'
  env.SMOKE_CONCURRENCY = env.SMOKE_CONCURRENCY || '4'
  env.SMOKE_GLOBAL_TIMEOUT_MS = env.SMOKE_GLOBAL_TIMEOUT_MS || '240000'

  const buildCode = await runCmd(process.execPath, [path.join('node_modules','next','dist','bin','next'),'build'], env)
  if (buildCode !== 0) process.exit(buildCode)

  const server = spawn(process.execPath, [path.join('node_modules','next','dist','bin','next'),'start','-p',String(port)], { env, stdio: ['ignore','pipe','pipe'] })
  let ready = false
  server.stdout.on('data', d => {
    const t = d.toString()
    process.stdout.write(t)
    if (t.includes(`:${port}`) || t.includes('Local:')) ready = true
  })
  server.stderr.on('data', d => process.stderr.write(d.toString()))

  const killer = () => {
    try { server.kill('SIGTERM') } catch(_) {}
    setTimeout(() => { try { server.kill('SIGKILL') } catch(_) {} }, 1500)
  }

  const globalTimeoutMs = parseInt(env.SMOKE_GLOBAL_TIMEOUT_MS, 10)
  const guard = setTimeout(() => {
    console.error(`⏱️ Smoke global timeout ${globalTimeoutMs}ms reached; terminating...`)
    killer()
    process.exit(124)
  }, globalTimeoutMs)

  for (let i=0;i<60 && !ready;i++) {
    await wait(1000)
    if (await isUp(baseUrl)) { ready = true; break }
  }
  if (!ready) {
    killer()
    console.error('❌ Server did not start for smoke on', baseUrl)
    process.exit(1)
  }

  const code = await runCmd(process.execPath, [path.join('tests','api','smoke-all-routes.test.js')], env)

  clearTimeout(guard)
  killer()
  process.exit(code)
}

main().catch(e => { console.error('💥 run-smoke crash:', e); process.exit(1) })