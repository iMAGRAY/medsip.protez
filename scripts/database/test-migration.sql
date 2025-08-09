-- =====================================================
-- ТЕСТОВЫЙ СКРИПТ ДЛЯ ПРОВЕРКИ МИГРАЦИИ
-- =====================================================

\echo '==========================================';
\echo 'ПРОВЕРКА ПРЕДСТАВЛЕНИЙ';
\echo '==========================================';

-- Проверка созданных представлений
SELECT 
  viewname,
  CASE 
    WHEN viewname = 'spec_groups' THEN 'Совместимость API для групп характеристик'
    WHEN viewname = 'spec_enums' THEN 'Совместимость API для значений характеристик'
    WHEN viewname = 'v_all_product_variants' THEN 'Универсальное представление вариантов'
    WHEN viewname = 'v_product_variants_full' THEN 'Полное представление с характеристиками'
  END as description
FROM pg_views
WHERE schemaname = 'public' 
AND viewname IN ('spec_groups', 'spec_enums', 'v_all_product_variants', 'v_product_variants_full')
ORDER BY viewname;

\echo '';
\echo '==========================================';
\echo 'СТАТИСТИКА ДАННЫХ';
\echo '==========================================';

-- Статистика по таблицам
SELECT 
  'products' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_deleted = false OR is_deleted IS NULL) as active_records
FROM products
UNION ALL
SELECT 
  'product_variants',
  COUNT(*),
  COUNT(*) FILTER (WHERE is_deleted = false OR is_deleted IS NULL)
FROM product_variants
UNION ALL
SELECT 
  'product_sizes',
  COUNT(*),
  COUNT(*)
FROM product_sizes
UNION ALL
SELECT 
  'characteristics_groups_simple',
  COUNT(*),
  COUNT(*) FILTER (WHERE is_active = true)
FROM characteristics_groups_simple
UNION ALL
SELECT 
  'characteristics_values_simple',
  COUNT(*),
  COUNT(*) FILTER (WHERE is_active = true)
FROM characteristics_values_simple
ORDER BY table_name;

\echo '';
\echo '==========================================';
\echo 'ПРОВЕРКА МИГРАЦИИ product_sizes';
\echo '==========================================';

-- Проверка мигрированных записей
SELECT 
  COUNT(*) as migrated_from_product_sizes
FROM product_variants
WHERE attributes->>'migrated_from' = 'product_sizes';

-- Примеры мигрированных записей
SELECT 
  id,
  master_id as product_id,
  name,
  sku,
  price,
  attributes->>'original_id' as original_size_id,
  attributes->>'size_name' as original_size_name
FROM product_variants
WHERE attributes->>'migrated_from' = 'product_sizes'
LIMIT 3;

\echo '';
\echo '==========================================';
\echo 'ПРОВЕРКА РАБОТЫ ПРЕДСТАВЛЕНИЙ';
\echo '==========================================';

-- Тест spec_groups
\echo 'Тест spec_groups (первые 3 записи):';
SELECT id, name, ordering, parent_id 
FROM spec_groups 
WHERE is_active = true
LIMIT 3;

-- Тест spec_enums
\echo '';
\echo 'Тест spec_enums (первые 3 записи):';
SELECT id, group_id, value, sort_order 
FROM spec_enums 
WHERE is_active = true
LIMIT 3;

-- Тест v_all_product_variants
\echo '';
\echo 'Тест v_all_product_variants (первые 3 записи):';
SELECT product_id, name, sku, price, stock_quantity 
FROM v_all_product_variants
LIMIT 3;

\echo '';
\echo '==========================================';
\echo 'ПРОВЕРКА ИНДЕКСОВ';
\echo '==========================================';

-- Проверка созданных индексов
SELECT 
  indexname,
  tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
  'idx_product_variants_migration',
  'idx_product_variants_original_id',
  'idx_variant_characteristics_composite',
  'idx_product_variants_master_sku'
)
ORDER BY indexname;

\echo '';
\echo '==========================================';
\echo 'ИТОГОВЫЙ СТАТУС';
\echo '==========================================';
\echo 'Если все проверки выше показывают данные,';
\echo 'то миграция выполнена успешно!';
\echo '==========================================';