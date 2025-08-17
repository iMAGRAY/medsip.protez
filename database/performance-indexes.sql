-- ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ ПРОИЗВОДИТЕЛЬНОСТИ
-- Создание критических индексов для повышения производительности под нагрузкой

-- =======================
-- ИНДЕКСЫ ДЛЯ ПРОДУКТОВ
-- =======================

-- Основные индексы для products таблицы
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_id ON products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_manufacturer_id ON products(manufacturer_id) WHERE manufacturer_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_series_id ON products(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_is_deleted ON products(is_deleted) WHERE is_deleted = false OR is_deleted IS NULL;

-- Композитные индексы для частых запросов
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_active ON products(category_id, is_deleted) 
WHERE category_id IS NOT NULL AND (is_deleted = false OR is_deleted IS NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_manufacturer_active ON products(manufacturer_id, is_deleted) 
WHERE manufacturer_id IS NOT NULL AND (is_deleted = false OR is_deleted IS NULL);

-- Индексы для сортировки
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_price ON products(price) WHERE price IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_created_at ON products(created_at);

-- Индекс для полнотекстового поиска
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search ON products USING gin(
  to_tsvector('russian', 
    COALESCE(name, '') || ' ' || 
    COALESCE(short_name, '') || ' ' || 
    COALESCE(description, '') || ' ' ||
    COALESCE(sku, '') || ' ' ||
    COALESCE(article_number, '')
  )
);

-- =======================
-- ИНДЕКСЫ ДЛЯ ВАРИАНТОВ
-- =======================

-- Основные индексы для product_variants
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_master_id ON product_variants(master_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_active ON product_variants(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_deleted ON product_variants(is_deleted) WHERE is_deleted = false OR is_deleted IS NULL;

-- Композитный индекс для активных вариантов
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_master_active ON product_variants(master_id, is_active, is_deleted)
WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);

-- =======================
-- ИНДЕКСЫ ДЛЯ ХАРАКТЕРИСТИК
-- =======================

-- Индексы для простой системы характеристик
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_characteristics_simple_product_id ON product_characteristics_simple(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_characteristics_simple_value_id ON product_characteristics_simple(value_id);

-- Индексы для values и groups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characteristics_values_simple_group_id ON characteristics_values_simple(group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characteristics_values_simple_active ON characteristics_values_simple(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characteristics_groups_simple_active ON characteristics_groups_simple(is_active) WHERE is_active = true;

-- =======================
-- ИНДЕКСЫ ДЛЯ КАТЕГОРИЙ
-- =======================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_categories_parent_id ON product_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_categories_active ON product_categories(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_categories_level ON product_categories(level);

-- =======================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЕЙ
-- =======================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manufacturers_active ON manufacturers(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manufacturers_name ON manufacturers(name);

-- =======================
-- ИНДЕКСЫ ДЛЯ MODEL_SERIES
-- =======================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_series_manufacturer_id ON model_series(manufacturer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_series_active ON model_series(is_active) WHERE is_active = true;

-- =======================
-- АНАЛИЗ ТАБЛИЦ
-- =======================

-- Обновляем статистику для всех таблиц
ANALYZE products;
ANALYZE product_variants;
ANALYZE product_characteristics_simple;
ANALYZE characteristics_values_simple;
ANALYZE characteristics_groups_simple;
ANALYZE product_categories;
ANALYZE manufacturers;
ANALYZE model_series;

-- =======================
-- МОНИТОРИНГ ИНДЕКСОВ
-- =======================

-- Запрос для проверки использования индексов
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_scan DESC;

-- Запрос для поиска неиспользуемых индексов
-- SELECT schemaname, tablename, indexname, idx_scan
-- FROM pg_stat_user_indexes 
-- WHERE idx_scan = 0 AND schemaname = 'public';