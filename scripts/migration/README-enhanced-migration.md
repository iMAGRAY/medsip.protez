# Enhanced Migration: product_sizes → product_variants

Комплексная система миграции для унификации схемы базы данных medsip.protez с расширенным функционалом безопасности, валидации и отката.

## 🎯 Цель

Перенести данные из таблицы `product_sizes` в унифицированную таблицу `product_variants` с сохранением всех данных, добавлением новых полей и обеспечением целостности данных.

## 📋 Компоненты

### 1. `enhanced-sizes-to-variants-migration.js`
Основной migration script с расширенным функционалом:

**Возможности:**
- ✅ Pre-migration validation
- ✅ Post-migration verification
- ✅ Comprehensive error handling
- ✅ Rollback procedures
- ✅ Performance tracking
- ✅ Backup strategy
- ✅ Progress reporting
- ✅ Schema enhancement
- ✅ Data integrity checks

**Схема Enhancement:**
```sql
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS size_name VARCHAR(100);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS size_value VARCHAR(100);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS dimensions JSONB;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS specifications JSONB;
```

### 2. `migration-validator.js`
Utility для валидации состояния базы данных:

**Проверки:**
- Структура таблиц и колонок
- Качество данных (пустые поля, дубликаты)
- Foreign key constraints
- Индексы производительности
- Потенциальные конфликты

### 3. `run-enhanced-migration.js`
CLI интерфейс для удобного запуска:

**Режимы:**
- Interactive mode (по умолчанию)
- Validation only
- Migration only
- Full (validation + migration)

## 🚀 Использование

### Быстрый старт

```bash
# Интерактивный режим (рекомендуется для первого запуска)
node scripts/migration/run-enhanced-migration.js

# Или
cd scripts/migration && node run-enhanced-migration.js
```

### Команды CLI

```bash
# Только валидация
node run-enhanced-migration.js validate

# Только миграция (без валидации)
node run-enhanced-migration.js migrate

# Полный процесс: валидация + миграция
node run-enhanced-migration.js full

# Интерактивный режим с пошаговыми подтверждениями
node run-enhanced-migration.js interactive
```

### Параметры

```bash
# Автоматическое подтверждение после валидации
node run-enhanced-migration.js full --auto-confirm

# Пропустить подтверждения в режиме миграции
node run-enhanced-migration.js migrate --force
```

## 🔧 Настройка

### Environment Variables

Создайте `.env.local` или `database.env` с настройками:

```env
# Полная строка подключения (приоритет)
DATABASE_URL=postgresql://user:password@host:port/database

# Или отдельные параметры
POSTGRESQL_HOST=localhost
POSTGRESQL_PORT=5432
POSTGRESQL_USER=postgres
POSTGRESQL_PASSWORD=your_password
POSTGRESQL_DBNAME=medsip_protez
```

### Требования

- Node.js >= 14
- PostgreSQL >= 12
- Пакеты: `pg`, `dotenv`, `commander` (если используете CLI)

```bash
npm install pg dotenv commander
```

## 📊 Процесс миграции

### 1. Pre-Migration Validation
- ✅ Проверка существования таблиц
- ✅ Валидация foreign key constraints
- ✅ Анализ качества данных
- ✅ Поиск потенциальных конфликтов
- ✅ Проверка индексов

### 2. Backup Creation
- 💾 Полный backup `product_sizes`
- 💾 Backup существующих `product_variants`
- 💾 Схема версионирования
- 💾 Metadata для rollback

### 3. Schema Enhancement
- 🔧 Добавление новых колонок
- 🔧 Создание индексов для производительности
- 🔧 Сохранение изменений для rollback

### 4. Data Migration
- 🚀 Batch processing (по 100 записей)
- 🚀 Unique slug generation
- 🚀 Characteristics migration
- 🚀 Progress reporting
- 🚀 Error handling и recovery

### 5. Post-Migration Verification
- 🔍 Проверка количества записей
- 🔍 Валидация data integrity
- 🔍 Проверка foreign keys
- 🔍 Поиск orphaned records

