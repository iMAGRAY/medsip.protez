/**
 * КОМПЛЕКСНОЕ E2E ТЕСТИРОВАНИЕ ИНТЕРНЕТ-МАГАЗИНА МЕДИЦИНСКИХ ТОВАРОВ
 * 
 * Тестирует основную функциональность после множественных исправлений:
 * - Функциональные тесты страниц
 * - API тестирование
 * - Производительность
 * - Регрессионное тестирование
 * 
 * @author QA Automation Specialist
 * @created 2025-08-16
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

// Конфигурация тестирования
const CONFIG = {
  BASE_URL: 'http://localhost:3009',
  TIMEOUT: 10000,
  MAX_RETRIES: 3,
  PERFORMANCE_THRESHOLDS: {
    PAGE_LOAD: 3000,    // 3 секунды
    API_RESPONSE: 1000, // 1 секунда
    SEARCH: 1500        // 1.5 секунды
  }
};

// Результаты тестирования
const testResults = {
  startTime: new Date(),
  endTime: null,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  results: [],
  performance: [],
  issues: [],
  regression: []
};

/**
 * Утилитная функция для измерения времени выполнения
 */
function measureTime(startTime) {
  return Date.now() - startTime;
}

/**
 * Функция для выполнения HTTP запроса с таймингом
 */
async function fetchWithTiming(url, options = {}) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      timeout: CONFIG.TIMEOUT,
      ...options
    });
    const endTime = Date.now();
    const timing = endTime - startTime;
    
    return {
      response,
      timing,
      success: true
    };
  } catch (error) {
    const endTime = Date.now();
    const timing = endTime - startTime;
    
    return {
      response: null,
      timing,
      success: false,
      error: error.message
    };
  }
}

/**
 * Функция для логирования результатов тестов
 */
function logTestResult(testName, status, details = {}) {
  testResults.totalTests++;
  
  const result = {
    test: testName,
    status,
    timestamp: new Date(),
    ...details
  };
  
  testResults.results.push(result);
  
  if (status === 'PASS') {
    testResults.passedTests++;
    console.log(`✅ ${testName} - PASS`);
  } else if (status === 'FAIL') {
    testResults.failedTests++;
    console.log(`❌ ${testName} - FAIL: ${details.error || 'Unknown error'}`);
    if (details.error) {
      testResults.issues.push({
        test: testName,
        error: details.error,
        priority: details.priority || 'MEDIUM'
      });
    }
  } else if (status === 'SKIP') {
    testResults.skippedTests++;
    console.log(`⏭️ ${testName} - SKIP: ${details.reason || 'Skipped'}`);
  }
  
  if (details.timing) {
    testResults.performance.push({
      test: testName,
      timing: details.timing,
      threshold: details.threshold
    });
  }
}

/**
 * ТЕСТ 1: Проверка доступности основных страниц
 */
async function testMainPages() {
  console.log('\n🔍 ТЕСТИРОВАНИЕ ОСНОВНЫХ СТРАНИЦ');
  
  const pages = [
    { path: '/', name: 'Главная страница' },
    { path: '/about', name: 'Страница "О нас"' },
    { path: '/contacts', name: 'Страница контактов' },
    { path: '/manufacturers', name: 'Страница производителей' },
    { path: '/products', name: 'Каталог товаров' }
  ];
  
  for (const page of pages) {
    const url = `${CONFIG.BASE_URL}${page.path}`;
    const result = await fetchWithTiming(url);
    
    if (result.success && result.response.ok) {
      const isPerformant = result.timing <= CONFIG.PERFORMANCE_THRESHOLDS.PAGE_LOAD;
      logTestResult(
        `Загрузка: ${page.name}`,
        'PASS',
        {
          timing: result.timing,
          threshold: CONFIG.PERFORMANCE_THRESHOLDS.PAGE_LOAD,
          performant: isPerformant,
          url: url,
          status: result.response.status
        }
      );
      
      if (!isPerformant) {
        testResults.issues.push({
          test: `Производительность: ${page.name}`,
          error: `Время загрузки ${result.timing}ms превышает порог ${CONFIG.PERFORMANCE_THRESHOLDS.PAGE_LOAD}ms`,
          priority: 'LOW'
        });
      }
    } else {
      logTestResult(
        `Загрузка: ${page.name}`,
        'FAIL',
        {
          error: result.error || `HTTP ${result.response?.status}`,
          priority: 'HIGH',
          url: url
        }
      );
    }
  }
}

/**
 * ТЕСТ 2: Проверка API endpoints
 */
