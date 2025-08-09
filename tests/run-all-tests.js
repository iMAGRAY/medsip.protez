#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })

const { spawn } = require('child_process')
const path = require('path')

// Ensure environment variables are loaded
if (!process.env.DATABASE_URL && !process.env.POSTGRESQL_HOST) {
  console.error('❌ Database configuration not found!')
  console.error('💡 Please create .env.local or database.env file')
  process.exit(1)
}

const tests = [
  // API Tests
  'tests/api/about-page.test.js',
  'tests/api/contacts-page.test.js',
  'tests/api/db-status.test.js',
  'tests/api/manufacturers.test.js',
  'tests/api/product-specifications.test.js',
  'tests/api/site-settings.test.js',

  // Database Tests
  'tests/database/connection.test.js',

  // Integration Tests
  'tests/integration/hierarchy.test.js',
  'tests/integration/static-assets.test.js',

  // Performance Tests
  'tests/performance/media-gallery-performance.test.js'
]

let passed = 0
let failed = 0

async function runTest(testFile) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [testFile], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (data) => {
      const text = data.toString()
      output += text
      process.stdout.write(text)
    })

    child.stderr.on('data', (data) => {
      const text = data.toString()
      errorOutput += text
      process.stderr.write(text)
    })

    child.on('close', (code) => {
      if (code === 0) {
        passed++
      } else {
        failed++
      }
      resolve(code)
    })

    child.on('error', (error) => {
      console.error(`❌ ${path.basename(testFile)} - ERROR: ${error.message}`)
      failed++
      resolve(1)
    })
  })
}

async function runAllTests() {
  const startTime = Date.now()

  for (const test of tests) {
    await runTest(test)
  }

  const duration = Date.now() - startTime
  const total = passed + failed

  console.log('\n' + '='.repeat(50))
  console.log('='.repeat(50))
  if (failed === 0) {
  } else {
  }

  process.exit(failed > 0 ? 1 : 0)
}

runAllTests().catch(error => {
  console.error('💥 Test runner crashed:', error)
  process.exit(1)
})