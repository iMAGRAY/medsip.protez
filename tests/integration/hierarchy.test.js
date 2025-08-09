const ApiHelper = require('../utils/api-helper')
const DatabaseHelper = require('../utils/db-helper')

async function testHierarchy() {
  const api = new ApiHelper()
  const db = new DatabaseHelper()

  try {
    // 1. Проверяем подключение к серверу и БД
    const serverRunning = await api.isServerRunning()
    const dbConnected = await db.testConnection()

    if (!serverRunning) {
      return
    }

    if (!dbConnected) {
      return
    }
    // 2. Получаем производителей
    const manufacturersResponse = await api.getManufacturers()

    if (!manufacturersResponse.ok) {
      throw new Error('Failed to fetch manufacturers')
    }

    const manufacturers = manufacturersResponse.data
    // 3. Получаем модельные ряды
    const modelLinesResponse = await api.getModelLines()

    if (!modelLinesResponse.ok) {
      throw new Error('Failed to fetch model lines')
    }

    const modelLines = modelLinesResponse.data
    // 4. Валидация структуры данных
    if (manufacturers.length > 0) {
      api.validateManufacturerStructure(manufacturers[0])
    }

    if (modelLines.length > 0) {
      api.validateModelLineStructure(modelLines[0])
    }

    // 5. Тестируем иерархию
    const hierarchyMap = new Map()

    manufacturers.forEach(manufacturer => {
      const manufacturerModelLines = modelLines.filter(ml =>
        ml.manufacturerId === manufacturer.id
      )

      hierarchyMap.set(manufacturer.id, {
        manufacturer,
        modelLines: manufacturerModelLines,
        count: manufacturerModelLines.length
      })
    })

    // 6. Отчет по иерархии
    let totalModelLines = 0

    hierarchyMap.forEach((data, manufacturerId) => {
      const { manufacturer, modelLines, count } = data
      if (count > 0) {
        modelLines.forEach(ml => {
        })
      }

      totalModelLines += count
    })

    // 7. Проверка консистентности
    if (totalModelLines === modelLines.length) {
    } else {
    }

    // 8. Статистика из БД
    const stats = await db.getTablesStats()
    Object.entries(stats).forEach(([table, count]) => {
    })
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message)
  } finally {
    await db.close()
  }
}

// Запуск теста если файл вызван напрямую
if (require.main === module) {
  testHierarchy()
}

module.exports = testHierarchy