# ✍️ Написание тестов - MedSIP Prosthetics System

Руководство по написанию и организации тестов для системы.

## 🏗️ Архитектура тестирования

### Типы тестов

1. **Unit тесты** - отдельные функции и компоненты
2. **API тесты** - тестирование REST эндпоинтов
3. **Database тесты** - тестирование запросов к БД
4. **Integration тесты** - комплексные сценарии

### Структура папки тестов

```
tests/
├── api/           # API тесты
├── database/      # Тесты БД
├── integration/   # Интеграционные тесты
├── utils/         # Вспомогательные утилиты
└── run-all-tests.js
```

## 🛠️ Утилиты для тестирования

### ApiHelper - для API тестов

```javascript
const ApiHelper = require('../utils/api-helper')

const api = new ApiHelper()

// Ожидание запуска сервера
await api.waitForServer()

// GET запрос
const response = await api.get('/api/manufacturers')

// POST запрос
const createResponse = await api.post('/api/manufacturers', {
  name: 'Test Manufacturer',
  country: 'Test Country'
})

// Валидация структуры
api.validateManufacturerStructure(manufacturer)
```

### DatabaseHelper - для тестов БД

```javascript
const DatabaseHelper = require('../utils/db-helper')

const db = new DatabaseHelper()

// Тест подключения
const connected = await db.testConnection()

// Выполнение запроса
const results = await db.query('SELECT * FROM manufacturers')

// Подсчет записей
const count = await db.countRecords('products')

// Создание тестовых данных
const testManufacturer = await db.createTestManufacturer({
  name: 'Test Manufacturer'
})

// Очистка тестовых данных
await db.cleanupTestData()

// Закрытие соединения
await db.close()
```

## 📝 Примеры тестов

### API тест

Создайте файл `tests/api/manufacturers.test.js`:

```javascript
const ApiHelper = require('../utils/api-helper')
const DatabaseHelper = require('../utils/db-helper')

async function testManufacturersAPI() {
  console.log('🧪 Тест API производителей')
  
  const api = new ApiHelper()
  const db = new DatabaseHelper()
  
  try {
    // Проверка сервера
    const serverRunning = await api.waitForServer()
    if (!serverRunning) {
      throw new Error('Server not running')
    }
    
    // 1. Тест получения списка
    console.log('📋 Тест GET /api/manufacturers')
    const getResponse = await api.getManufacturers()
    
    if (!getResponse.ok) {
      throw new Error('Failed to fetch manufacturers')
    }
    
    console.log(`✅ Получено ${getResponse.data.length} производителей`)
    
    // 2. Тест создания
    console.log('➕ Тест POST /api/manufacturers')
    const testData = {
      name: 'Test Manufacturer API',
      country: 'Test Country',
      foundedYear: 2025,
      isActive: true
    }
    
    const createResponse = await api.createManufacturer(testData)
    
    if (!createResponse.ok) {
      throw new Error('Failed to create manufacturer')
    }
    
    const createdManufacturer = createResponse.data
    console.log(`✅ Создан производитель ID: ${createdManufacturer.id}`)
    
    // 3. Валидация структуры
    api.validateManufacturerStructure(createdManufacturer)
    console.log('✅ Структура данных корректна')
    
    // 4. Тест получения по ID
    console.log('🔍 Тест GET /api/manufacturers/{id}')
    const getByIdResponse = await api.getManufacturer(createdManufacturer.id)
    
    if (!getByIdResponse.ok) {
      throw new Error('Failed to fetch manufacturer by ID')
    }
    
    console.log('✅ Получен производитель по ID')
    
    // 5. Тест обновления
    console.log('✏️ Тест PUT /api/manufacturers/{id}')
    const updateData = {
      ...testData,
      name: 'Updated Test Manufacturer'
    }
    
    const updateResponse = await api.updateManufacturer(
      createdManufacturer.id, 
      updateData
    )
    
    if (!updateResponse.ok) {
      throw new Error('Failed to update manufacturer')
    }
    
    console.log('✅ Производитель обновлен')
    
    // 6. Тест удаления
    console.log('🗑️ Тест DELETE /api/manufacturers/{id}')
    const deleteResponse = await api.deleteManufacturer(createdManufacturer.id)
    
    if (!deleteResponse.ok) {
      throw new Error('Failed to delete manufacturer')
    }
    
    console.log('✅ Производитель удален')
    
    console.log('🎉 Все API тесты прошли успешно!')
    
  } catch (error) {
    console.error('❌ API тест завершился с ошибкой:', error.message)
    throw error
  } finally {
    // Очистка
    await db.cleanupTestData()
    await db.close()
  }
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  testManufacturersAPI()
}

module.exports = testManufacturersAPI
```

### Database тест

Создайте файл `tests/database/connection.test.js`:

```javascript
const DatabaseHelper = require('../utils/db-helper')

async function testDatabaseConnection() {
  console.log('🧪 Тест подключения к базе данных')
  
  const db = new DatabaseHelper()
  
  try {
    // 1. Тест подключения
    console.log('🔌 Проверка подключения...')
    const connected = await db.testConnection()
    
    if (!connected) {
      throw new Error('Database connection failed')
    }
    
    console.log('✅ Подключение к БД успешно')
    
    // 2. Тест базовых запросов
    console.log('📊 Проверка базовых запросов...')
    
    const manufacturersCount = await db.countRecords('manufacturers')
    const modelLinesCount = await db.countRecords('model_lines')
    const productsCount = await db.countRecords('products')
    
    console.log(`📊 Производители: ${manufacturersCount}`)
    console.log(`📊 Модельные ряды: ${modelLinesCount}`)
    console.log(`📊 Продукты: ${productsCount}`)
    
    // 3. Тест создания тестовых данных
    console.log('🏭 Тест создания тестовых данных...')
    
    const testManufacturer = await db.createTestManufacturer({
      name: 'Test DB Manufacturer'
    })
    
    console.log(`✅ Создан тестовый производитель ID: ${testManufacturer.id}`)
    
    // 4. Тест проверки данных
    const newCount = await db.countRecords('manufacturers')
    
    if (newCount !== manufacturersCount + 1) {
      throw new Error('Test data creation failed')
    }
    
    console.log('✅ Тестовые данные созданы корректно')
    
    // 5. Статистика таблиц
    console.log('📈 Статистика таблиц...')
    const stats = await db.getTablesStats()
    
    Object.entries(stats).forEach(([table, count]) => {
      console.log(`📊 ${table}: ${count} записей`)
    })
    
    console.log('🎉 Все тесты БД прошли успешно!')
    
  } catch (error) {
    console.error('❌ Тест БД завершился с ошибкой:', error.message)
    throw error
  } finally {
    // Очистка
    await db.cleanupTestData()
    await db.close()
  }
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  testDatabaseConnection()
}

module.exports = testDatabaseConnection
```

### Integration тест

Файл уже создан: `tests/integration/hierarchy.test.js`

## 📋 Правила написания тестов

### 1. Именование

- **Файлы**: `feature.test.js`
- **Функции**: `testFeatureName()`
- **Переменные**: описательные имена

### 2. Структура теста

```javascript
async function testFeature() {
  console.log('🧪 Название теста')
  
  // Инициализация
  const api = new ApiHelper()
  const db = new DatabaseHelper()
  
  try {
    // Arrange - подготовка данных
    const testData = { ... }
    
    // Act - выполнение действия
    const result = await api.someAction(testData)
    
    // Assert - проверка результата
    if (!result.ok) {
      throw new Error('Test failed')
    }
    
    console.log('✅ Тест прошел успешно')
    
  } catch (error) {
    console.error('❌ Тест завершился с ошибкой:', error.message)
    throw error
  } finally {
    // Cleanup - очистка
    await db.cleanupTestData()
    await db.close()
  }
}
```

### 3. Логирование

```javascript
// Начало теста
console.log('🧪 Тест API производителей')

// Этапы
console.log('📋 Этап 1: Получение данных')
console.log('➕ Этап 2: Создание записи')
console.log('✏️ Этап 3: Обновление записи')

// Результаты
console.log('✅ Успешно')
console.log('❌ Ошибка')
console.log('⚠️ Предупреждение')
```

### 4. Обработка ошибок

```javascript
try {
  // Тестовая логика
} catch (error) {
  console.error('❌ Ошибка:', error.message)
  
  // Детали для отладки
  if (error.response) {
    console.error('Response:', error.response.data)
  }
  
  throw error // Пробросить ошибку дальше
} finally {
  // Обязательная очистка
  await cleanup()
}
```

### 5. Async/Await

```javascript
// ✅ Правильно
const result = await api.getManufacturers()

// ❌ Неправильно
api.getManufacturers().then(result => {
  // callback hell
})
```

## 🔄 Запуск тестов

### Отдельный тест

```bash
# Прямой запуск
node tests/api/manufacturers.test.js

# Через npm
npm run test:hierarchy
```

### Все тесты

```bash
# Все тесты через runner
npm test

# Или напрямую
node tests/run-all-tests.js
```

### В режиме разработки

```bash
# Запуск сервера в фоне
npm run dev &

# Ожидание и запуск тестов
sleep 5 && npm test
```

## 🧹 Очистка после тестов

### Автоматическая очистка

```javascript
// В конце каждого теста
finally {
  await db.cleanupTestData() // Удаление тестовых записей
  await db.close()           // Закрытие соединения
}
```

### Ручная очистка

```sql
-- Удаление всех тестовых данных
DELETE FROM products WHERE name LIKE 'Test%';
DELETE FROM model_lines WHERE name LIKE 'Test%';
DELETE FROM manufacturers WHERE name LIKE 'Test%';
```

## 📊 Лучшие практики

1. **Изоляция тестов** - каждый тест независим
2. **Предсказуемые данные** - используйте фиксированные тестовые данные
3. **Очистка ресурсов** - всегда закрывайте соединения
4. **Информативные сообщения** - четкие логи и ошибки
5. **Быстрые тесты** - минимизируйте время выполнения

## 🎯 Что тестировать

### API эндпоинты
- ✅ CRUD операции
- ✅ Валидация входных данных
- ✅ Коды ответов HTTP
- ✅ Структуру JSON ответов

### База данных
- ✅ Подключение к БД
- ✅ CRUD операции
- ✅ Связи между таблицами
- ✅ Целостность данных

### Интеграция
- ✅ Полные сценарии использования
- ✅ Взаимодействие компонентов
- ✅ Иерархические связи
- ✅ Производительность

## 🔗 Полезные ссылки

- [Обзор тестов](./overview.md)
- [Запуск тестов](./running-tests.md)
- [API документация](../api/overview.md) 