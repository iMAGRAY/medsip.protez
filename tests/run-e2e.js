#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')
const fetch = require('node-fetch')
const dotenv = require('dotenv')

// Загружаем локальные env для БД/Redis
dotenv.config({ path: '.env.local' })
dotenv.config({ path: 'database.env' })

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function isServerUp(baseUrl) {
  try {
    const res = await fetch(baseUrl + '/')
    return res.ok
  } catch (_) {
    return false
  }
}

async function run() {
  // Пробрасываем безопасные переменные окружения для only-read режима
  const env = { ...process.env }
  env.READONLY_SQL = env.READONLY_SQL || 'true'

  // Выбираем тестовый порт и BASE_URL
  const port = String(process.env.TEST_PORT || 3010)
  const baseUrl = `http://localhost:${port}`
  env.TEST_BASE_URL = baseUrl

  let server
  let startedLocally = false

  // Всегда поднимаем свой сервер на тестовом порту
  server = spawn(process.execPath, [
    path.join('node_modules', 'next', 'dist', 'bin', 'next'),
    'start',
    '-p', port
  ], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  startedLocally = true

  let ready = false
  server.stdout.on('data', (d) => {
    const t = d.toString()
    process.stdout.write(t)
    if (t.includes(`:${port}`) || t.includes('Local:')) ready = true
  })
  server.stderr.on('data', (d) => process.stderr.write(d.toString()))

  // Ждём готовность максимум 60с и пингуем /api/health на тестовом порту
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

  if (startedLocally && server) {
    try { server.kill('SIGTERM') } catch (_) {}
  }
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('💥 E2E runner crash:', e)
  process.exit(1)
})