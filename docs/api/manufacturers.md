# 🏭 API Производителей - MedSIP Prosthetics System

Детальная документация по API управления производителями протезов и ортезов.

## 📋 Базовая информация

- **Базовый URL**: `/api/manufacturers`
- **Формат данных**: JSON
- **Кодировка**: UTF-8

## 📊 Модель данных

### Структура объекта Manufacturer

```typescript
interface Manufacturer {
  id: number                    // Уникальный идентификатор
  name: string                  // Название производителя (обязательное)
  description?: string          // Описание производителя
  logoUrl?: string             // URL логотипа
  websiteUrl?: string          // URL веб-сайта
  country?: string             // Страна производителя
  foundedYear?: number         // Год основания
  isActive: boolean            // Статус активности (по умолчанию true)
  sortOrder: number            // Порядок сортировки (по умолчанию 0)
  modelLineCount?: number      // Количество модельных рядов
  createdAt: string            // Дата создания (ISO 8601)
  updatedAt: string            // Дата обновления (ISO 8601)
}
```

## 🔗 Эндпоинты

### GET /api/manufacturers

Получить список всех производителей.

**Запрос:**
```http
GET /api/manufacturers
```

**Ответ:**
```json
[
  {
    "id": 1,
    "name": "МедСИП",
    "description": "Российский производитель современных протезов",
    "logoUrl": "https://example.com/logo.png",
    "websiteUrl": "https://medsip.ru",
    "country": "Россия",
    "foundedYear": 2015,
    "isActive": true,
    "sortOrder": 1,
    "modelLineCount": 6,
    "createdAt": "2025-06-16T10:00:00.000Z",
    "updatedAt": "2025-06-16T10:00:00.000Z"
  }
]
```

**Коды ответов:**
- `200 OK` - Успешно
- `500 Internal Server Error` - Ошибка сервера

### POST /api/manufacturers

Создать нового производителя.

**Запрос:**
```http
POST /api/manufacturers
Content-Type: application/json

{
  "name": "Новый производитель",
  "description": "Описание производителя",
  "country": "Германия",
  "foundedYear": 1995,
  "websiteUrl": "https://example.com",
  "isActive": true
}
```

**Ответ:**
```json
{
  "id": 5,
  "name": "Новый производитель",
  "description": "Описание производителя",
  "country": "Германия",
  "foundedYear": 1995,
  "websiteUrl": "https://example.com",
  "isActive": true,
  "sortOrder": 0,
  "createdAt": "2025-06-16T14:30:00.000Z",
  "updatedAt": "2025-06-16T14:30:00.000Z"
}
```

**Коды ответов:**
- `201 Created` - Производитель создан
- `400 Bad Request` - Ошибка валидации
- `500 Internal Server Error` - Ошибка сервера

**Валидация:**
- `name` - обязательное поле, уникальное
- `foundedYear` - должен быть числом
- `isActive` - должен быть boolean

### GET /api/manufacturers/{id}

Получить производителя по ID.

**Запрос:**
```http
GET /api/manufacturers/1
```

**Ответ:**
```json
{
  "id": 1,
  "name": "МедСИП",
  "description": "Российский производитель современных протезов",
  "country": "Россия",
  "foundedYear": 2015,
  "isActive": true,
  "modelLineCount": 6,
  "createdAt": "2025-06-16T10:00:00.000Z",
  "updatedAt": "2025-06-16T10:00:00.000Z"
}
```

**Коды ответов:**
- `200 OK` - Производитель найден
- `404 Not Found` - Производитель не найден
- `500 Internal Server Error` - Ошибка сервера

### PUT /api/manufacturers/{id}

Обновить производителя.

**Запрос:**
```http
PUT /api/manufacturers/1
Content-Type: application/json

{
  "name": "МедСИП Обновленный",
  "description": "Обновленное описание",
  "foundedYear": 2015,
  "isActive": true
}
```

**Ответ:**
```json
{
  "id": 1,
  "name": "МедСИП Обновленный",
  "description": "Обновленное описание",
  "foundedYear": 2015,
  "isActive": true,
  "updatedAt": "2025-06-16T14:45:00.000Z"
}
```

