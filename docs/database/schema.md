# 🗄️ Схема базы данных - MedSIP Prosthetics System

## 🏗️ Архитектура базы данных

База данных построена на PostgreSQL с иерархической структурой:

```
manufacturers (производители)
    ↓ manufacturer_id
model_lines (модельные ряды)
    ↓ model_line_id
products (продукты)
```

## 📊 Таблицы

### 🏭 manufacturers (Производители)

Основная таблица производителей протезов и ортезов.

| Поле | Тип | Описание | Ограничения |
|------|-----|----------|-------------|
| `id` | SERIAL | Уникальный идентификатор | PRIMARY KEY |
| `name` | VARCHAR(255) | Название производителя | NOT NULL, UNIQUE |
| `description` | TEXT | Описание производителя | |
| `logo_url` | VARCHAR(500) | URL логотипа | |
| `website_url` | VARCHAR(500) | URL сайта | |
| `country` | VARCHAR(100) | Страна производителя | |
| `founded_year` | INTEGER | Год основания | |
| `is_active` | BOOLEAN | Активность | DEFAULT true |
| `sort_order` | INTEGER | Порядок сортировки | DEFAULT 0 |
| `created_at` | TIMESTAMP | Дата создания | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Дата обновления | DEFAULT NOW() |

**Индексы:**
- `idx_manufacturers_name` на поле `name`
- `idx_manufacturers_active` на поле `is_active`

### 📋 model_lines (Модельные ряды)

Таблица модельных рядов, связанных с производителями.

| Поле | Тип | Описание | Ограничения |
|------|-----|----------|-------------|
| `id` | SERIAL | Уникальный идентификатор | PRIMARY KEY |
| `name` | VARCHAR(255) | Название модельного ряда | NOT NULL |
| `description` | TEXT | Описание | |
| `manufacturer_id` | INTEGER | ID производителя | FOREIGN KEY → manufacturers.id |
| `category_id` | INTEGER | ID категории | FOREIGN KEY → categories.id |
| `image_url` | VARCHAR(500) | URL изображения | |
| `is_active` | BOOLEAN | Активность | DEFAULT true |
| `sort_order` | INTEGER | Порядок сортировки | DEFAULT 0 |
| `created_at` | TIMESTAMP | Дата создания | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Дата обновления | DEFAULT NOW() |

**Индексы:**
- `idx_model_lines_manufacturer` на поле `manufacturer_id`
- `idx_model_lines_category` на поле `category_id`
- `idx_model_lines_active` на поле `is_active`

### 🛍️ products (Продукты)

Таблица продуктов, принадлежащих модельным рядам.

| Поле | Тип | Описание | Ограничения |
|------|-----|----------|-------------|
| `id` | SERIAL | Уникальный идентификатор | PRIMARY KEY |
| `name` | VARCHAR(255) | Название продукта | NOT NULL |
| `description` | TEXT | Описание продукта | |
| `model_line_id` | INTEGER | ID модельного ряда | FOREIGN KEY → model_lines.id |
| `category_id` | INTEGER | ID категории | FOREIGN KEY → categories.id |
| `sku` | VARCHAR(100) | Артикул | UNIQUE |
| `price` | DECIMAL(10,2) | Цена | |
| `image_url` | VARCHAR(500) | URL главного изображения | |
| `images` | JSONB | Массив URL изображений | |
| `specifications` | JSONB | Технические характеристики | |
| `materials` | INTEGER[] | Массив ID материалов | |
| `features` | INTEGER[] | Массив ID особенностей | |
| `weight` | DECIMAL(6,3) | Вес в кг | |
| `dimensions` | JSONB | Размеры | |
| `is_active` | BOOLEAN | Активность | DEFAULT true |
| `sort_order` | INTEGER | Порядок сортировки | DEFAULT 0 |
| `created_at` | TIMESTAMP | Дата создания | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Дата обновления | DEFAULT NOW() |

**Индексы:**
- `idx_products_model_line` на поле `model_line_id`
- `idx_products_category` на поле `category_id`
- `idx_products_sku` на поле `sku`
- `idx_products_active` на поле `is_active`

### 📂 categories (Категории)

Справочник категорий продукции.

