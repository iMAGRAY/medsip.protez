#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function run() {
  // Стартуем next dev сервер
  const server = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start'], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let ready = false
  server.stdout.on('data', (d) => {
    const t = d.toString()
    process.stdout.write(t)
    if (t.includes('started server on')) ready = true
  })
  server.stderr.on('data', (d) => process.stderr.write(d.toString()))

  // Ждём готовность максимум 30с
  for (let i = 0; i < 30 && !ready; i++) {
    await wait(1000)
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
      const child = spawn(process.execPath, [file], { stdio: 'inherit', env: { ...process.env } })
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