**Коды ответов:**
- `200 OK` - Производитель обновлен
- `404 Not Found` - Производитель не найден
- `400 Bad Request` - Ошибка валидации
- `500 Internal Server Error` - Ошибка сервера

### DELETE /api/manufacturers/{id}

Удалить производителя.

**Запрос:**
```http
DELETE /api/manufacturers/1
```

**Ответ:**
```json
{
  "message": "Manufacturer deleted successfully"
}
```

**Коды ответов:**
- `200 OK` - Производитель удален
- `404 Not Found` - Производитель не найден
- `409 Conflict` - Невозможно удалить (есть связанные модельные ряды)
- `500 Internal Server Error` - Ошибка сервера

## 📝 Примеры использования

### JavaScript/Fetch

```javascript
// Получить всех производителей
const manufacturers = await fetch('/api/manufacturers')
  .then(response => response.json())

// Создать производителя
const newManufacturer = await fetch('/api/manufacturers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Новый производитель',
    country: 'Германия',
    foundedYear: 1995
  })
}).then(response => response.json())

// Обновить производителя
const updatedManufacturer = await fetch('/api/manufacturers/1', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Обновленное название',
    isActive: false
  })
}).then(response => response.json())

// Удалить производителя
await fetch('/api/manufacturers/1', {
  method: 'DELETE'
})
```

### curl

```bash
# Получить всех производителей
curl -X GET http://localhost:3000/api/manufacturers

# Создать производителя
curl -X POST http://localhost:3000/api/manufacturers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Новый производитель",
    "country": "Германия",
    "foundedYear": 1995
  }'

# Получить производителя по ID
curl -X GET http://localhost:3000/api/manufacturers/1

# Обновить производителя
curl -X PUT http://localhost:3000/api/manufacturers/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Обновленное название",
    "isActive": false
  }'

# Удалить производителя
curl -X DELETE http://localhost:3000/api/manufacturers/1
```

## ❗ Обработка ошибок

### Ошибки валидации (400 Bad Request)

```json
{
  "error": "Validation failed",
  "details": "Name is required"
}
```

### Производитель не найден (404 Not Found)

```json
{
  "error": "Manufacturer not found",
  "details": "Manufacturer with id 999 does not exist"
}
```

### Конфликт при удалении (409 Conflict)

```json
{
  "error": "Cannot delete manufacturer",
  "details": "Manufacturer has associated model lines"
}
```

### Ошибка сервера (500 Internal Server Error)

```json
{
  "error": "Internal server error",
  "details": "Database connection failed"
}
```

## 🔍 Фильтрация и сортировка

### Получение только активных производителей

```sql
-- Внутренний запрос (для справки)
SELECT * FROM manufacturers 
WHERE is_active = true 
ORDER BY sort_order ASC, name ASC
```

### Получение с количеством модельных рядов

```sql
-- Внутренний запрос (для справки)
SELECT 
  m.*,
  COUNT(ml.id) as model_line_count
FROM manufacturers m
LEFT JOIN model_lines ml ON m.id = ml.manufacturer_id
GROUP BY m.id
ORDER BY m.name
```

## 🔗 Связанные эндпоинты

- **Модельные ряды**: `/api/model-lines` - получить модельные ряды производителя
- **Продукты**: `/api/products` - получить продукты производителя через модельные ряды

### Получение модельных рядов производителя

```javascript
// Получить производителя
const manufacturer = await fetch('/api/manufacturers/1')
  .then(r => r.json())

// Получить его модельные ряды
const modelLines = await fetch('/api/model-lines')
  .then(r => r.json())
  .then(lines => lines.filter(line => line.manufacturerId === manufacturer.id))
```

## 🧪 Тестирование

### Пример теста

```javascript
// Тест создания производителя
const testData = {
  name: 'Test Manufacturer',
  country: 'Test Country',
  foundedYear: 2025
}

const response = await fetch('/api/manufacturers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
})

const manufacturer = await response.json()

// Проверки
assert(response.status === 201)
assert(manufacturer.name === testData.name)
assert(manufacturer.id > 0)
```

## 🔗 См. также

- [API Обзор](./overview.md)
- [Модельные ряды API](./model-lines.md)
- [Продукты API](./products.md)
- [Схема базы данных](../database/schema.md) 