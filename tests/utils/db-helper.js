const { Pool } = require('pg')
const config = require('./test-config')

class DatabaseHelper {
  constructor() {
    this.pool = new Pool({
      connectionString: config.database.connectionString,
      ssl: false
    })
  }

  // Тест подключения
  async testConnection() {
    try {
      await this.pool.query('SELECT 1')
      return true
    } catch (error) {
      console.error('Database connection failed:', error.message)
      return false
    }
  }

  // Выполнение запроса
  async query(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params)
      return result.rows
    } catch (error) {
      console.error('Query failed:', error.message)
      throw error
    }
  }

  // Подсчет записей в таблице
  async countRecords(tableName, whereClause = '') {
    const sql = `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`
    const result = await this.query(sql)
    return parseInt(result[0].count)
  }

  // Создание тестовых данных
  async createTestManufacturer(data = {}) {
    const manufacturerData = { ...config.testData.manufacturer, ...data }
    const sql = `
      INSERT INTO manufacturers (name, country, founded_year, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `
    const result = await this.query(sql, [
      manufacturerData.name,
      manufacturerData.country,
      manufacturerData.foundedYear,
      manufacturerData.isActive
    ])
    return result[0]
  }

  // Удаление тестовых данных
  async cleanupTestData() {
    try {
      // Удаляем тестовые данные в правильном порядке (от зависимых к независимым)
      await this.query("DELETE FROM products WHERE name LIKE 'Test%'")
      await this.query("DELETE FROM model_lines WHERE name LIKE 'Test%'")
      await this.query("DELETE FROM manufacturers WHERE name LIKE 'Test%'")
      await this.query("DELETE FROM categories WHERE name LIKE 'Test%'")
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message)
    }
  }

  // Получение статистики таблиц
  async getTablesStats() {
    const tables = ['manufacturers', 'model_lines', 'products', 'categories']
    const stats = {}

    for (const table of tables) {
      stats[table] = await this.countRecords(table)
    }

    return stats
  }

  // Закрытие подключения
  async close() {
    await this.pool.end()
  }
}

module.exports = DatabaseHelper