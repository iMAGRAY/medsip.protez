#!/usr/bin/env node
const { spawn, execSync } = require('child_process')
const net = require('net')
const path = require('path')
const fetch = require('node-fetch')
const dotenv = require('dotenv')

// Загружаем локальные env для БД/Redis
dotenv.config({ path: '.env.local' })
dotenv.config({ path: 'database.env' })

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '0.0.0.0')
  })
}

async function findFreePort(preferred = 3010, max = 3050) {
  for (let p = preferred; p <= max; p++) {
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(p)
    if (free) return p
  }
  throw new Error('No free port found in range')
}

function runCmd(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: 'inherit' })
    child.on('close', (code) => resolve(code))
    child.on('error', () => resolve(1))
  })
}

async function run() {
  const env = { ...process.env }
  env.READONLY_SQL = env.READONLY_SQL || 'true'

  // Выбираем свободный тестовый порт
  const preferred = Number(process.env.TEST_PORT || 3010)
  const port = await findFreePort(preferred, preferred + 100)
  const baseUrl = `http://localhost:${port}`
  env.TEST_BASE_URL = baseUrl

  // Сборка
  const buildCode = await runCmd(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'build'], env)
  if (buildCode !== 0) {
    console.error('❌ Build failed')
    process.exit(buildCode)
  }

  // Запуск сервера
  let server
  server = spawn(process.execPath, [
    path.join('node_modules', 'next', 'dist', 'bin', 'next'),
    'start',
    '-p', String(port)
  ], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let ready = false
  server.stdout.on('data', (d) => {
    const t = d.toString()
    process.stdout.write(t)
    if (t.includes(`:${port}`) || t.includes('Local:')) ready = true
  })
  server.stderr.on('data', (d) => process.stderr.write(d.toString()))

  // Ждём готовность максимум 60с и пингуем /api/health
  for (let i = 0; i < 60 && !ready; i++) {
    await wait(1000)
    try {
      const res = await fetch(baseUrl + '/api/health')
      if (res.ok || res.status === 503) { ready = true; break }
    } catch (_) { /* ignore */ }
  }
  if (!ready) {
    console.error('❌ Server did not become ready in time on', baseUrl)
    try { server.kill('SIGTERM') } catch (_) {}
    process.exit(1)
  }

  // E2E API тесты
  const tests = [
    'tests/api/db-status.test.js',
    'tests/api/manufacturers.test.js',
    'tests/api/product-specifications.test.js',
    'tests/api/site-settings.test.js',
  ]

  let failed = 0
  for (const file of tests) {
    const code = await runCmd(process.execPath, [file], env)
    if (code !== 0) failed++
  }

  try { server.kill('SIGTERM') } catch (_) {}
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('💥 E2E runner crash:', e)
  process.exit(1)
})