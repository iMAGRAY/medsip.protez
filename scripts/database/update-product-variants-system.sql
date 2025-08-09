-- Обновление существующей системы вариантов товаров
-- Автор: AI Assistant
-- Дата создания: 2025-01-23

-- =====================================================
-- 1. ОБНОВЛЕНИЕ ТАБЛИЦЫ product_variants
-- =====================================================

-- Добавляем недостающие колонки
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS slug VARCHAR(500),
ADD COLUMN IF NOT EXISTS name VARCHAR(500),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_stock_level INTEGER,
ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3),
ADD COLUMN IF NOT EXISTS length DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS width DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS height DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS primary_image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS warranty_months INTEGER,
ADD COLUMN IF NOT EXISTS battery_life_hours INTEGER,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Обновляем name для существующих записей
UPDATE product_variants 
SET name = 'Вариант ' || id
WHERE name IS NULL;

-- Делаем name обязательным
ALTER TABLE product_variants ALTER COLUMN name SET NOT NULL;