async function testAPIEndpoints() {
  console.log('\n🔍 ТЕСТИРОВАНИЕ API ENDPOINTS');
  
  const endpoints = [
    { path: '/api/health', name: 'Health Check' },
    { path: '/api/db-status', name: 'Database Status' },
    { path: '/api/cache-status', name: 'Cache Status' },
    { path: '/api/categories', name: 'Categories API' },
    { path: '/api/products', name: 'Products API' },
    { path: '/api/manufacturers', name: 'Manufacturers API' },
    { path: '/api/home', name: 'Home Data API' },
    { path: '/api/site-settings', name: 'Site Settings API' }
  ];
  
  for (const endpoint of endpoints) {
    const url = `${CONFIG.BASE_URL}${endpoint.path}`;
    const result = await fetchWithTiming(url);
    
    if (result.success && result.response.ok) {
      try {
        const data = await result.response.json();
        const isPerformant = result.timing <= CONFIG.PERFORMANCE_THRESHOLDS.API_RESPONSE;
        
        logTestResult(
          `API: ${endpoint.name}`,
          'PASS',
          {
            timing: result.timing,
            threshold: CONFIG.PERFORMANCE_THRESHOLDS.API_RESPONSE,
            performant: isPerformant,
            url: url,
            status: result.response.status,
            hasData: !!data
          }
        );
        
        if (!isPerformant) {
          testResults.issues.push({
            test: `API Производительность: ${endpoint.name}`,
            error: `Время ответа ${result.timing}ms превышает порог ${CONFIG.PERFORMANCE_THRESHOLDS.API_RESPONSE}ms`,
            priority: 'MEDIUM'
          });
        }
      } catch (jsonError) {
        logTestResult(
          `API: ${endpoint.name}`,
          'FAIL',
          {
            error: `Некорректный JSON: ${jsonError.message}`,
            priority: 'HIGH'
          }
        );
      }
    } else {
      // Для Redis API ожидаем ошибку, так как Redis отключен
      if (endpoint.path === '/api/redis-status') {
        logTestResult(
          `API: ${endpoint.name}`,
          'PASS',
          {
            note: 'Ожидаемая ошибка - Redis отключен',
            error: result.error || `HTTP ${result.response?.status}`
          }
        );
      } else {
        logTestResult(
          `API: ${endpoint.name}`,
          'FAIL',
          {
            error: result.error || `HTTP ${result.response?.status}`,
            priority: 'HIGH',
            url: url
          }
        );
      }
    }
  }
}

/**
 * ТЕСТ 3: Регрессионное тестирование - проверка товара ID 371
 */
async function testRegressionProductID371() {
  console.log('\n🔍 РЕГРЕССИОННОЕ ТЕСТИРОВАНИЕ: ТОВАР ID 371');
  
  // Тест 1: API запрос товара
  const apiUrl = `${CONFIG.BASE_URL}/api/products/371`;
  const apiResult = await fetchWithTiming(apiUrl);
  
  if (apiResult.success && apiResult.response.ok) {
    try {
      const productData = await apiResult.response.json();
      logTestResult(
        'Регрессия: API товара ID 371',
        'PASS',
        {
          timing: apiResult.timing,
          hasData: !!productData,
          productName: productData.name || 'Unknown'
        }
      );
      
      testResults.regression.push({
        test: 'Product ID 371 API',
        status: 'FIXED',
        data: productData
      });
    } catch (error) {
      logTestResult(
        'Регрессия: API товара ID 371',
        'FAIL',
        {
          error: `JSON Parse Error: ${error.message}`,
          priority: 'HIGH'
        }
      );
    }
  } else {
    logTestResult(
      'Регрессия: API товара ID 371',
      'FAIL',
      {
        error: apiResult.error || `HTTP ${apiResult.response?.status}`,
        priority: 'HIGH'
      }
    );
  }
  
  // Тест 2: Страница товара
  const pageUrl = `${CONFIG.BASE_URL}/products/371`;
  const pageResult = await fetchWithTiming(pageUrl);
  
  if (pageResult.success && pageResult.response.ok) {
    logTestResult(
      'Регрессия: Страница товара ID 371',
      'PASS',
      {
        timing: pageResult.timing,
        url: pageUrl
      }
    );
    
    testResults.regression.push({
      test: 'Product ID 371 Page',
      status: 'FIXED'
    });
  } else {
    logTestResult(
      'Регрессия: Страница товара ID 371',
      'FAIL',
      {
        error: pageResult.error || `HTTP ${pageResult.response?.status}`,
        priority: 'HIGH'
      }
    );
  }
}

/**
 * ТЕСТ 4: Проверка структуры категорий (8 корневых категорий)
 */
