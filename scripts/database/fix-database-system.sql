-- =====================================================
-- СКРИПТ БЕЗОПАСНОГО ПРИВЕДЕНИЯ СИСТЕМЫ В ПОРЯДОК
-- Выполните этот скрипт в вашей PostgreSQL базе данных
-- =====================================================

BEGIN;

-- 1. СОЗДАНИЕ ПРЕДСТАВЛЕНИЙ ДЛЯ НЕСУЩЕСТВУЮЩИХ ТАБЛИЦ
-- =====================================================

-- Представление spec_groups (API использует эту несуществующую таблицу)
DROP VIEW IF EXISTS spec_groups CASCADE;
CREATE VIEW spec_groups AS
SELECT 
  id,
  name,
  description,
  sort_order as ordering,
  parent_id,
  is_active,
  created_at,
  updated_at,
  show_in_main_params,
  main_params_priority,
  is_section,
  category_id
FROM characteristics_groups_simple;

-- Представление spec_enums
DROP VIEW IF EXISTS spec_enums CASCADE;
CREATE VIEW spec_enums AS
SELECT 
  id,
  group_id,
  value,
  description,
  sort_order,
  is_active,
  color_hex,
  created_at,
  updated_at
FROM characteristics_values_simple;

-- 2. СОЗДАНИЕ ПРЕДСТАВЛЕНИЯ ДЛЯ API V2
-- =====================================================

DROP VIEW IF EXISTS v_product_variants_full CASCADE;
CREATE VIEW v_product_variants_full AS
SELECT 
  pv.id,
  pv.master_id,
  pv.name,
  pv.slug,
  pv.sku,
  pv.description,
  pv.price,
  pv.discount_price,
  pv.stock_quantity,
  pv.weight,
  pv.primary_image_url,
  pv.images,
  pv.is_featured,
  pv.is_new,
  pv.is_bestseller,
  pv.is_active,
  pv.sort_order,
  pv.warranty_months,
  pv.battery_life_hours,
  pv.meta_title,
  pv.meta_description,
  pv.meta_keywords,
  pv.custom_fields,
  pv.attributes,
  pv.created_at,
  pv.updated_at,
  p.name as product_name,
  p.category_id,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vcs.id,
          'value_id', vcs.value_id,
          'additional_value', vcs.additional_value,
          'group_id', cvs.group_id,
          'group_name', cgs.name,
          'value', cvs.value
        )
      )
      FROM variant_characteristics_simple vcs
      JOIN characteristics_values_simple cvs ON vcs.value_id = cvs.id
      JOIN characteristics_groups_simple cgs ON cvs.group_id = cgs.id
      WHERE vcs.variant_id = pv.id
    ),
    '[]'::jsonb
  ) as characteristics
FROM product_variants pv
JOIN products p ON pv.master_id = p.id
WHERE (pv.is_deleted = false OR pv.is_deleted IS NULL);

-- 3. МИГРАЦИЯ ДАННЫХ ИЗ product_sizes В product_variants
-- =====================================================

-- Проверка количества записей для миграции
DO $$
DECLARE
  to_migrate INTEGER;
BEGIN
  SELECT COUNT(*) INTO to_migrate
  FROM product_sizes ps
  WHERE NOT EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.master_id = ps.product_id 
    AND pv.attributes->>'original_id' = ps.id::text
    AND pv.attributes->>'migrated_from' = 'product_sizes'
  );
  
  RAISE NOTICE 'Найдено % записей для миграции', to_migrate;
END $$;

-- Миграция данных
INSERT INTO product_variants (
  master_id, name, slug, sku, description,
  price, discount_price, stock_quantity, weight,
  primary_image_url, images, is_featured, is_new, is_bestseller,
  is_active, sort_order, warranty_months, battery_life_hours,
  meta_title, meta_description, meta_keywords,
  custom_fields, attributes, created_at, updated_at
)
SELECT 
  ps.product_id,
  COALESCE(ps.name, ps.size_name, 'Вариант ' || ps.id),
  LOWER(REGEXP_REPLACE(COALESCE(ps.name, ps.size_name, 'variant-' || ps.id), '[^a-z0-9а-яё]+', '-', 'g')) || '-ps' || ps.id,
  COALESCE(ps.sku, 'PS-' || ps.id),
  ps.description,
  ps.price,
  ps.discount_price,
  COALESCE(ps.stock_quantity, 0),
  ps.weight,
  ps.image_url,
  COALESCE(ps.images, '[]'::jsonb),
  COALESCE(ps.is_featured, false),
  COALESCE(ps.is_new, false),
  COALESCE(ps.is_bestseller, false),
  COALESCE(ps.is_available, true),
  COALESCE(ps.sort_order, 999),
  CASE WHEN ps.warranty ~ '^\d+$' THEN ps.warranty::integer ELSE NULL END,
  CASE WHEN ps.battery_life ~ '^\d+$' THEN ps.battery_life::integer ELSE NULL END,
  ps.meta_title,
  ps.meta_description,
  ps.meta_keywords,
  COALESCE(ps.custom_fields, '{}'::jsonb),
  jsonb_build_object(
    'migrated_from', 'product_sizes',
    'original_id', ps.id,
    'migration_date', NOW()::text,
    'size_name', ps.size_name,
    'size_value', ps.size_value,
    'dimensions', ps.dimensions,
    'specifications', ps.specifications,
    'characteristics', ps.characteristics
  ),
  COALESCE(ps.created_at, NOW()),
  COALESCE(ps.updated_at, NOW())
