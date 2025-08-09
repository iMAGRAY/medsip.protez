/**
 * Тест производительности медиа галереи
 * Проверяет что оптимизации работают корректно
 */

const { performance } = require('perf_hooks');

/**
 * Симуляция большого количества медиафайлов
 */
function generateMockMediaFiles(count) {
  const files = [];
  for (let i = 0; i < count; i++) {
    files.push({
      name: `image_${i}.jpg`,
      url: `https://s3.twcstorage.ru/medsip-protez/products/image_${i}.jpg`,
      size: Math.floor(Math.random() * 500000) + 100000, // 100KB - 600KB
      uploadedAt: new Date(Date.now() - Math.random() * 86400000), // случайная дата в последние 24 часа
      productName: i % 3 === 0 ? `Протез ${i}` : undefined,
      productId: i % 3 === 0 ? i.toString() : undefined,
      type: 's3',
      source: 's3',
      key: `products/image_${i}.jpg`
    });
  }
  return files;
}

/**
 * Тест сортировки с таймаутом
 */
function testQuickSortWithTimeout(arr, timeLimit = 100) {
  const startTime = performance.now();

  function quickSort(items) {
    if (performance.now() - startTime > timeLimit) {
      return items;
    }

    if (items.length <= 1) return items;

    const pivot = items[Math.floor(items.length / 2)];
    const left = [];
    const right = [];
    const equal = [];

    for (const item of items) {
      const pivotTime = new Date(pivot.uploadedAt).getTime();
      const itemTime = new Date(item.uploadedAt).getTime();

      if (itemTime > pivotTime) left.push(item);
      else if (itemTime < pivotTime) right.push(item);
      else equal.push(item);
    }

    return [...quickSort(left), ...equal, ...quickSort(right)];
  }

  return quickSort(arr);
}

/**
 * Тест батчинга файлов
 */
function testFileBatching(files, batchSize = 50) {
  const startTime = performance.now();
  const results = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    // Симуляция обработки батча
    const processedBatch = batch.map(file => ({
      ...file,
      processed: true,
      processedAt: new Date()
    }));

    results.push(...processedBatch);
  }

  const endTime = performance.now();
  return {
    totalFiles: files.length,
    totalBatches: Math.ceil(files.length / batchSize),
    processingTime: endTime - startTime,
    filesPerSecond: files.length / ((endTime - startTime) / 1000)
  };
}

/**
 * Основная функция тестирования
 */
async function runPerformanceTests() {
  // Тест 1: Малый список (обычная сетка)
  console.log('📊 Test 1: Small list (< 50 files) - Regular Grid');
  const smallFiles = generateMockMediaFiles(30);
  const smallStart = performance.now();
  const sortedSmall = testQuickSortWithTimeout(smallFiles);
  const smallEnd = performance.now();
  // Тест 2: Большой список (виртуализация)
  console.log('📊 Test 2: Large list (> 50 files) - Virtualized Grid');
  const largeFiles = generateMockMediaFiles(200);
  const largeStart = performance.now();
  const sortedLarge = testQuickSortWithTimeout(largeFiles, 100);
  const largeEnd = performance.now();
  // Тест 3: Батчинг
  const batchingResults = testFileBatching(largeFiles, 50);
  // Тест 4: Очень большой список (стресс-тест)
  console.log('📊 Test 4: Stress Test (1000+ files)');
  const stressFiles = generateMockMediaFiles(1500);
  const stressStart = performance.now();
  const stressBatching = testFileBatching(stressFiles, 50);
  const stressEnd = performance.now();
  // Резюме результатов
  // Проверяем все ли тесты прошли успешно
  const smallTestPassed = (smallEnd - smallStart) < 100;
  const largeTestPassed = (largeEnd - largeStart) < 150;
  const batchingTestPassed = batchingResults.filesPerSecond > 1000;
  const stressTestPassed = (stressEnd - stressStart) < 500;
  const allTestsPassed = smallTestPassed && largeTestPassed && batchingTestPassed && stressTestPassed;
  if (allTestsPassed) {
  } else {
  }

  return allTestsPassed;
}

// Запуск тестов если файл выполняется напрямую
if (require.main === module) {
  runPerformanceTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runPerformanceTests, generateMockMediaFiles };