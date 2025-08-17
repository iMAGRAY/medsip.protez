#!/usr/bin/env node

/**
 * ДЫМОВЫЕ ТЕСТЫ ДЛЯ MEDSIP.PROTEZ
 * Проверка критических функций системы
 * 
 * Запуск: node tests/smoke-tests.js
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Конфигурация
const BASE_URL = process.env.TEST_URL || 'http://localhost:3009';
const TIMEOUT = 5000;

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Статистика тестов
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

// Утилиты
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, message = '') {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
  log(`  ${icon} ${name}${message ? ': ' + message : ''}`, color);
}

// HTTP клиент
async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: TIMEOUT
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: json
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Тестовые функции
async function test(name, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    logTest(name, 'pass');
    return true;
  } catch (error) {
    failedTests++;
    logTest(name, 'fail', error.message);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ГРУППА ТЕСТОВ: Базовая доступность
async function testBasicAvailability() {
  log('\n📡 БАЗОВАЯ ДОСТУПНОСТЬ', 'cyan');
  
  await test('Сервер отвечает на запросы', async () => {
    const res = await makeRequest('/api/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('База данных подключена', async () => {
    const res = await makeRequest('/api/db-status');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.status === 'ok', 'Database not connected');
  });

  await test('Security headers установлены', async () => {
    const res = await makeRequest('/api/health');
    assert(res.headers['x-frame-options'], 'X-Frame-Options header missing');
    assert(res.headers['x-content-type-options'], 'X-Content-Type-Options header missing');
    assert(res.headers['content-security-policy'], 'CSP header missing');
  });
}

// ГРУППА ТЕСТОВ: API Endpoints
async function testAPIEndpoints() {
  log('\n🔌 API ENDPOINTS', 'cyan');
  
  await test('GET /api/products работает', async () => {
    const res = await makeRequest('/api/products?limit=1');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'API returned success: false');
    assert(Array.isArray(res.data.data), 'Products data is not an array');
  });

  await test('GET /api/categories работает', async () => {
    const res = await makeRequest('/api/categories');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'API returned success: false');
    assert(Array.isArray(res.data.data), 'Categories data is not an array');
  });

  await test('GET /api/manufacturers работает', async () => {
    const res = await makeRequest('/api/manufacturers');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'API returned success: false');
  });

  await test('GET /api/products/:id работает', async () => {
    // Сначала получаем список продуктов
    const listRes = await makeRequest('/api/products?limit=1');
    if (listRes.data.data && listRes.data.data.length > 0) {
      const productId = listRes.data.data[0].id;
      const res = await makeRequest(`/api/products/${productId}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'API returned success: false');
      assert(res.data.data.id === productId, 'Product ID mismatch');
    } else {
      throw new Error('No products found to test');
    }
  });

  await test('GET /api/characteristics работает', async () => {
    const res = await makeRequest('/api/characteristics');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'API returned success: false');
  });
}

// ГРУППА ТЕСТОВ: Аутентификация
async function testAuthentication() {
  log('\n🔐 АУТЕНТИФИКАЦИЯ', 'cyan');
  
  await test('POST /api/admin/auth/login с неверными данными', async () => {
    const res = await makeRequest('/api/admin/auth/login', {
      method: 'POST',
      body: {
        username: 'wrong_user',
        password: 'wrong_password'
      }
    });
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  });

  await test('GET /api/admin/auth/status без сессии', async () => {
    const res = await makeRequest('/api/admin/auth/status');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.authenticated === false, 'Should not be authenticated');
  });

  await test('Rate limiting работает', async () => {
    // Делаем 10 быстрых запросов на логин
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(makeRequest('/api/admin/auth/login', {
        method: 'POST',
        body: {
          username: `test_${i}`,
          password: 'test'
        }
      }).catch(e => ({ status: 429 })));
    }
    
    const results = await Promise.all(promises);
    const rateLimited = results.some(r => r.status === 429);
    assert(rateLimited, 'Rate limiting not working');
  });
}

// ГРУППА ТЕСТОВ: Поиск и фильтрация
async function testSearchAndFilter() {
  log('\n🔍 ПОИСК И ФИЛЬТРАЦИЯ', 'cyan');
  
  await test('GET /api/products/search работает', async () => {
    const res = await makeRequest('/api/products/search?q=модуль');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'API returned success: false');
  });

  await test('Пагинация продуктов работает', async () => {
    const res = await makeRequest('/api/products?page=1&limit=5');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'API returned success: false');
    assert(res.data.data.length <= 5, 'Limit not working');
  });

  await test('Фильтр по категории работает', async () => {
    const categoriesRes = await makeRequest('/api/categories');
    if (categoriesRes.data.data && categoriesRes.data.data.length > 0) {
      const categoryId = categoriesRes.data.data[0].id;
      const res = await makeRequest(`/api/products?category_id=${categoryId}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    } else {
      throw new Error('No categories found to test');
    }
  });
}

// ГРУППА ТЕСТОВ: Обработка ошибок
async function testErrorHandling() {
  log('\n⚠️ ОБРАБОТКА ОШИБОК', 'cyan');
  
  await test('404 для несуществующего маршрута', async () => {
    const res = await makeRequest('/api/nonexistent-endpoint-xyz');
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await test('400 для неверного ID продукта', async () => {
    const res = await makeRequest('/api/products/not-a-number');
    assert(res.status === 400 || res.status === 404, `Expected 400/404, got ${res.status}`);
  });

  await test('Валидация данных работает', async () => {
    const res = await makeRequest('/api/admin/auth/login', {
      method: 'POST',
      body: {} // Пустое тело
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });
}

// ГРУППА ТЕСТОВ: Производительность
async function testPerformance() {
  log('\n⚡ ПРОИЗВОДИТЕЛЬНОСТЬ', 'cyan');
  
  await test('Главная страница загружается быстро', async () => {
    const start = Date.now();
    await makeRequest('/');
    const duration = Date.now() - start;
    assert(duration < 3000, `Page load took ${duration}ms (>3000ms)`);
  });

  await test('API отвечает быстро', async () => {
    const start = Date.now();
    await makeRequest('/api/products?limit=10');
    const duration = Date.now() - start;
    assert(duration < 1000, `API response took ${duration}ms (>1000ms)`);
  });

  await test('Health check быстрый', async () => {
    const start = Date.now();
    await makeRequest('/api/health');
    const duration = Date.now() - start;
    assert(duration < 200, `Health check took ${duration}ms (>200ms)`);
  });
}

// ГРУППА ТЕСТОВ: Критические бизнес-функции
async function testBusinessLogic() {
  log('\n💼 БИЗНЕС-ЛОГИКА', 'cyan');
  
  await test('Продукты имеют корректную структуру', async () => {
    const res = await makeRequest('/api/products?limit=1');
    if (res.data.data && res.data.data.length > 0) {
      const product = res.data.data[0];
      assert(product.id, 'Product missing ID');
      assert(product.name, 'Product missing name');
      assert(product.sku, 'Product missing SKU');
      assert('price' in product, 'Product missing price field');
      assert('stock_status' in product, 'Product missing stock_status');
    }
  });

  await test('Категории имеют древовидную структуру', async () => {
    const res = await makeRequest('/api/categories');
    if (res.data.data && res.data.data.length > 0) {
      const hasParentChild = res.data.data.some(cat => 
        cat.children && cat.children.length > 0
      );
      assert(hasParentChild || res.data.data.length === 1, 'No category hierarchy found');
    }
  });

  await test('Характеристики продуктов загружаются', async () => {
    const productsRes = await makeRequest('/api/products?limit=1');
    if (productsRes.data.data && productsRes.data.data.length > 0) {
      const productId = productsRes.data.data[0].id;
      const res = await makeRequest(`/api/products/${productId}/characteristics-simple`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Characteristics API failed');
    }
  });
}

// ГЛАВНАЯ ФУНКЦИЯ
async function runSmokeTests() {
  log('\n' + '='.repeat(60), 'bold');
  log('🔥 ДЫМОВЫЕ ТЕСТЫ MEDSIP.PROTEZ', 'bold');
  log('='.repeat(60), 'bold');
  log(`📍 URL: ${BASE_URL}`, 'blue');
  log(`⏱️  Timeout: ${TIMEOUT}ms`, 'blue');
  
  const startTime = Date.now();
  
  try {
    // Проверяем доступность сервера
    await makeRequest('/api/health');
  } catch (error) {
    log('\n❌ СЕРВЕР НЕДОСТУПЕН!', 'red');
    log(`Убедитесь что сервер запущен на ${BASE_URL}`, 'yellow');
    log('Запустите: npm run dev', 'yellow');
    process.exit(1);
  }
  
  // Запускаем группы тестов
  await testBasicAvailability();
  await testAPIEndpoints();
  await testAuthentication();
  await testSearchAndFilter();
  await testErrorHandling();
  await testPerformance();
  await testBusinessLogic();
  
  // Итоги
  const duration = Date.now() - startTime;
  
  log('\n' + '='.repeat(60), 'bold');
  log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ', 'bold');
  log('='.repeat(60), 'bold');
  
  log(`\n⏱️  Время выполнения: ${duration}ms`, 'blue');
  log(`📝 Всего тестов: ${totalTests}`, 'blue');
  log(`✅ Пройдено: ${passedTests}`, 'green');
  log(`❌ Провалено: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  log(`⏭️  Пропущено: ${skippedTests}`, skippedTests > 0 ? 'yellow' : 'green');
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  const rateColor = successRate === 100 ? 'green' : successRate >= 80 ? 'yellow' : 'red';
  
  log(`\n📈 Успешность: ${successRate}%`, rateColor);
  
  if (failedTests === 0) {
    log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!', 'green');
  } else {
    log('\n⚠️  Некоторые тесты провалены. Проверьте логи выше.', 'red');
  }
  
  // Exit код для CI/CD
  process.exit(failedTests > 0 ? 1 : 0);
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  log('\n💥 Критическая ошибка:', 'red');
  console.error(error);
  process.exit(1);
});

// Запуск тестов
runSmokeTests().catch(error => {
  log('\n💥 Ошибка выполнения тестов:', 'red');
  console.error(error);
  process.exit(1);
});