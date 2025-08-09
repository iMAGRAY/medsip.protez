-- Скрипт для анализа и нормализации атрибутов вариантов товаров

-- 1. Анализ текущего состояния атрибутов
SELECT 
    id,
    name,
    jsonb_typeof(attributes) as attr_type,
    CASE 
        WHEN jsonb_typeof(attributes) = 'array' THEN 'array'
        WHEN jsonb_typeof(attributes) = 'object' THEN 'object'
        ELSE 'other'
    END as format,
    attributes
FROM product_variants
WHERE attributes IS NOT NULL
LIMIT 10;

-- 2. Подсчет вариантов по типу атрибутов
SELECT 
    CASE 
        WHEN jsonb_typeof(attributes) = 'array' THEN 'array'
        WHEN jsonb_typeof(attributes) = 'object' THEN 'object'
        WHEN attributes IS NULL THEN 'null'
        ELSE 'other'
    END as attr_format,
    COUNT(*) as count
FROM product_variants
GROUP BY attr_format;

-- 3. Примеры вариантов с атрибутами-массивами
SELECT 
    id,
    name,
    jsonb_pretty(attributes) as attributes
FROM product_variants
WHERE jsonb_typeof(attributes) = 'array'
LIMIT 5;

-- 4. Функция для преобразования атрибутов-массивов в объекты
-- (для обратной совместимости, если нужно)
CREATE OR REPLACE FUNCTION convert_array_attributes_to_object(attrs jsonb)
RETURNS jsonb AS $$
DECLARE
    result jsonb = '{}'::jsonb;
    attr jsonb;
    key text;
    value text;
BEGIN
    IF jsonb_typeof(attrs) = 'array' THEN
        FOR attr IN SELECT * FROM jsonb_array_elements(attrs)
        LOOP
            -- Используем group_name как ключ
            key := lower(replace(attr->>'group_name', ' ', '_'));
            value := attr->>'value_name';
            
            -- Если ключ уже существует, добавляем индекс
            IF result ? key THEN
                key := key || '_' || (attr->>'group_id')::text;
            END IF;
            
            result := result || jsonb_build_object(key, value);
        END LOOP;
        RETURN result;
    ELSE
        RETURN attrs;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Пример преобразования для одного варианта
SELECT 
    id,
    name,
    attributes as original,
    convert_array_attributes_to_object(attributes) as converted
FROM product_variants
WHERE jsonb_typeof(attributes) = 'array'
LIMIT 1;

-- 6. Если нужно преобразовать все атрибуты-массивы в объекты:
-- ВНИМАНИЕ: Сначала сделайте резервную копию!
-- UPDATE product_variants
-- SET attributes = convert_array_attributes_to_object(attributes)
-- WHERE jsonb_typeof(attributes) = 'array';

-- 7. Создание индекса для поиска по атрибутам
CREATE INDEX IF NOT EXISTS idx_product_variants_attributes_gin 
ON product_variants USING gin(attributes);

-- 8. Поиск вариантов по конкретному атрибуту (для массивов)
SELECT 
    id,
    name,
    attributes
FROM product_variants
WHERE attributes @> '[{"group_name": "Вес"}]'::jsonb
LIMIT 5;