async function testCategoriesStructure() {
  console.log('\n🔍 ТЕСТИРОВАНИЕ СТРУКТУРЫ КАТЕГОРИЙ');
  
  const url = `${CONFIG.BASE_URL}/api/categories`;
  const result = await fetchWithTiming(url);
  
  if (result.success && result.response.ok) {
    try {
      const categories = await result.response.json();
      
      // Проверяем количество корневых категорий
      const rootCategories = categories.filter(cat => !cat.parent_id || cat.parent_id === null);
      const expectedRootCount = 8;
      
      if (rootCategories.length === expectedRootCount) {
        logTestResult(
          'Структура категорий: 8 корневых категорий',
          'PASS',
          {
            rootCategoriesCount: rootCategories.length,
            totalCategories: categories.length
          }
        );
        
        testResults.regression.push({
          test: 'Categories Structure',
          status: 'FIXED',
          rootCategories: rootCategories.length,
          totalCategories: categories.length
        });
      } else {
        logTestResult(
          'Структура категорий: 8 корневых категорий',
          'FAIL',
          {
            error: `Найдено ${rootCategories.length} корневых категорий, ожидалось ${expectedRootCount}`,
            priority: 'MEDIUM',
            rootCategoriesCount: rootCategories.length
          }
        );
      }
      
      // Проверяем наличие тестовых данных
      const testCategories = categories.filter(cat => 
        cat.name && (
          cat.name.toLowerCase().includes('test') ||
          cat.name.toLowerCase().includes('тест') ||
          cat.name.includes('xxx')
        )
      );
      
      if (testCategories.length === 0) {
        logTestResult(
          'Очистка: Удаление тестовых категорий',
          'PASS',
          {
            note: 'Тестовые категории успешно удалены'
          }
        );
        
        testResults.regression.push({
          test: 'Test Categories Cleanup',
          status: 'FIXED'
        });
      } else {
        logTestResult(
          'Очистка: Удаление тестовых категорий',
          'FAIL',
          {
            error: `Найдено ${testCategories.length} тестовых категорий`,
            priority: 'LOW',
            testCategories: testCategories.map(cat => cat.name)
          }
        );
      }
      
    } catch (error) {
      logTestResult(
        'Структура категорий: Парсинг данных',
        'FAIL',
        {
          error: `JSON Parse Error: ${error.message}`,
          priority: 'HIGH'
        }
      );
    }
  } else {
    logTestResult(
      'Структура категорий: API запрос',
      'FAIL',
      {
        error: result.error || `HTTP ${result.response?.status}`,
        priority: 'HIGH'
      }
    );
  }
}

/**
 * ТЕСТ 5: Проверка поиска товаров
 */