| Поле | Тип | Описание | Ограничения |
|------|-----|----------|-------------|
| `id` | SERIAL | Уникальный идентификатор | PRIMARY KEY |
| `name` | VARCHAR(255) | Название категории | NOT NULL, UNIQUE |
| `description` | TEXT | Описание категории | |
| `parent_id` | INTEGER | ID родительской категории | FOREIGN KEY → categories.id |
| `image_url` | VARCHAR(500) | URL изображения | |
| `is_active` | BOOLEAN | Активность | DEFAULT true |
| `sort_order` | INTEGER | Порядок сортировки | DEFAULT 0 |
| `created_at` | TIMESTAMP | Дата создания | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Дата обновления | DEFAULT NOW() |

### 🧱 materials (Материалы)

Справочник материалов.

| Поле | Тип | Описание | Ограничения |
|------|-----|----------|-------------|
| `id` | SERIAL | Уникальный идентификатор | PRIMARY KEY |
| `name` | VARCHAR(255) | Название материала | NOT NULL, UNIQUE |
| `description` | TEXT | Описание материала | |
| `properties` | JSONB | Свойства материала | |
| `is_active` | BOOLEAN | Активность | DEFAULT true |
| `created_at` | TIMESTAMP | Дата создания | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Дата обновления | DEFAULT NOW() |

### ⚡ features (Особенности)

Справочник особенностей продукции.

| Поле | Тип | Описание | Ограничения |
|------|-----|----------|-------------|
| `id` | SERIAL | Уникальный идентификатор | PRIMARY KEY |
| `name` | VARCHAR(255) | Название особенности | NOT NULL, UNIQUE |
| `description` | TEXT | Описание особенности | |
| `category` | VARCHAR(100) | Категория особенности | |
| `is_active` | BOOLEAN | Активность | DEFAULT true |
| `created_at` | TIMESTAMP | Дата создания | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Дата обновления | DEFAULT NOW() |

## 🔗 Связи между таблицами

### Основные связи (Foreign Keys)

```sql
-- Модельные ряды → Производители
ALTER TABLE model_lines 
ADD CONSTRAINT fk_model_lines_manufacturer 
FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id);

-- Продукты → Модельные ряды
ALTER TABLE products 
ADD CONSTRAINT fk_products_model_line 
FOREIGN KEY (model_line_id) REFERENCES model_lines(id);

-- Продукты → Категории
ALTER TABLE products 
ADD CONSTRAINT fk_products_category 
FOREIGN KEY (category_id) REFERENCES categories(id);

-- Модельные ряды → Категории
ALTER TABLE model_lines 
ADD CONSTRAINT fk_model_lines_category 
FOREIGN KEY (category_id) REFERENCES categories(id);
```

### Массивные связи

Продукты связаны с материалами и особенностями через массивы ID:

```sql
-- Материалы продукта
materials INTEGER[] -- [1, 3, 5]

-- Особенности продукта  
features INTEGER[] -- [2, 4, 7]
```

## 📈 Статистика и представления

### Представление иерархии

```sql
CREATE VIEW product_hierarchy AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  ml.id as model_line_id,
  ml.name as model_line_name,
  m.id as manufacturer_id,
  m.name as manufacturer_name,
  c.name as category_name
FROM products p
LEFT JOIN model_lines ml ON p.model_line_id = ml.id
LEFT JOIN manufacturers m ON ml.manufacturer_id = m.id
LEFT JOIN categories c ON p.category_id = c.id;
```

## 🛠️ Миграции

Файлы схемы находятся в папке `database/`:
- `schema-complete.sql` - Полная схема базы данных
- `schema-manufacturers.sql` - Схема для производителей

## 🔍 Полезные запросы

### Статистика по производителям
```sql
SELECT 
  m.name,
  COUNT(ml.id) as model_lines_count,
  COUNT(p.id) as products_count
FROM manufacturers m
LEFT JOIN model_lines ml ON m.id = ml.manufacturer_id
LEFT JOIN products p ON ml.id = p.model_line_id
GROUP BY m.id, m.name
ORDER BY products_count DESC;
```

### Иерархия продуктов
```sql
SELECT 
  m.name as manufacturer,
  ml.name as model_line,
  p.name as product,
  p.price
FROM manufacturers m
JOIN model_lines ml ON m.id = ml.manufacturer_id
JOIN products p ON ml.id = p.model_line_id
WHERE m.is_active = true 
  AND ml.is_active = true 
  AND p.is_active = true
ORDER BY m.name, ml.name, p.name;
``` 