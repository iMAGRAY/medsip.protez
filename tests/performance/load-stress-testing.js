/**
 * НАГРУЗОЧНОЕ И СТРЕСС ТЕСТИРОВАНИЕ API
 * 
 * Тестирует производительность системы под нагрузкой:
 * - Нагрузочное тестирование (50-100 одновременных запросов)
 * - Стресс тестирование (определение точки отказа)
 * - Мониторинг производительности
 * 
 * @author QA Automation Specialist
 * @created 2025-08-16
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;

// Конфигурация нагрузочного тестирования
const LOAD_CONFIG = {
  BASE_URL: 'http://localhost:3004',
  TESTS: {
    LIGHT_LOAD: { concurrent: 10, duration: 30 },    // Легкая нагрузка
    MODERATE_LOAD: { concurrent: 50, duration: 60 },  // Умеренная нагрузка
    HEAVY_LOAD: { concurrent: 100, duration: 30 },    // Тяжелая нагрузка
    STRESS_TEST: { concurrent: 200, duration: 15 }    // Стресс тест
  },
  ENDPOINTS: [
    { path: '/api/health', weight: 0.1, critical: true },
    { path: '/api/categories', weight: 0.3, critical: true },
    { path: '/api/products', weight: 0.4, critical: true },
    { path: '/api/manufacturers', weight: 0.15, critical: false },
    { path: '/api/search?q=протез', weight: 0.05, critical: false }
  ],
  THRESHOLDS: {
    SUCCESS_RATE: 95,     // 95% успешных запросов
    AVG_RESPONSE: 2000,   // 2 секунды средний ответ
    P95_RESPONSE: 5000,   // 5 секунд 95-й перцентиль
    MAX_ERRORS: 5         // Максимум 5% ошибок
  }
};

// Результаты тестирования
const loadTestResults = {
  startTime: new Date(),
  endTime: null,
  tests: [],
  summary: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    successRate: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    p95ResponseTime: 0,
    requestsPerSecond: 0
  },
  issues: [],
  recommendations: []
};

/**
 * Функция для выполнения одного HTTP запроса с метриками
 */
async function makeRequest(url, requestId) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      timeout: 30000, // 30 секунд таймаут для нагрузочных тестов
      headers: {
        'User-Agent': `LoadTest-${requestId}`,
        'Accept': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      success: true,
      status: response.status,
      responseTime,
      timestamp: startTime,
      size: parseInt(response.headers.get('content-length') || '0'),
      url
    };
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      success: false,
      status: 0,
      responseTime,
      timestamp: startTime,
      error: error.message,
      url
    };
  }
}

/**
 * Функция для выбора случайного endpoint на основе весов
 */
function selectRandomEndpoint() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const endpoint of LOAD_CONFIG.ENDPOINTS) {
    cumulativeWeight += endpoint.weight;
    if (random <= cumulativeWeight) {
      return `${LOAD_CONFIG.BASE_URL}${endpoint.path}`;
    }
  }
  
  // Fallback - возвращаем первый endpoint
  return `${LOAD_CONFIG.BASE_URL}${LOAD_CONFIG.ENDPOINTS[0].path}`;
}

/**
 * Функция для выполнения нагрузочного теста
 */
