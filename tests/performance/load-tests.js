#!/usr/bin/env node

/**
 * ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ И НАГРУЗКИ ДЛЯ MEDSIP.PROTEZ
 * Проверка производительности под нагрузкой
 * 
 * Запуск: node tests/performance/load-tests.js
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { performance } = require('perf_hooks');

// Конфигурация
const BASE_URL = process.env.TEST_URL || 'http://localhost:3009';
const TIMEOUT = 30000; // Больше времени для нагрузочных тестов

// Настройки нагрузки
const LOAD_CONFIG = {
  small: { concurrent: 5, requests: 20 },      // Малая нагрузка
  medium: { concurrent: 10, requests: 50 },    // Средняя нагрузка
  large: { concurrent: 20, requests: 100 },    // Высокая нагрузка
  stress: { concurrent: 50, requests: 200 }    // Стресс-тест
};

// Пороги производительности (в миллисекундах)
const THRESHOLDS = {
  api: {
    p50: 200,   // 50% запросов быстрее
    p90: 500,   // 90% запросов быстрее
    p95: 1000,  // 95% запросов быстрее
    p99: 2000   // 99% запросов быстрее
  },
  page: {
    p50: 500,
    p90: 1000,
    p95: 2000,
    p99: 3000
  },
  database: {
    p50: 50,
    p90: 100,
    p95: 200,
    p99: 500
  }
};

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

// Статистика
let testResults = [];

// Утилиты
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logMetric(name, value, unit = 'ms', threshold = null) {
  let color = 'blue';
  let status = '';
  
  if (threshold) {
    if (value <= threshold) {
      color = 'green';
      status = ' ✅';
    } else if (value <= threshold * 1.5) {
      color = 'yellow';
      status = ' ⚠️';
    } else {
      color = 'red';
      status = ' ❌';
    }
  }
  
  log(`  ${name}: ${value.toFixed(2)}${unit}${status}`, color);
}

// HTTP клиент для нагрузочного тестирования
class LoadTestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.metrics = [];
  }

  async request(path, options = {}) {
    const startTime = performance.now();
    
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
          'Connection': 'keep-alive',
          ...options.headers
        },
        timeout: TIMEOUT,
        agent: new (url.protocol === 'https:' ? https : http).Agent({
          keepAlive: true,
          maxSockets: 100
        })
      };

      const req = client.request(reqOptions, (res) => {
        let data = '';
        const firstByteTime = performance.now() - startTime;
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const totalTime = performance.now() - startTime;
          
          const metric = {
            path,
            status: res.statusCode,
            ttfb: firstByteTime,  // Time to first byte
            total: totalTime,
            size: data.length,
            timestamp: Date.now()
          };
          
          this.metrics.push(metric);
          
          resolve({
            ...metric,
            data: data
          });
        });
      });

      req.on('error', (error) => {
        const totalTime = performance.now() - startTime;
        
        const metric = {
          path,
          status: 0,
          error: error.message,
          total: totalTime,
          timestamp: Date.now()
        };
        
        this.metrics.push(metric);
        reject(error);
      });

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

  getMetrics() {
    if (this.metrics.length === 0) return null;
    
    const successfulRequests = this.metrics.filter(m => m.status >= 200 && m.status < 400);
    const failedRequests = this.metrics.filter(m => m.status === 0 || m.status >= 400);
    
    const times = successfulRequests.map(m => m.total).sort((a, b) => a - b);
    const ttfbs = successfulRequests.map(m => m.ttfb).filter(t => t).sort((a, b) => a - b);
    
    return {
      total: this.metrics.length,
      successful: successfulRequests.length,
      failed: failedRequests.length,
      errorRate: (failedRequests.length / this.metrics.length) * 100,
      
      // Время ответа
      min: times[0] || 0,
      max: times[times.length - 1] || 0,
      mean: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      median: times[Math.floor(times.length / 2)] || 0,
      p50: times[Math.floor(times.length * 0.5)] || 0,
      p90: times[Math.floor(times.length * 0.9)] || 0,
      p95: times[Math.floor(times.length * 0.95)] || 0,
      p99: times[Math.floor(times.length * 0.99)] || 0,
      
      // Time to first byte
      ttfb_mean: ttfbs.length > 0 ? ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length : 0,
      ttfb_median: ttfbs[Math.floor(ttfbs.length / 2)] || 0,
      
      // Пропускная способность
      totalBytes: successfulRequests.reduce((sum, m) => sum + (m.size || 0), 0),
      requestsPerSecond: 0, // Вычислится позже
      
      // Ошибки
      errors: failedRequests.map(m => m.error).filter(e => e)
    };
  }

  reset() {
    this.metrics = [];
  }
}

// Функции для нагрузочного тестирования
async function runConcurrentRequests(client, endpoint, count, concurrent) {
  const startTime = performance.now();
  const promises = [];
  
  for (let i = 0; i < count; i++) {
    // Ограничиваем количество одновременных запросов
    if (promises.length >= concurrent) {
      await Promise.race(promises.map((p, idx) => p.then(() => idx)))
        .then(idx => promises.splice(idx, 1));
    }
    
    const promise = client.request(endpoint)
      .catch(error => ({ error: error.message }));
    promises.push(promise);
  }
  
  // Ждем завершения всех запросов
  await Promise.all(promises);
  
  const duration = (performance.now() - startTime) / 1000; // в секундах
  const metrics = client.getMetrics();
  
  if (metrics) {
    metrics.requestsPerSecond = metrics.successful / duration;
    metrics.duration = duration;
  }
  
  return metrics;
}

// ТЕСТ: Производительность основных endpoints
async function testEndpointPerformance() {
  log('\n⚡ ПРОИЗВОДИТЕЛЬНОСТЬ ОСНОВНЫХ ENDPOINTS', 'cyan');
  
  const client = new LoadTestClient(BASE_URL);
  const endpoints = [
    { path: '/api/health', threshold: THRESHOLDS.api },
    { path: '/api/products?limit=10', threshold: THRESHOLDS.api },
    { path: '/api/categories', threshold: THRESHOLDS.api },
    { path: '/api/manufacturers', threshold: THRESHOLDS.api },
    { path: '/api/products/search?q=протез', threshold: THRESHOLDS.api }
  ];
  
  for (const endpoint of endpoints) {
    log(`\n  Testing: ${endpoint.path}`, 'dim');
    client.reset();
    
    const metrics = await runConcurrentRequests(
      client, 
      endpoint.path, 
      20,  // 20 запросов
      5    // 5 одновременно
    );
    
    if (metrics) {
      logMetric('P50', metrics.p50, 'ms', endpoint.threshold.p50);
      logMetric('P90', metrics.p90, 'ms', endpoint.threshold.p90);
      logMetric('P95', metrics.p95, 'ms', endpoint.threshold.p95);
      logMetric('P99', metrics.p99, 'ms', endpoint.threshold.p99);
      logMetric('RPS', metrics.requestsPerSecond, ' req/s');
      
      if (metrics.errorRate > 0) {
        log(`  Error rate: ${metrics.errorRate.toFixed(2)}%`, 'red');
      }
      
      testResults.push({
        endpoint: endpoint.path,
        metrics
      });
    }
  }
}

// ТЕСТ: Нагрузочное тестирование
async function testLoadScenarios() {
  log('\n🔥 НАГРУЗОЧНОЕ ТЕСТИРОВАНИЕ', 'cyan');
  
  const scenarios = [
    { name: 'Малая нагрузка', config: LOAD_CONFIG.small },
    { name: 'Средняя нагрузка', config: LOAD_CONFIG.medium },
    { name: 'Высокая нагрузка', config: LOAD_CONFIG.large }
  ];
  
  for (const scenario of scenarios) {
    log(`\n  ${scenario.name} (${scenario.config.concurrent} concurrent, ${scenario.config.requests} requests)`, 'bold');
    
    const client = new LoadTestClient(BASE_URL);
    const metrics = await runConcurrentRequests(
      client,
      '/api/products?limit=10',
      scenario.config.requests,
      scenario.config.concurrent
    );
    
    if (metrics) {
      log(`    Успешно: ${metrics.successful}/${metrics.total}`, 'green');
      log(`    Ошибки: ${metrics.failed}`, metrics.failed > 0 ? 'red' : 'green');
      logMetric('    Среднее время', metrics.mean);
      logMetric('    P95', metrics.p95);
      logMetric('    RPS', metrics.requestsPerSecond, ' req/s');
      
      testResults.push({
        scenario: scenario.name,
        metrics
      });
    }
  }
}

// ТЕСТ: Стресс-тестирование
async function testStressScenario() {
  log('\n💥 СТРЕСС-ТЕСТИРОВАНИЕ', 'cyan');
  log('  Внимание: этот тест создает высокую нагрузку!', 'yellow');
  
  const client = new LoadTestClient(BASE_URL);
  const config = LOAD_CONFIG.stress;
  
  log(`  Запуск: ${config.concurrent} concurrent, ${config.requests} requests`, 'dim');
  
  const metrics = await runConcurrentRequests(
    client,
    '/api/products?limit=50',
    config.requests,
    config.concurrent
  );
  
  if (metrics) {
    log(`\n  Результаты стресс-теста:`, 'bold');
    log(`    Всего запросов: ${metrics.total}`, 'blue');
    log(`    Успешных: ${metrics.successful} (${((metrics.successful/metrics.total)*100).toFixed(1)}%)`, 
        metrics.successful/metrics.total > 0.95 ? 'green' : 'red');
    log(`    Ошибок: ${metrics.failed} (${metrics.errorRate.toFixed(1)}%)`, 
        metrics.errorRate < 5 ? 'green' : 'red');
    
    logMetric('    Минимальное время', metrics.min);
    logMetric('    Максимальное время', metrics.max);
    logMetric('    Среднее время', metrics.mean);
    logMetric('    P95', metrics.p95);
    logMetric('    P99', metrics.p99);
    logMetric('    RPS', metrics.requestsPerSecond, ' req/s');
    
    if (metrics.errors.length > 0) {
      log(`\n    Типы ошибок:`, 'red');
      const errorCounts = {};
      metrics.errors.forEach(e => {
        errorCounts[e] = (errorCounts[e] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([error, count]) => {
        log(`      ${error}: ${count}`, 'dim');
      });
    }
    
    testResults.push({
      scenario: 'Стресс-тест',
      metrics
    });
  }
}

// ТЕСТ: Производительность базы данных
async function testDatabasePerformance() {
  log('\n🗄️ ПРОИЗВОДИТЕЛЬНОСТЬ БАЗЫ ДАННЫХ', 'cyan');
  
  const client = new LoadTestClient(BASE_URL);
  const queries = [
    { name: 'Health check', path: '/api/db-status' },
    { name: 'Простой SELECT', path: '/api/products?limit=1' },
    { name: 'JOIN запрос', path: '/api/products?limit=10' },
    { name: 'Поиск LIKE', path: '/api/products/search?q=мод' },
    { name: 'Агрегация', path: '/api/categories' }
  ];
  
  for (const query of queries) {
    log(`\n  ${query.name}`, 'dim');
    client.reset();
    
    // Делаем 10 последовательных запросов для точности
    for (let i = 0; i < 10; i++) {
      await client.request(query.path).catch(() => {});
    }
    
    const metrics = client.getMetrics();
    if (metrics && metrics.successful > 0) {
      logMetric('Среднее время', metrics.mean, 'ms', THRESHOLDS.database.p50);
      logMetric('P90', metrics.p90, 'ms', THRESHOLDS.database.p90);
      logMetric('P95', metrics.p95, 'ms', THRESHOLDS.database.p95);
    }
  }
}

// ТЕСТ: Кэширование
async function testCachingPerformance() {
  log('\n💾 ПРОИЗВОДИТЕЛЬНОСТЬ КЭШИРОВАНИЯ', 'cyan');
  
  const client = new LoadTestClient(BASE_URL);
  const endpoint = '/api/categories'; // Endpoint который должен кэшироваться
  
  // Первый запрос (холодный кэш)
  log('\n  Холодный кэш:', 'dim');
  client.reset();
  await client.request(endpoint);
  const coldMetrics = client.getMetrics();
  if (coldMetrics) {
    logMetric('Время ответа', coldMetrics.mean);
  }
  
  // Последующие запросы (горячий кэш)
  log('\n  Горячий кэш (10 запросов):', 'dim');
  client.reset();
  for (let i = 0; i < 10; i++) {
    await client.request(endpoint);
  }
  const hotMetrics = client.getMetrics();
  if (hotMetrics) {
    logMetric('Среднее время', hotMetrics.mean);
    
    if (coldMetrics && hotMetrics.mean < coldMetrics.mean) {
      const improvement = ((coldMetrics.mean - hotMetrics.mean) / coldMetrics.mean * 100);
      log(`  Улучшение: ${improvement.toFixed(1)}% 🚀`, 'green');
    }
  }
}

// ТЕСТ: Параллельные операции
async function testConcurrentOperations() {
  log('\n🔀 ПАРАЛЛЕЛЬНЫЕ ОПЕРАЦИИ', 'cyan');
  
  const client = new LoadTestClient(BASE_URL);
  
  // Разные типы операций одновременно
  const operations = [
    '/api/products?limit=10',
    '/api/categories',
    '/api/manufacturers',
    '/api/products/search?q=test',
    '/api/health'
  ];
  
  log('\n  Запуск 5 разных операций параллельно (10 раз):', 'dim');
  
  const startTime = performance.now();
  const promises = [];
  
  for (let i = 0; i < 10; i++) {
    for (const op of operations) {
      promises.push(client.request(op).catch(() => {}));
    }
  }
  
  await Promise.all(promises);
  const duration = performance.now() - startTime;
  
  const metrics = client.getMetrics();
  if (metrics) {
    log(`    Всего операций: ${metrics.total}`, 'blue');
    log(`    Успешных: ${metrics.successful}`, 'green');
    log(`    Общее время: ${duration.toFixed(2)}ms`, 'blue');
    logMetric('    Среднее время/операция', metrics.mean);
    logMetric('    RPS', metrics.successful / (duration / 1000), ' ops/s');
  }
}

// Генерация отчета
function generateReport() {
  log('\n' + '='.repeat(60), 'bold');
  log('📊 ИТОГОВЫЙ ОТЧЕТ ПРОИЗВОДИТЕЛЬНОСТИ', 'bold');
  log('='.repeat(60), 'bold');
  
  // Анализ результатов
  let totalTests = testResults.length;
  let passedThresholds = 0;
  let warnings = [];
  let criticals = [];
  
  testResults.forEach(result => {
    if (result.metrics) {
      // Проверяем пороги
      if (result.metrics.p95 < 1000) passedThresholds++;
      if (result.metrics.p95 > 2000) {
        criticals.push(`${result.endpoint || result.scenario}: P95 = ${result.metrics.p95.toFixed(0)}ms`);
      } else if (result.metrics.p95 > 1000) {
        warnings.push(`${result.endpoint || result.scenario}: P95 = ${result.metrics.p95.toFixed(0)}ms`);
      }
      
      // Проверяем ошибки
      if (result.metrics.errorRate > 5) {
        criticals.push(`${result.endpoint || result.scenario}: Error rate = ${result.metrics.errorRate.toFixed(1)}%`);
      }
    }
  });
  
  // Выводим сводку
  log('\n📈 ОБЩАЯ ПРОИЗВОДИТЕЛЬНОСТЬ:', 'cyan');
  const performanceScore = (passedThresholds / totalTests) * 100;
  const scoreColor = performanceScore > 80 ? 'green' : performanceScore > 60 ? 'yellow' : 'red';
  log(`  Оценка производительности: ${performanceScore.toFixed(0)}%`, scoreColor);
  
  if (warnings.length > 0) {
    log('\n⚠️  ПРЕДУПРЕЖДЕНИЯ:', 'yellow');
    warnings.forEach(w => log(`  • ${w}`, 'yellow'));
  }
  
  if (criticals.length > 0) {
    log('\n❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ:', 'red');
    criticals.forEach(c => log(`  • ${c}`, 'red'));
  }
  
  // Рекомендации
  log('\n💡 РЕКОМЕНДАЦИИ:', 'magenta');
  
  if (criticals.length > 0) {
    log('  • Требуется оптимизация медленных endpoints', 'dim');
    log('  • Проверьте индексы базы данных', 'dim');
    log('  • Рассмотрите добавление кэширования', 'dim');
  }
  
  if (performanceScore < 80) {
    log('  • Включите сжатие ответов (gzip)', 'dim');
    log('  • Оптимизируйте размер ответов API', 'dim');
    log('  • Используйте пагинацию для больших данных', 'dim');
  }
  
  log('  • Настройте мониторинг производительности', 'dim');
  log('  • Регулярно запускайте нагрузочные тесты', 'dim');
  log('  • Используйте CDN для статических ресурсов', 'dim');
}

// ГЛАВНАЯ ФУНКЦИЯ
async function runPerformanceTests() {
  log('\n' + '='.repeat(60), 'bold');
  log('⚡ ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ MEDSIP.PROTEZ', 'bold');
  log('='.repeat(60), 'bold');
  log(`📍 URL: ${BASE_URL}`, 'blue');
  log(`⏱️  Timeout: ${TIMEOUT}ms`, 'blue');
  
  const startTime = Date.now();
  
  try {
    // Проверяем доступность сервера
    const client = new LoadTestClient(BASE_URL);
    await client.request('/api/health');
  } catch (error) {
    log('\n❌ СЕРВЕР НЕДОСТУПЕН!', 'red');
    log(`Убедитесь что сервер запущен на ${BASE_URL}`, 'yellow');
    log('Запустите: npm run dev', 'yellow');
    process.exit(1);
  }
  
  // Запускаем тесты
  await testEndpointPerformance();
  await testDatabasePerformance();
  await testCachingPerformance();
  await testConcurrentOperations();
  await testLoadScenarios();
  
  // Стресс-тест опционально
  if (process.env.RUN_STRESS_TEST === 'true') {
    await testStressScenario();
  } else {
    log('\n💡 Стресс-тест пропущен. Запустите с RUN_STRESS_TEST=true', 'yellow');
  }
  
  // Генерируем отчет
  generateReport();
  
  const duration = Date.now() - startTime;
  log(`\n⏱️  Общее время тестирования: ${(duration/1000).toFixed(2)}s`, 'blue');
  
  // Exit код основан на производительности
  const performanceScore = (testResults.filter(r => r.metrics && r.metrics.p95 < 1000).length / testResults.length) * 100;
  
  if (performanceScore >= 80) {
    log('\n🎉 ПРОИЗВОДИТЕЛЬНОСТЬ ОТЛИЧНАЯ!', 'green');
    process.exit(0);
  } else if (performanceScore >= 60) {
    log('\n⚠️  ПРОИЗВОДИТЕЛЬНОСТЬ ТРЕБУЕТ УЛУЧШЕНИЯ', 'yellow');
    process.exit(0);
  } else {
    log('\n❌ ПРОИЗВОДИТЕЛЬНОСТЬ НЕУДОВЛЕТВОРИТЕЛЬНАЯ', 'red');
    process.exit(1);
  }
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  log('\n💥 Критическая ошибка:', 'red');
  console.error(error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('\n\n⚠️  Тестирование прервано пользователем', 'yellow');
  process.exit(0);
});

// Запуск тестов
runPerformanceTests().catch(error => {
  log('\n💥 Ошибка выполнения тестов:', 'red');
  console.error(error);
  process.exit(1);
});