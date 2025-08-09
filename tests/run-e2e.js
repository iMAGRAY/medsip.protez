#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')
const fetch = require('node-fetch')

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function run() {
  // Пробрасываем безопасные переменные окружения для only-read режима
  const env = { ...process.env }
  env.READONLY_SQL = env.READONLY_SQL || 'true'

  // Стартуем next сервер
  const server = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let ready = false
  server.stdout.on('data', (d) => {
    const t = d.toString()
    process.stdout.write(t)
    if (t.includes('started server on') || t.includes('Local:')) ready = true
  })
  server.stderr.on('data', (d) => process.stderr.write(d.toString()))

  // Ждём готовность максимум 45с и пингуем /api/health
  for (let i = 0; i < 45 && !ready; i++) {
    await wait(1000)
    try {
      const res = await fetch('http://localhost:3000/api/health')
      if (res.ok || res.status === 503) { ready = true; break }
    } catch (_) { /* ignore */ }
  }
  if (!ready) {
    console.error('❌ Server did not become ready in time')
    server.kill('SIGTERM')
    process.exit(1)
  }

  // Запускаем API тесты
  const tests = [
    'tests/api/db-status.test.js',
    'tests/api/manufacturers.test.js',
    'tests/api/product-specifications.test.js',
    'tests/api/site-settings.test.js',
  ]

  let failed = 0
  for (const file of tests) {
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, [file], { stdio: 'inherit', env })
      child.on('close', (c) => resolve(c))
      child.on('error', () => resolve(1))
    })
    if (code !== 0) failed++
  }

  server.kill('SIGTERM')
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('💥 E2E runner crash:', e)
  process.exit(1)
})