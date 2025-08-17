#!/usr/bin/env node

/**
 * ИНТЕГРАЦИОННЫЕ ТЕСТЫ API ДЛЯ MEDSIP.PROTEZ
 * Проверка взаимодействия между компонентами системы
 * 
 * Запуск: node tests/integration/api-integration-tests.js
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');

// Конфигурация
const BASE_URL = process.env.TEST_URL || 'http://localhost:3009';
const TIMEOUT = 10000; // Больше времени для интеграционных тестов

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

// Статистика тестов
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let testGroups = [];

// Утилиты
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, message = '') {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
  log(`  ${icon} ${name}${message ? ': ' + message : ''}`, color);
}

function logGroup(name) {
  log(`\n📦 ${name}`, 'cyan');
  testGroups.push({ name, tests: [] });
}

// HTTP клиент с поддержкой cookies
class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  async request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const reqOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.getCookieString(),
          ...options.headers
        },
        timeout: TIMEOUT
      };

      const req = client.request(reqOptions, (res) => {
        // Сохраняем cookies
        if (res.headers['set-cookie']) {
          res.headers['set-cookie'].forEach(cookie => {
            const [nameValue] = cookie.split(';');
            const [name, value] = nameValue.split('=');
            this.cookies.set(name, value);
          });
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: json,
              raw: data
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data,
              raw: data
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
        const bodyStr = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
        req.write(bodyStr);
      }
      
      req.end();
    });
  }

  getCookieString() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  clearCookies() {
    this.cookies.clear();
  }
}

// Тестовые функции
async function test(name, testFn) {
  totalTests++;
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    passedTests++;
    logTest(name, 'pass', `${duration}ms`);
    
    if (testGroups.length > 0) {
      testGroups[testGroups.length - 1].tests.push({
        name,
        status: 'pass',
        duration
      });
    }
    
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    failedTests++;
    logTest(name, 'fail', error.message);
    
    if (testGroups.length > 0) {
      testGroups[testGroups.length - 1].tests.push({
        name,
        status: 'fail',
        error: error.message,
        duration
      });
    }
    
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(array, item, message) {
  if (!array.includes(item)) {
    throw new Error(message || `Array does not include ${item}`);
  }
}

function assertGreaterThan(value, threshold, message) {
  if (!(value > threshold)) {
    throw new Error(message || `${value} is not greater than ${threshold}`);
  }
}

// ИНТЕГРАЦИОННЫЙ ТЕСТ: Полный цикл работы с продуктом
async function testProductLifecycle(client) {
  logGroup('ЖИЗНЕННЫЙ ЦИКЛ ПРОДУКТА');
  
  let productId;
  let categoryId;
  
  // Сначала получаем категорию для создания продукта
  await test('Получение списка категорий для создания продукта', async () => {
    const res = await client.request('/api/categories');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Categories fetch failed');
    assert(Array.isArray(res.data.data), 'Categories data is not array');
    
    if (res.data.data.length > 0) {
      categoryId = res.data.data[0].id;
    }
  });
  
  // Получаем продукт для тестирования
  await test('Получение продукта для тестирования', async () => {
    const res = await client.request('/api/products?limit=1');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.data.length > 0, 'No products found');
    productId = res.data.data[0].id;
  });
  
  // Получаем детальную информацию о продукте
  await test('Получение детальной информации о продукте', async () => {
    const res = await client.request(`/api/products/${productId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Product fetch failed');
    assert(res.data.data.id === productId, 'Product ID mismatch');
  });
  
  // Получаем характеристики продукта
  await test('Получение характеристик продукта', async () => {
    const res = await client.request(`/api/products/${productId}/characteristics-simple`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Characteristics fetch failed');
  });
  
  // Получаем варианты продукта
  await test('Получение вариантов продукта', async () => {
    const res = await client.request(`/api/products/${productId}/variants`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Variants fetch failed');
    assert(Array.isArray(res.data.data), 'Variants data is not array');
  });
  
  // Получаем похожие продукты
  await test('Получение похожих продуктов', async () => {
    const res = await client.request(`/api/products/${productId}/similar`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Similar products fetch failed');
  });
  
  // Проверяем наличие изображений
  await test('Проверка наличия изображений продукта', async () => {
    const res = await client.request(`/api/products/${productId}/images`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Images fetch failed');
  });
}

// ИНТЕГРАЦИОННЫЙ ТЕСТ: Поиск и фильтрация
async function testSearchAndFiltering(client) {
  logGroup('ПОИСК И ФИЛЬТРАЦИЯ');
  
  let categoryId;
  let manufacturerId;
  
  // Получаем категории для фильтрации
  await test('Получение категорий для фильтрации', async () => {
    const res = await client.request('/api/categories');
    assert(res.status === 200, 'Categories fetch failed');
    if (res.data.data && res.data.data.length > 0) {
      categoryId = res.data.data[0].id;
    }
  });
  
  // Получаем производителей для фильтрации
  await test('Получение производителей для фильтрации', async () => {
    const res = await client.request('/api/manufacturers');
    assert(res.status === 200, 'Manufacturers fetch failed');
    if (res.data.data && res.data.data.length > 0) {
      manufacturerId = res.data.data[0].id;
    }
  });
  
  // Простой поиск
  await test('Простой поиск по ключевому слову', async () => {
    const res = await client.request('/api/products/search?q=протез');
    assert(res.status === 200, 'Search failed');
    assert(res.data.success === true, 'Search returned error');
    assert(Array.isArray(res.data.data), 'Search data is not array');
  });
  
  // Поиск с включением вариантов
  await test('Поиск с включением вариантов', async () => {
    const res = await client.request('/api/products/search?q=модуль&includeVariants=true');
    assert(res.status === 200, 'Search with variants failed');
    assert(res.data.success === true, 'Search returned error');
  });
  
  // Фильтрация по категории
  if (categoryId) {
    await test('Фильтрация продуктов по категории', async () => {
      const res = await client.request(`/api/products?category_id=${categoryId}`);
      assert(res.status === 200, 'Category filter failed');
      assert(res.data.success === true, 'Filter returned error');
    });
  }
  
  // Фильтрация по производителю
  if (manufacturerId) {
    await test('Фильтрация продуктов по производителю', async () => {
      const res = await client.request(`/api/products?manufacturer_id=${manufacturerId}`);
      assert(res.status === 200, 'Manufacturer filter failed');
      assert(res.data.success === true, 'Filter returned error');
    });
  }
  
  // Комбинированная фильтрация
  await test('Комбинированная фильтрация', async () => {
    const res = await client.request('/api/products?limit=5&page=1&sort=price_asc');
    assert(res.status === 200, 'Combined filter failed');
    assert(res.data.success === true, 'Filter returned error');
    assert(res.data.data.length <= 5, 'Limit not working');
  });
  
  // Пагинация
  await test('Проверка пагинации', async () => {
    const page1 = await client.request('/api/products?limit=5&page=1');
    const page2 = await client.request('/api/products?limit=5&page=2');
    
    assert(page1.status === 200, 'Page 1 failed');
    assert(page2.status === 200, 'Page 2 failed');
    
    if (page1.data.data.length > 0 && page2.data.data.length > 0) {
      assert(
        page1.data.data[0].id !== page2.data.data[0].id,
        'Pagination not working - same products on different pages'
      );
    }
  });
}

// ИНТЕГРАЦИОННЫЙ ТЕСТ: Работа с категориями
async function testCategoryHierarchy(client) {
  logGroup('ИЕРАРХИЯ КАТЕГОРИЙ');
  
  let rootCategoryId;
  let childCategoryId;
  
  // Получаем дерево категорий
  await test('Получение дерева категорий', async () => {
    const res = await client.request('/api/categories');
    assert(res.status === 200, 'Categories fetch failed');
    assert(Array.isArray(res.data.data), 'Categories is not array');
    
    // Находим категорию с детьми
    const categoryWithChildren = res.data.data.find(cat => 
      cat.children && cat.children.length > 0
    );
    
    if (categoryWithChildren) {
      rootCategoryId = categoryWithChildren.id;
      childCategoryId = categoryWithChildren.children[0].id;
    }
  });
  
  // Проверяем родительскую категорию
  if (rootCategoryId) {
    await test('Получение продуктов родительской категории', async () => {
      const res = await client.request(`/api/products?category_id=${rootCategoryId}`);
      assert(res.status === 200, 'Parent category products failed');
      assert(res.data.success === true, 'Failed to get parent category products');
    });
  }
  
  // Проверяем дочернюю категорию
  if (childCategoryId) {
    await test('Получение продуктов дочерней категории', async () => {
      const res = await client.request(`/api/products?category_id=${childCategoryId}`);
      assert(res.status === 200, 'Child category products failed');
      assert(res.data.success === true, 'Failed to get child category products');
    });
  }
  
  // Проверяем хлебные крошки
  if (childCategoryId) {
    await test('Проверка хлебных крошек категории', async () => {
      const res = await client.request(`/api/categories/${childCategoryId}/breadcrumbs`);
      assert(res.status === 200, 'Breadcrumbs fetch failed');
      assert(res.data.success === true, 'Failed to get breadcrumbs');
      assert(Array.isArray(res.data.data), 'Breadcrumbs is not array');
    });
  }
}

// ИНТЕГРАЦИОННЫЙ ТЕСТ: Работа с вариантами
async function testProductVariants(client) {
  logGroup('ВАРИАНТЫ ПРОДУКТОВ');
  
  let productWithVariants;
  let variantId;
  
  // Находим продукт с вариантами
  await test('Поиск продукта с вариантами', async () => {
    const res = await client.request('/api/products?limit=50');
    assert(res.status === 200, 'Products fetch failed');
    
    // Проверяем каждый продукт на наличие вариантов
    for (const product of res.data.data) {
      const varRes = await client.request(`/api/products/${product.id}/variants`);
      if (varRes.data.data && varRes.data.data.length > 0) {
        productWithVariants = product;
        variantId = varRes.data.data[0].id;
        break;
      }
    }
    
    assert(productWithVariants, 'No products with variants found');
  });
  
  // Получаем детали варианта
  if (productWithVariants && variantId) {
    await test('Получение деталей варианта', async () => {
      const res = await client.request(`/api/variants/${variantId}`);
      assert(res.status === 200, 'Variant details fetch failed');
      assert(res.data.success === true, 'Failed to get variant details');
      assert(res.data.data.id === variantId, 'Variant ID mismatch');
    });
    
    // Проверяем связь варианта с мастер-продуктом
    await test('Проверка связи варианта с мастер-продуктом', async () => {
      const res = await client.request(`/api/variants/${variantId}`);
      assert(res.status === 200, 'Variant fetch failed');
      assert(
        res.data.data.master_id === productWithVariants.id,
        'Variant not linked to correct master product'
      );
    });
  }
  
  // Проверяем фильтрацию по размерам
  await test('Фильтрация вариантов по размерам', async () => {
    if (productWithVariants) {
      const res = await client.request(`/api/products/${productWithVariants.id}/variants?size=M`);
      assert(res.status === 200, 'Size filter failed');
      assert(res.data.success === true, 'Failed to filter by size');
    }
  });
}

// ИНТЕГРАЦИОННЫЙ ТЕСТ: Характеристики продуктов
async function testProductCharacteristics(client) {
  logGroup('ХАРАКТЕРИСТИКИ ПРОДУКТОВ');
  
  let productId;
  let characteristicId;
  
  // Получаем продукт для тестирования
  await test('Получение продукта для тестирования характеристик', async () => {
    const res = await client.request('/api/products?limit=1');
    assert(res.status === 200, 'Products fetch failed');
    assert(res.data.data.length > 0, 'No products found');
    productId = res.data.data[0].id;
  });
  
  // Получаем все характеристики
  await test('Получение всех характеристик', async () => {
    const res = await client.request('/api/characteristics');
    assert(res.status === 200, 'Characteristics fetch failed');
    assert(res.data.success === true, 'Failed to get characteristics');
    
    if (res.data.data && res.data.data.length > 0) {
      characteristicId = res.data.data[0].id;
    }
  });
  
  // Получаем характеристики конкретного продукта
  await test('Получение характеристик продукта', async () => {
    const res = await client.request(`/api/products/${productId}/characteristics-simple`);
    assert(res.status === 200, 'Product characteristics fetch failed');
    assert(res.data.success === true, 'Failed to get product characteristics');
  });
  
  // Проверяем группировку характеристик
  await test('Проверка группировки характеристик', async () => {
    const res = await client.request(`/api/products/${productId}/characteristics-grouped`);
    assert(res.status === 200, 'Grouped characteristics fetch failed');
    assert(res.data.success === true, 'Failed to get grouped characteristics');
    
    if (res.data.data) {
      assert(typeof res.data.data === 'object', 'Grouped data is not object');
    }
  });
}

// ИНТЕГРАЦИОННЫЙ ТЕСТ: Производительность
async function testPerformanceIntegration(client) {
  logGroup('ПРОИЗВОДИТЕЛЬНОСТЬ ИНТЕГРАЦИИ');
  
  // Параллельные запросы
  await test('Параллельная загрузка данных', async () => {
    const startTime = Date.now();
    
    const promises = [
      client.request('/api/products?limit=10'),
      client.request('/api/categories'),
      client.request('/api/manufacturers'),
      client.request('/api/characteristics')
    ];
    
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    results.forEach(res => {
      assert(res.status === 200, 'One of parallel requests failed');
    });
    
    assert(duration < 3000, `Parallel requests took ${duration}ms (>3000ms)`);
  });
  
  // Большие объемы данных
  await test('Обработка больших объемов данных', async () => {
    const startTime = Date.now();
    const res = await client.request('/api/products?limit=100');
    const duration = Date.now() - startTime;
    
    assert(res.status === 200, 'Large data fetch failed');
    assert(duration < 5000, `Large data fetch took ${duration}ms (>5000ms)`);
  });
  
  // Кэширование
  await test('Проверка кэширования', async () => {
    // Первый запрос
    const start1 = Date.now();
    const res1 = await client.request('/api/categories');
    const duration1 = Date.now() - start1;
    
    // Второй запрос (должен быть быстрее из-за кэша)
    const start2 = Date.now();
    const res2 = await client.request('/api/categories');
    const duration2 = Date.now() - start2;
    
    assert(res1.status === 200, 'First request failed');
    assert(res2.status === 200, 'Second request failed');
    
    // Второй запрос должен быть не медленнее первого
    assert(
      duration2 <= duration1 * 1.5,
      `Cache not working: first ${duration1}ms, second ${duration2}ms`
    );
  });
}

// ИНТЕГРАЦИОННЫЙ ТЕСТ: Обработка ошибок
async function testErrorHandlingIntegration(client) {
  logGroup('ОБРАБОТКА ОШИБОК В ИНТЕГРАЦИИ');
  
  // Несуществующий продукт
  await test('Обработка запроса несуществующего продукта', async () => {
    const res = await client.request('/api/products/999999999');
    assert(
      res.status === 404 || res.status === 400,
      `Expected 404 or 400, got ${res.status}`
    );
  });
  
  // Неверные параметры пагинации
  await test('Обработка неверных параметров пагинации', async () => {
    const res = await client.request('/api/products?page=-1&limit=abc');
    assert(
      res.status === 400 || res.status === 200,
      `Expected 400 or 200 with defaults, got ${res.status}`
    );
  });
  
  // SQL инъекция защита
  await test('Защита от SQL инъекций', async () => {
    const res = await client.request('/api/products/search?q=\'; DROP TABLE products; --');
    assert(
      res.status === 200 || res.status === 400,
      'SQL injection protection failed'
    );
    
    if (res.status === 200) {
      assert(res.data.success === true, 'Search failed on SQL injection attempt');
    }
  });
  
  // XSS защита - middleware должен блокировать XSS запросы
  await test('Защита от XSS', async () => {
    const res = await client.request('/api/products/search?q=<script>alert("XSS")</script>');
    
    // Middleware должен блокировать XSS с 400 статусом
    assert(res.status === 400, 'XSS protection should block request with 400 status');
    
    // Ответ должен содержать информацию о блокировке
    if (res.data) {
      const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      assert(
        responseData.success === false && 
        (responseData.error.includes('Malicious request') || responseData.code === 'XSS_ATTEMPT'),
        'XSS protection should return error message'
      );
    }
  });
  
  // Большие запросы
  await test('Обработка слишком больших запросов', async () => {
    const largeString = 'a'.repeat(10000);
    const res = await client.request(`/api/products/search?q=${largeString}`);
    assert(
      res.status === 200 || res.status === 400 || res.status === 414,
      'Large request not handled properly'
    );
  });
}

// ГЛАВНАЯ ФУНКЦИЯ
async function runIntegrationTests() {
  log('\n' + '='.repeat(60), 'bold');
  log('🔬 ИНТЕГРАЦИОННЫЕ ТЕСТЫ MEDSIP.PROTEZ', 'bold');
  log('='.repeat(60), 'bold');
  log(`📍 URL: ${BASE_URL}`, 'blue');
  log(`⏱️  Timeout: ${TIMEOUT}ms`, 'blue');
  
  const startTime = Date.now();
  const client = new TestClient(BASE_URL);
  
  try {
    // Проверяем доступность сервера
    await client.request('/api/health');
  } catch (error) {
    log('\n❌ СЕРВЕР НЕДОСТУПЕН!', 'red');
    log(`Убедитесь что сервер запущен на ${BASE_URL}`, 'yellow');
    log('Запустите: npm run dev', 'yellow');
    process.exit(1);
  }
  
  // Запускаем тесты
  await testProductLifecycle(client);
  await testSearchAndFiltering(client);
  await testCategoryHierarchy(client);
  await testProductVariants(client);
  await testProductCharacteristics(client);
  await testPerformanceIntegration(client);
  await testErrorHandlingIntegration(client);
  
  // Итоги
  const duration = Date.now() - startTime;
  
  log('\n' + '='.repeat(60), 'bold');
  log('📊 РЕЗУЛЬТАТЫ ИНТЕГРАЦИОННОГО ТЕСТИРОВАНИЯ', 'bold');
  log('='.repeat(60), 'bold');
  
  // Детальная статистика по группам
  log('\n📋 ДЕТАЛИЗАЦИЯ ПО ГРУППАМ:', 'cyan');
  testGroups.forEach(group => {
    const passed = group.tests.filter(t => t.status === 'pass').length;
    const failed = group.tests.filter(t => t.status === 'fail').length;
    const rate = Math.round((passed / group.tests.length) * 100);
    const color = rate === 100 ? 'green' : rate >= 80 ? 'yellow' : 'red';
    
    log(`  ${group.name}: ${passed}/${group.tests.length} (${rate}%)`, color);
    
    if (failed > 0) {
      group.tests.filter(t => t.status === 'fail').forEach(test => {
        log(`    ❌ ${test.name}: ${test.error}`, 'dim');
      });
    }
  });
  
  log(`\n⏱️  Время выполнения: ${duration}ms`, 'blue');
  log(`📝 Всего тестов: ${totalTests}`, 'blue');
  log(`✅ Пройдено: ${passedTests}`, 'green');
  log(`❌ Провалено: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  const rateColor = successRate === 100 ? 'green' : successRate >= 80 ? 'yellow' : 'red';
  
  log(`\n📈 Успешность: ${successRate}%`, rateColor);
  
  if (failedTests === 0) {
    log('\n🎉 ВСЕ ИНТЕГРАЦИОННЫЕ ТЕСТЫ ПРОЙДЕНЫ!', 'green');
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
runIntegrationTests().catch(error => {
  log('\n💥 Ошибка выполнения тестов:', 'red');
  console.error(error);
  process.exit(1);
});