FROM product_sizes ps
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants pv
  WHERE pv.master_id = ps.product_id 
  AND pv.attributes->>'original_id' = ps.id::text
  AND pv.attributes->>'migrated_from' = 'product_sizes'
)
ON CONFLICT DO NOTHING;

-- 4. СОЗДАНИЕ УНИВЕРСАЛЬНОГО ПРЕДСТАВЛЕНИЯ
-- =====================================================

DROP VIEW IF EXISTS v_all_product_variants CASCADE;
CREATE VIEW v_all_product_variants AS
SELECT 
  pv.id,
  pv.master_id as product_id,
  pv.name,
  pv.sku,
  pv.price,
  pv.discount_price,
  pv.stock_quantity,
  pv.is_active,
  pv.sort_order,
  pv.created_at,
  pv.updated_at,
  p.name as product_name,
  p.category_id,
  'product_variants' as source
FROM product_variants pv
JOIN products p ON pv.master_id = p.id
WHERE (pv.is_deleted = false OR pv.is_deleted IS NULL)
AND (p.is_deleted = false OR p.is_deleted IS NULL);

-- 5. СОЗДАНИЕ ИНДЕКСОВ ДЛЯ ОПТИМИЗАЦИИ
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_product_variants_migration 
ON product_variants ((attributes->>'migrated_from'))
WHERE attributes->>'migrated_from' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_original_id 
ON product_variants ((attributes->>'original_id'))
WHERE attributes->>'original_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_variant_characteristics_composite 
ON variant_characteristics_simple (variant_id, value_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_master_sku 
ON product_variants (master_id, sku);

-- 6. ОБНОВЛЕНИЕ СТАТИСТИКИ
-- =====================================================

ANALYZE product_variants;
ANALYZE product_sizes;
ANALYZE variant_characteristics_simple;
ANALYZE characteristics_groups_simple;
ANALYZE characteristics_values_simple;

-- 7. ИТОГОВАЯ СТАТИСТИКА
-- =====================================================

DO $$
DECLARE
  products_count INTEGER;
  variants_count INTEGER;
  sizes_count INTEGER;
  migrated_count INTEGER;
  characteristics_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO products_count
  FROM products
  WHERE is_deleted = false OR is_deleted IS NULL;
  
  SELECT COUNT(*) INTO variants_count
  FROM product_variants
  WHERE is_deleted = false OR is_deleted IS NULL;
  
  SELECT COUNT(*) INTO sizes_count
  FROM product_sizes;
  
  SELECT COUNT(*) INTO migrated_count
  FROM product_variants
  WHERE attributes->>'migrated_from' = 'product_sizes';
  
  SELECT COUNT(*) INTO characteristics_count
  FROM variant_characteristics_simple;
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'ИТОГОВАЯ СТАТИСТИКА:';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Всего продуктов: %', products_count;
  RAISE NOTICE 'Вариантов в product_variants: %', variants_count;
  RAISE NOTICE 'Записей в product_sizes (сохранено): %', sizes_count;
  RAISE NOTICE 'Мигрированных записей: %', migrated_count;
  RAISE NOTICE 'Характеристик вариантов: %', characteristics_count;
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'СИСТЕМА УСПЕШНО ПРИВЕДЕНА В ПОРЯДОК!';
  RAISE NOTICE '==========================================';
END $$;

COMMIT;

-- Проверка созданных представлений
SELECT 
  viewname,
  schemaname
FROM pg_views
WHERE schemaname = 'public' 
AND viewname IN ('spec_groups', 'spec_enums', 'v_all_product_variants', 'v_product_variants_full')
ORDER BY viewname;