async function testSearchFunctionality() {
  console.log('\n🔍 ТЕСТИРОВАНИЕ ФУНКЦИИ ПОИСКА');
  
  const searchQueries = [
    'протез',
    'кисть',
    'стопа',
    'медицинский'
  ];
  
  for (const query of searchQueries) {
    const url = `${CONFIG.BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
    const result = await fetchWithTiming(url);
    
    if (result.success && result.response.ok) {
      try {
        const searchResults = await result.response.json();
        const isPerformant = result.timing <= CONFIG.PERFORMANCE_THRESHOLDS.SEARCH;
        
        logTestResult(
          `Поиск: "${query}"`,
          'PASS',
          {
            timing: result.timing,
            threshold: CONFIG.PERFORMANCE_THRESHOLDS.SEARCH,
            performant: isPerformant,
            resultsCount: searchResults.length || 0
          }
        );
        
        if (!isPerformant) {
          testResults.issues.push({
            test: `Производительность поиска: "${query}"`,
            error: `Время поиска ${result.timing}ms превышает порог ${CONFIG.PERFORMANCE_THRESHOLDS.SEARCH}ms`,
            priority: 'MEDIUM'
          });
        }
      } catch (error) {
        logTestResult(
          `Поиск: "${query}"`,
          'FAIL',
          {
            error: `JSON Parse Error: ${error.message}`,
            priority: 'MEDIUM'
          }
        );
      }
    } else {
      logTestResult(
        `Поиск: "${query}"`,
        'FAIL',
        {
          error: result.error || `HTTP ${result.response?.status}`,
          priority: 'MEDIUM'
        }
      );
    }
  }
}

/**
 * ТЕСТ 6: Проверка работы без Redis
 */
async function testNoRedisCompatibility() {
  console.log('\n🔍 ТЕСТИРОВАНИЕ СОВМЕСТИМОСТИ БЕЗ REDIS');
  
  // Проверяем статус Redis
  const redisUrl = `${CONFIG.BASE_URL}/api/redis-status`;
  const redisResult = await fetchWithTiming(redisUrl);
  
  if (!redisResult.success || !redisResult.response.ok) {
    logTestResult(
      'Redis: Статус отключения',
      'PASS',
      {
        note: 'Redis корректно отключен',
        expectedError: true
      }
    );
  } else {
    logTestResult(
      'Redis: Статус отключения',
      'FAIL',
      {
        error: 'Redis работает, но должен быть отключен',
        priority: 'LOW'
      }
    );
  }
  
  // Проверяем что основная функциональность работает без Redis
  const criticalPages = [
    `${CONFIG.BASE_URL}/`,
    `${CONFIG.BASE_URL}/api/products`,
    `${CONFIG.BASE_URL}/api/categories`
  ];
  
  let workingPagesCount = 0;
  for (const url of criticalPages) {
    const result = await fetchWithTiming(url);
    if (result.success && result.response.ok) {
      workingPagesCount++;
    }
  }
  
  if (workingPagesCount === criticalPages.length) {
    logTestResult(
      'Fallback: Работа без Redis',
      'PASS',
      {
        note: 'Все критические страницы работают без Redis',
        workingPages: workingPagesCount,
        totalPages: criticalPages.length
      }
    );
    
    testResults.regression.push({
      test: 'No Redis Compatibility',
      status: 'CONFIRMED'
    });
  } else {
    logTestResult(
      'Fallback: Работа без Redis',
      'FAIL',
      {
        error: `Только ${workingPagesCount} из ${criticalPages.length} страниц работают`,
        priority: 'HIGH'
      }
    );
  }
}

/**
 * Генерация финального отчета
 */
async function generateTestReport() {
  testResults.endTime = new Date();
  const duration = testResults.endTime - testResults.startTime;
  
  const report = {
    summary: {
      testSuite: 'Комплексное тестирование интернет-магазина медицинских товаров',
      timestamp: testResults.startTime,
      duration: `${Math.round(duration / 1000)}s`,
      totalTests: testResults.totalTests,
      passed: testResults.passedTests,
      failed: testResults.failedTests,
      skipped: testResults.skippedTests,
      successRate: `${Math.round((testResults.passedTests / testResults.totalTests) * 100)}%`
    },
    performanceMetrics: {
      averagePageLoad: Math.round(
        testResults.performance
          .filter(p => p.threshold === CONFIG.PERFORMANCE_THRESHOLDS.PAGE_LOAD)
          .reduce((sum, p) => sum + p.timing, 0) / 
        testResults.performance
          .filter(p => p.threshold === CONFIG.PERFORMANCE_THRESHOLDS.PAGE_LOAD).length || 1
      ),
      averageAPIResponse: Math.round(
        testResults.performance
          .filter(p => p.threshold === CONFIG.PERFORMANCE_THRESHOLDS.API_RESPONSE)
          .reduce((sum, p) => sum + p.timing, 0) / 
        testResults.performance
          .filter(p => p.threshold === CONFIG.PERFORMANCE_THRESHOLDS.API_RESPONSE).length || 1
      )
    },
    regressionValidation: {
      product371: testResults.regression.filter(r => r.test.includes('Product ID 371')),
      categoriesStructure: testResults.regression.filter(r => r.test.includes('Categories')),
      noRedisCompatibility: testResults.regression.filter(r => r.test.includes('Redis'))
    },
    issues: testResults.issues,
    detailedResults: testResults.results
  };
  
  // Сохраняем отчет
  const reportPath = path.join(process.cwd(), 'comprehensive-test-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  return report;
}

/**
 * Основная функция запуска тестирования
 */
async function runComprehensiveTesting() {
  console.log('🚀 ЗАПУСК КОМПЛЕКСНОГО ТЕСТИРОВАНИЯ СИСТЕМЫ');
  console.log(`📍 Базовый URL: ${CONFIG.BASE_URL}`);
  console.log(`⏱️ Начало: ${testResults.startTime.toISOString()}`);
  
  try {
    // Выполняем все тесты последовательно
    await testMainPages();
    await testAPIEndpoints();
    await testRegressionProductID371();
    await testCategoriesStructure();
    await testSearchFunctionality();
    await testNoRedisCompatibility();
    
    // Генерируем отчет
    const report = await generateTestReport();
    
    console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
    console.log(`✅ Пройдено: ${report.summary.passed}`);
    console.log(`❌ Провалено: ${report.summary.failed}`);
    console.log(`⏭️ Пропущено: ${report.summary.skipped}`);
    console.log(`📈 Успешность: ${report.summary.successRate}`);
    console.log(`⏱️ Длительность: ${report.summary.duration}`);
    
    if (testResults.issues.length > 0) {
      console.log(`\n⚠️ НАЙДЕННЫЕ ПРОБЛЕМЫ (${testResults.issues.length}):`);
      testResults.issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.priority}] ${issue.test}: ${issue.error}`);
      });
    }
    
    console.log(`\n📄 Детальный отчет сохранен: comprehensive-test-report.json`);
    
    return report;
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ТЕСТИРОВАНИЯ:', error);
    throw error;
  }
}

// Запуск тестирования если скрипт вызван напрямую
if (require.main === module) {
  runComprehensiveTesting()
    .then(() => {
      console.log('✅ Тестирование завершено успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Тестирование завершено с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = {
  runComprehensiveTesting,
  generateTestReport,
  CONFIG
};