async function runLoadTest(testName, config) {
  console.log(`\n🔥 Запуск ${testName}:`);
  console.log(`   Одновременных запросов: ${config.concurrent}`);
  console.log(`   Длительность: ${config.duration}s`);
  
  const testResults = {
    name: testName,
    config,
    startTime: Date.now(),
    requests: [],
    metrics: {}
  };
  
  const promises = [];
  const requestInterval = (config.duration * 1000) / (config.concurrent * 10); // Интервал между запросами
  
  // Запускаем конкурентные запросы
  for (let i = 0; i < config.concurrent; i++) {
    const workerPromise = async () => {
      const endTime = Date.now() + (config.duration * 1000);
      let requestCount = 0;
      
      while (Date.now() < endTime) {
        const url = selectRandomEndpoint();
        const requestId = `${testName}-${i}-${requestCount}`;
        
        const result = await makeRequest(url, requestId);
        testResults.requests.push(result);
        
        requestCount++;
        
        // Небольшая пауза между запросами для реалистичности
        if (requestInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, requestInterval));
        }
      }
    };
    
    promises.push(workerPromise());
  }
  
  // Ждем завершения всех worker'ов
  await Promise.all(promises);
  
  testResults.endTime = Date.now();
  testResults.duration = testResults.endTime - testResults.startTime;
  
  // Рассчитываем метрики
  calculateMetrics(testResults);
  
  loadTestResults.tests.push(testResults);
  
  // Выводим результаты
  console.log(`   ✅ Запросов выполнено: ${testResults.requests.length}`);
  console.log(`   📈 Успешность: ${testResults.metrics.successRate.toFixed(2)}%`);
  console.log(`   ⏱️ Среднее время ответа: ${testResults.metrics.avgResponseTime.toFixed(0)}ms`);
  console.log(`   📊 95-й перцентиль: ${testResults.metrics.p95ResponseTime.toFixed(0)}ms`);
  console.log(`   🔄 Запросов в секунду: ${testResults.metrics.requestsPerSecond.toFixed(2)}`);
  
  // Проверяем соответствие порогам
  validateThresholds(testResults);
  
  return testResults;
}

/**
 * Функция для расчета метрик производительности
 */
function calculateMetrics(testResults) {
  const { requests } = testResults;
  
  if (requests.length === 0) {
    testResults.metrics = {
      successRate: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      requestsPerSecond: 0
    };
    return;
  }
  
  const successfulRequests = requests.filter(r => r.success);
  const responseTimes = requests.map(r => r.responseTime);
  const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
  
  const successRate = (successfulRequests.length / requests.length) * 100;
  const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);
  const p95Index = Math.floor(responseTimes.length * 0.95);
  const p95ResponseTime = sortedResponseTimes[p95Index] || 0;
  const requestsPerSecond = (requests.length / (testResults.duration / 1000));
  
  testResults.metrics = {
    successRate,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    p95ResponseTime,
    requestsPerSecond,
    totalRequests: requests.length,
    successfulRequests: successfulRequests.length,
    failedRequests: requests.length - successfulRequests.length
  };
  
  // Обновляем общую статистику
  loadTestResults.summary.totalRequests += requests.length;
  loadTestResults.summary.successfulRequests += successfulRequests.length;
  loadTestResults.summary.failedRequests += (requests.length - successfulRequests.length);
}

/**
 * Функция для проверки соответствия порогам производительности
 */
function validateThresholds(testResults) {
  const { metrics } = testResults;
  const { THRESHOLDS } = LOAD_CONFIG;
  
  // Проверка успешности запросов
  if (metrics.successRate < THRESHOLDS.SUCCESS_RATE) {
    const issue = {
      test: testResults.name,
      metric: 'Success Rate',
      value: `${metrics.successRate.toFixed(2)}%`,
      threshold: `${THRESHOLDS.SUCCESS_RATE}%`,
      priority: 'HIGH',
      description: 'Процент успешных запросов ниже допустимого порога'
    };
    loadTestResults.issues.push(issue);
    console.log(`   ⚠️ ПРОБЛЕМА: Успешность ${metrics.successRate.toFixed(2)}% < ${THRESHOLDS.SUCCESS_RATE}%`);
  }
  
  // Проверка среднего времени ответа
  if (metrics.avgResponseTime > THRESHOLDS.AVG_RESPONSE) {
    const issue = {
      test: testResults.name,
      metric: 'Average Response Time',
      value: `${metrics.avgResponseTime.toFixed(0)}ms`,
      threshold: `${THRESHOLDS.AVG_RESPONSE}ms`,
      priority: 'MEDIUM',
      description: 'Среднее время ответа превышает допустимый порог'
    };
    loadTestResults.issues.push(issue);
    console.log(`   ⚠️ ПРОБЛЕМА: Среднее время ${metrics.avgResponseTime.toFixed(0)}ms > ${THRESHOLDS.AVG_RESPONSE}ms`);
  }
  
  // Проверка 95-го перцентиля
  if (metrics.p95ResponseTime > THRESHOLDS.P95_RESPONSE) {
    const issue = {
      test: testResults.name,
      metric: '95th Percentile Response Time',
      value: `${metrics.p95ResponseTime.toFixed(0)}ms`,
      threshold: `${THRESHOLDS.P95_RESPONSE}ms`,
      priority: 'MEDIUM',
      description: '95-й перцентиль времени ответа превышает допустимый порог'
    };
    loadTestResults.issues.push(issue);
    console.log(`   ⚠️ ПРОБЛЕМА: P95 время ${metrics.p95ResponseTime.toFixed(0)}ms > ${THRESHOLDS.P95_RESPONSE}ms`);
  }
}