### 6. Report Generation
- 📄 Детальный отчет в JSON
- 📄 Performance metrics
- 📄 Рекомендации по дальнейшим действиям
- 📄 Полный лог процесса

## 📁 Структура файлов

После выполнения миграции будут созданы:

```
database/migration-backups/
├── migration_[timestamp]_[hash]_backup.json     # Backup данных
├── migration_[timestamp]_[hash]_report.json    # Отчет миграции  
├── migration_[timestamp]_[hash].log            # Детальный лог
└── validation-report-[timestamp].json          # Отчет валидации
```

## 🔄 Rollback Process

### Автоматический Rollback
При ошибке миграции выполняется автоматический rollback:
- Удаление созданных записей в `product_variants`
- Сохранение schema changes (для безопасности)

### Ручной Rollback
```javascript
// Использование backup для восстановления
const backupData = require('./database/migration-backups/migration_xxx_backup.json');
// Восстановление через SQL или через код
```

## 📈 Performance

### Оптимизации
- Batch processing для больших наборов данных
- Connection pooling
- Индексы для быстрого поиска
- Progress tracking

### Ожидаемое время выполнения
- До 1,000 записей: ~30 секунд
- До 10,000 записей: ~2-3 минуты  
- До 50,000 записей: ~10-15 минут

## ⚠️ Важные замечания

### Перед миграцией
1. **Создайте backup всей базы данных**
2. **Остановите production приложение**
3. **Проверьте свободное место на диске**
4. **Убедитесь в наличии прав на DDL операции**

### После миграции
1. **Протестируйте приложение**
2. **Обновите API endpoints**
3. **Обновите frontend код**
4. **Мониторьте производительность**
5. **После полного тестирования - удалите `product_sizes`**

### В случае проблем
1. **Проверьте log файлы**
2. **Используйте validation отчет**
3. **Выполните rollback при необходимости**
4. **Обратитесь к детальному отчету миграции**

## 🧪 Тестирование

### Pre-Production Testing
```bash
# 1. Валидация на staging
node run-enhanced-migration.js validate

# 2. Миграция на копии продакшена
node run-enhanced-migration.js migrate

# 3. Проверка приложения
# 4. Rollback testing
```

### Проверочные запросы
```sql
-- Сравнение количества записей
SELECT 
  (SELECT COUNT(*) FROM product_sizes) as sizes_count,
  (SELECT COUNT(*) FROM product_variants WHERE size_name IS NOT NULL) as migrated_count;

-- Проверка данных
SELECT * FROM product_variants WHERE size_name IS NOT NULL LIMIT 10;

-- Проверка уникальности SKU
SELECT sku, COUNT(*) FROM product_variants 
WHERE sku IS NOT NULL GROUP BY sku HAVING COUNT(*) > 1;
```

## 🔧 Troubleshooting

### Частые проблемы

1. **Connection Timeout**
   ```
   Решение: Увеличить connectionTimeoutMillis в конфигурации
   ```

2. **Memory Issues**
   ```
   Решение: Уменьшить batchSize в коде миграции
   ```

3. **Duplicate SKU Errors**
   ```
   Решение: Просмотреть validation отчет и очистить дубликаты
   ```

4. **Foreign Key Violations**
   ```
   Решение: Проверить orphaned records в validation отчете
   ```

### Логи и отладка

```bash
# Просмотр последнего лога
tail -f database/migration-backups/migration_*.log

# Анализ ошибок
grep "ERROR" database/migration-backups/migration_*.log

# Проверка performance
grep "Performance" database/migration-backups/migration_*.log
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте validation отчет
2. Изучите log файлы
3. Используйте backup для восстановления
4. Обратитесь к данному README

---

**Важно:** Данный migration script предназначен для однократного использования. После успешной миграции и тестирования рекомендуется удалить таблицу `product_sizes` и обновить код приложения для работы только с `product_variants`.