const fetch = require('node-fetch')
const config = require('./test-config')

class ApiHelper {
  constructor() {
    this.baseUrl = config.api.baseUrl
    this.endpoints = config.api.endpoints
  }

  // Базовый HTTP запрос
  async request(method, url, body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(`${this.baseUrl}${url}`, options)

      // Проверяем Content-Type для определения формата ответа
      const contentType = response.headers.get('content-type') || ''
      let data

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        // Для HTML страниц просто возвращаем текст
        data = await response.text()
      }

      return {
        status: response.status,
        ok: response.ok,
        data
      }
    } catch (error) {
      console.error(`API request failed: ${method} ${url}`, error.message)
      throw error
    }
  }

  // GET запрос
  async get(url) {
    return this.request('GET', url)
  }

  // POST запрос
  async post(url, data) {
    return this.request('POST', url, data)
  }

  // PUT запрос
  async put(url, data) {
    return this.request('PUT', url, data)
  }

  // DELETE запрос
  async delete(url) {
    return this.request('DELETE', url)
  }

  // Тесты для производителей
  async getManufacturers() {
    return this.get(this.endpoints.manufacturers)
  }

  async createManufacturer(data) {
    return this.post(this.endpoints.manufacturers, data)
  }

  async getManufacturer(id) {
    return this.get(`${this.endpoints.manufacturers}/${id}`)
  }

  async updateManufacturer(id, data) {
    return this.put(`${this.endpoints.manufacturers}/${id}`, data)
  }

  async deleteManufacturer(id) {
    return this.delete(`${this.endpoints.manufacturers}/${id}`)
  }

  // Тесты для модельных рядов
  async getModelLines() {
    return this.get(this.endpoints.modelLines)
  }

  async createModelLine(data) {
    return this.post(this.endpoints.modelLines, data)
  }

  // Тесты для продуктов
  async getProducts() {
    return this.get(this.endpoints.products)
  }

  async createProduct(data) {
    return this.post(this.endpoints.products, data)
  }

  // Проверка доступности сервера
  async isServerRunning() {
    try {
      const response = await this.get('/api/db-status')
      return response.ok
    } catch (error) {
      return false
    }
  }

  // Ожидание запуска сервера
  async waitForServer(maxAttempts = 3, delay = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isServerRunning()) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    return false
  }

  // Валидация структуры ответа
  validateManufacturerStructure(manufacturer) {
    const required = ['id', 'name', 'isActive']
    const missing = required.filter(field => !(field in manufacturer))

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }

    return true
  }

  validateModelLineStructure(modelLine) {
    const required = ['id', 'name', 'manufacturerId', 'manufacturerName']
    const missing = required.filter(field => !(field in modelLine))

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }

    return true
  }
}

module.exports = ApiHelper