/**
 * Функция для определения рекомендаций по оптимизации
 */
function generateRecommendations() {
  const { summary, issues } = loadTestResults;
  
  // Рекомендации по производительности
  if (summary.avgResponseTime > 1000) {
    loadTestResults.recommendations.push({
      category: 'Performance',
      priority: 'HIGH',
      title: 'Оптимизация времени ответа API',
      description: 'Среднее время ответа API превышает 1 секунду. Рекомендуется оптимизация запросов к базе данных и добавление кэширования.',
      actions: [
        'Добавить индексы к часто используемым запросам БД',
        'Реализовать Redis кэширование для API endpoints',
        'Оптимизировать N+1 запросы в ORM',
        'Рассмотреть использование connection pooling'
      ]
    });
  }
  
  if (summary.successRate < 95) {
    loadTestResults.recommendations.push({
      category: 'Reliability',
      priority: 'CRITICAL',
      title: 'Улучшение стабильности системы',
      description: 'Процент успешных запросов ниже 95%. Система нестабильна под нагрузкой.',
      actions: [
        'Увеличить timeout для API запросов',
        'Добавить retry механизм для неуспешных запросов',
        'Улучшить error handling в API endpoints',
        'Рассмотреть горизонтальное масштабирование'
      ]
    });
  }
  
  // Рекомендации по масштабированию
  const maxRPS = Math.max(...loadTestResults.tests.map(t => t.metrics.requestsPerSecond));
  if (maxRPS < 50) {
    loadTestResults.recommendations.push({
      category: 'Scalability',
      priority: 'MEDIUM',
      title: 'Увеличение пропускной способности',
      description: 'Система обрабатывает менее 50 запросов в секунду. Для production рекомендуется повышение пропускной способности.',
      actions: [
        'Оптимизировать алгоритмы обработки запросов',
        'Рассмотреть использование CDN для статического контента',
        'Добавить load balancer для распределения нагрузки',
        'Увеличить ресурсы сервера (CPU, RAM)'
      ]
    });
  }
}

/**
 * Главная функция для запуска всех нагрузочных тестов
 */
