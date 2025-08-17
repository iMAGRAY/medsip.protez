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
  // Дымовые тесты
  { name: 'Дымовые тесты', file: 'tests/smoke-tests.js' },
  
  // Интеграционные тесты
  { name: 'Интеграционные API тесты', file: 'tests/integration/api-integration-tests.js' },
  { name: 'Тесты аутентификации', file: 'tests/integration/auth-session-tests.js' },
  
  // E2E тесты
  { name: 'E2E критические сценарии', file: 'tests/e2e/critical-user-flows.js' },
  
  // Тесты безопасности
  { name: 'Тесты безопасности', file: 'tests/security/security-tests.js' },
  
  // Тесты производительности
  { name: 'Тесты производительности', file: 'tests/performance/load-tests.js' }
]

let passed = 0
let failed = 0

async function runTest(testInfo) {
  return new Promise((resolve) => {
    console.log(`\n🚀 Запуск: ${testInfo.name}`)
    console.log('─'.repeat(50))
    
    const child = spawn(process.execPath, [testInfo.file], {
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
        console.log(`✅ ${testInfo.name} - ПРОЙДЕНО`)
        passed++
      } else {
        console.log(`❌ ${testInfo.name} - ПРОВАЛЕНО`)
        failed++
      }
      resolve(code)
    })

    child.on('error', (error) => {
      console.error(`❌ ${testInfo.name} - ОШИБКА: ${error.message}`)
      failed++
      resolve(1)
    })
  })
}

async function runAllTests() {
  const startTime = Date.now()
  
  console.log('='.repeat(60))
  console.log('🧪 ЗАПУСК ВСЕХ ТЕСТОВ MEDSIP.PROTEZ')
  console.log('='.repeat(60))

  for (const test of tests) {
    await runTest(test)
  }

  const duration = Date.now() - startTime
  const total = passed + failed

  console.log('\n' + '='.repeat(60))
  console.log('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ')
  console.log('='.repeat(60))
  console.log(`\n📈 Статистика:`)
  console.log(`  Всего тестов: ${total}`)
  console.log(`  ✅ Пройдено: ${passed}`)
  console.log(`  ❌ Провалено: ${failed}`)
  console.log(`  ⏱️  Время: ${(duration / 1000).toFixed(2)}s`)
  console.log(`  📊 Успешность: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`)
  
  if (failed === 0) {
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!')
  } else {
    console.log('\n⚠️  Некоторые тесты провалены. Проверьте логи выше.')
  }

  process.exit(failed > 0 ? 1 : 0)
}

runAllTests().catch(error => {
  console.error('💥 Test runner crashed:', error)
  process.exit(1)
})