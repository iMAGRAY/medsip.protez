-- Performance Indexes Migration
-- Устраняет N+1 проблемы через добавление критических индексов
-- Created: 2025-08-16
-- Priority: КРИТИЧЕСКИЙ (блокер production)

-- Проверяем существование индексов перед созданием

-- 1. Индекс для product_sizes.product_id (критический для JOIN в products API)
-- Устраняет table scan при JOIN product_sizes ON ps.product_id = p.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_sizes_product_id 
ON product_sizes(product_id);

-- 2. Индекс для products.manufacturer_id (ускоряет JOIN с manufacturers)  
-- Улучшает производительность LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_manufacturer_id 
ON products(manufacturer_id);

-- 3. Индекс для products.series_id (ускоряет JOIN с model_series)
-- Улучшает производительность LEFT JOIN model_series ms ON p.series_id = ms.id  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_series_id 
ON products(series_id);

-- 4. Индекс для products.category_id (критический для фильтрации)
-- Ускоряет WHERE p.category_id IN (...) фильтры по категориям
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_id 
ON products(category_id);

-- 5. Составной индекс для product_characteristics_simple (если существует)
-- Ускоряет JOIN в системе характеристик
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_characteristics_simple') THEN
        -- Составной индекс для эффективного JOIN
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_characteristics_simple_product_value 
                 ON product_characteristics_simple(product_id, value_id)';
    END IF;
END $$;

-- 6. Индекс для product_variants.master_id (для variants_count query)
-- Ускоряет subquery COUNT(*) FROM product_variants WHERE master_id = p.id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variants') THEN
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_master_id 
                 ON product_variants(master_id) WHERE is_active = true AND is_deleted = false';
    END IF;
END $$;

-- 7. Составной индекс для products с основными фильтрами
-- Покрывает наиболее частые WHERE условия: is_deleted, category_id, created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_deleted_category_created 
ON products(is_deleted, category_id, created_at DESC) 
WHERE (is_deleted = false OR is_deleted IS NULL);

-- Анализируем таблицы после создания индексов для обновления статистики
ANALYZE products;
ANALYZE product_sizes;

-- Проверяем что индексы созданы
DO $$
DECLARE
    index_count INT;
BEGIN
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE tablename IN ('products', 'product_sizes', 'product_characteristics_simple', 'product_variants')
    AND indexname LIKE 'idx_%';
    
    RAISE NOTICE 'Создано % performance индексов', index_count;
END $$;

-- ВАЖНО: Эти индексы критичны для production производительности
-- Без них N+1 queries вызывают деградацию при нагрузке
-- Применять ТОЛЬКО в maintenance window или через CONCURRENTLY