async function runComprehensiveLoadTesting() {
  console.log('🚀 ЗАПУСК КОМПЛЕКСНОГО НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ');
  console.log(`📍 Базовый URL: ${LOAD_CONFIG.BASE_URL}`);
  console.log(`⏱️ Начало: ${loadTestResults.startTime.toISOString()}`);
  
  try {
    // Тест 1: Легкая нагрузка (базовый тест)
    await runLoadTest('Легкая нагрузка', LOAD_CONFIG.TESTS.LIGHT_LOAD);
    
    // Небольшая пауза между тестами
    console.log('\n⏸️ Пауза 10 секунд между тестами...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Тест 2: Умеренная нагрузка
    await runLoadTest('Умеренная нагрузка', LOAD_CONFIG.TESTS.MODERATE_LOAD);
    
    // Пауза перед тяжелыми тестами
    console.log('\n⏸️ Пауза 15 секунд перед тяжелыми тестами...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Тест 3: Тяжелая нагрузка
    await runLoadTest('Тяжелая нагрузка', LOAD_CONFIG.TESTS.HEAVY_LOAD);
    
    // Пауза перед стресс тестом
    console.log('\n⏸️ Пауза 20 секунд перед стресс тестом...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Тест 4: Стресс тест (определение точки отказа)
    await runLoadTest('Стресс тест', LOAD_CONFIG.TESTS.STRESS_TEST);
    
    // Финализация результатов
    loadTestResults.endTime = new Date();
    
    // Рассчитываем общую статистику
    if (loadTestResults.summary.totalRequests > 0) {
      loadTestResults.summary.successRate = 
        (loadTestResults.summary.successfulRequests / loadTestResults.summary.totalRequests) * 100;
      
      const allResponseTimes = loadTestResults.tests
        .flatMap(test => test.requests.map(req => req.responseTime));
      
      loadTestResults.summary.avgResponseTime = 
        allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
      
      loadTestResults.summary.minResponseTime = Math.min(...allResponseTimes);
      loadTestResults.summary.maxResponseTime = Math.max(...allResponseTimes);
      
      const sortedTimes = allResponseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(allResponseTimes.length * 0.95);
      loadTestResults.summary.p95ResponseTime = sortedTimes[p95Index] || 0;
      
      const totalDuration = (loadTestResults.endTime - loadTestResults.startTime) / 1000;
      loadTestResults.summary.requestsPerSecond = loadTestResults.summary.totalRequests / totalDuration;
    }
    
    // Генерируем рекомендации
    generateRecommendations();
    
    // Сохраняем отчет
    await saveLoadTestReport();
    
    // Выводим итоговую статистику
    printFinalResults();
    
    return loadTestResults;
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ:', error);
    throw error;
  }
}

/**
 * Функция для сохранения отчета нагрузочного тестирования
 */
async function saveLoadTestReport() {
  const reportPath = 'load-stress-test-report.json';
  await fs.writeFile(reportPath, JSON.stringify(loadTestResults, null, 2));
  console.log(`\n📄 Отчет нагрузочного тестирования сохранен: ${reportPath}`);
}

/**
 * Функция для вывода итоговых результатов
 */
function printFinalResults() {
  const { summary, issues, recommendations } = loadTestResults;
  
  console.log('\n📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ:');
  console.log(`📈 Общая статистика:`);
  console.log(`   Всего запросов: ${summary.totalRequests}`);
  console.log(`   Успешных: ${summary.successfulRequests} (${summary.successRate.toFixed(2)}%)`);
  console.log(`   Неудачных: ${summary.failedRequests}`);
  console.log(`   Среднее время ответа: ${summary.avgResponseTime.toFixed(0)}ms`);
  console.log(`   Min/Max время: ${summary.minResponseTime}ms / ${summary.maxResponseTime}ms`);
  console.log(`   95-й перцентиль: ${summary.p95ResponseTime.toFixed(0)}ms`);
  console.log(`   Запросов в секунду: ${summary.requestsPerSecond.toFixed(2)}`);
  
  if (issues.length > 0) {
    console.log(`\n⚠️ НАЙДЕННЫЕ ПРОБЛЕМЫ ПРОИЗВОДИТЕЛЬНОСТИ (${issues.length}):`);
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.priority}] ${issue.test} - ${issue.metric}:`);
      console.log(`   ${issue.description}`);
      console.log(`   Значение: ${issue.value}, Порог: ${issue.threshold}`);
    });
  }
  
  if (recommendations.length > 0) {
    console.log(`\n💡 РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ (${recommendations.length}):`);
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority}] ${rec.title}:`);
      console.log(`   ${rec.description}`);
      console.log(`   Действия:`);
      rec.actions.forEach((action, actionIndex) => {
        console.log(`     ${actionIndex + 1}) ${action}`);
      });
    });
  }
  
  // Общая оценка производительности
  let performanceGrade = 'A';
  if (summary.successRate < 95) performanceGrade = 'F';
  else if (summary.avgResponseTime > 2000) performanceGrade = 'D';
  else if (summary.avgResponseTime > 1000) performanceGrade = 'C';
  else if (summary.avgResponseTime > 500) performanceGrade = 'B';
  
  console.log(`\n🎯 ОБЩАЯ ОЦЕНКА ПРОИЗВОДИТЕЛЬНОСТИ: ${performanceGrade}`);
  
  const duration = (loadTestResults.endTime - loadTestResults.startTime) / 1000;
  console.log(`⏱️ Общая длительность тестирования: ${Math.round(duration)}s`);
}

// Запуск тестирования если скрипт вызван напрямую
if (require.main === module) {
  runComprehensiveLoadTesting()
    .then(() => {
      console.log('✅ Нагрузочное тестирование завершено успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Нагрузочное тестирование завершено с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = {
  runComprehensiveLoadTesting,
  LOAD_CONFIG
};