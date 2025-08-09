-- Комплексная система вариантов товаров для долгосрочного восхитительного пользовательского опыта
-- Автор: AI Assistant
-- Дата создания: 2025-01-23

-- =====================================================
-- 1. СОЗДАНИЕ ОСНОВНОЙ ТАБЛИЦЫ ВАРИАНТОВ ТОВАРОВ
-- =====================================================

-- Удаляем старую таблицу если существует (только для разработки)
-- DROP TABLE IF EXISTS product_variants CASCADE;

-- Создаем новую таблицу вариантов товаров
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    master_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Основная информация о варианте
    sku VARCHAR(255) UNIQUE,
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE,
    description TEXT,
    short_description TEXT,
    
    -- Ценообразование
    price DECIMAL(10, 2),
    discount_price DECIMAL(10, 2),
    cost_price DECIMAL(10, 2),
    
    -- Складские данные
    stock_quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    
    -- Физические характеристики
    weight DECIMAL(10, 3),
    length DECIMAL(10, 2),
    width DECIMAL(10, 2),
    height DECIMAL(10, 2),
    
    -- Медиа
    primary_image_url VARCHAR(500),
    images JSONB DEFAULT '[]'::jsonb,
    videos JSONB DEFAULT '[]'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    
    -- Атрибуты варианта (размер, цвет и т.д.)
    attributes JSONB DEFAULT '{}'::jsonb,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    
    -- Маркетинговые флаги
    is_featured BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    is_bestseller BOOLEAN DEFAULT false,
    is_recommended BOOLEAN DEFAULT false,
    
    -- Статусы
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    
    -- Дополнительные поля
    warranty_months INTEGER,
    battery_life_hours INTEGER,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Сортировка
    sort_order INTEGER DEFAULT 0,
    
    -- Ограничения
    CONSTRAINT positive_price CHECK (price IS NULL OR price >= 0),
    CONSTRAINT positive_discount CHECK (discount_price IS NULL OR discount_price >= 0),
    CONSTRAINT discount_less_than_price CHECK (discount_price IS NULL OR price IS NULL OR discount_price <= price),
    CONSTRAINT positive_stock CHECK (stock_quantity >= 0),
    CONSTRAINT positive_reserved CHECK (reserved_quantity >= 0),
    CONSTRAINT reserved_less_than_stock CHECK (reserved_quantity <= stock_quantity)
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_product_variants_master_id ON product_variants(master_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_slug ON product_variants(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_is_active ON product_variants(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_variants_attributes ON product_variants USING GIN(attributes);
CREATE INDEX IF NOT EXISTS idx_product_variants_stock ON product_variants(stock_quantity) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_variants_featured ON product_variants(is_featured) WHERE is_featured = true AND is_active = true;

-- =====================================================
-- 2. ТАБЛИЦА ТИПОВ АТРИБУТОВ ВАРИАНТОВ
-- =====================================================

CREATE TABLE IF NOT EXISTS variant_attribute_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    input_type VARCHAR(50) NOT NULL DEFAULT 'select', -- select, radio, color_picker, size_grid
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Предустановленные типы атрибутов
INSERT INTO variant_attribute_types (code, name, display_name, input_type) VALUES
    ('size', 'Размер', 'Выберите размер', 'select'),
    ('color', 'Цвет', 'Выберите цвет', 'color_picker'),
    ('material', 'Материал', 'Выберите материал', 'select'),
    ('configuration', 'Конфигурация', 'Выберите конфигурацию', 'radio')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 3. ТАБЛИЦА ЗНАЧЕНИЙ АТРИБУТОВ
-- =====================================================

CREATE TABLE IF NOT EXISTS variant_attribute_values (
    id SERIAL PRIMARY KEY,
    attribute_type_id INTEGER NOT NULL REFERENCES variant_attribute_types(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    display_value VARCHAR(255),
    color_hex VARCHAR(7), -- для цветов
    image_url VARCHAR(500), -- для визуального представления
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(attribute_type_id, value)
);

-- =====================================================
-- 4. ТАБЛИЦА ХАРАКТЕРИСТИК ВАРИАНТОВ
-- =====================================================

CREATE TABLE IF NOT EXISTS variant_characteristics (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES characteristic_templates(id),
    
    -- Различные типы значений
    text_value TEXT,
    numeric_value DECIMAL(20, 6),
    boolean_value BOOLEAN,
    date_value DATE,
    enum_value_id INTEGER REFERENCES characteristic_enum_values(id),
    json_value JSONB,
    
    -- Метаданные
    is_highlighted BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(variant_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_variant_characteristics_variant ON variant_characteristics(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_characteristics_template ON variant_characteristics(template_id);
CREATE INDEX IF NOT EXISTS idx_variant_characteristics_highlighted ON variant_characteristics(is_highlighted) WHERE is_highlighted = true;

-- =====================================================
-- 5. ТАБЛИЦА ИЗОБРАЖЕНИЙ ВАРИАНТОВ
-- =====================================================

CREATE TABLE IF NOT EXISTS variant_images (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    title VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    image_type VARCHAR(50), -- main, gallery, size_chart, etc.
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Только одно основное изображение на вариант
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_image_per_variant 
ON variant_images(variant_id) 
WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_variant_images_variant ON variant_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_primary ON variant_images(variant_id, is_primary) WHERE is_primary = true;

-- =====================================================
-- 6. ТАБЛИЦА ЦЕНЫ ДЛЯ РАЗНЫХ ГРУПП ПОЛЬЗОВАТЕЛЕЙ
-- =====================================================

CREATE TABLE IF NOT EXISTS variant_price_tiers (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    user_group VARCHAR(50) NOT NULL, -- retail, wholesale, vip, etc.
    price DECIMAL(10, 2) NOT NULL,
    min_quantity INTEGER DEFAULT 1,
    max_quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(variant_id, user_group, min_quantity)
);

-- =====================================================
-- 7. ПРЕДСТАВЛЕНИЯ ДЛЯ УДОБНОЙ РАБОТЫ
-- =====================================================

-- Представление для полной информации о вариантах
CREATE OR REPLACE VIEW v_product_variants_full AS
SELECT 
    pv.*,
    p.name as master_name,
    p.category_id,
    p.manufacturer_id,
    p.series_id,
    pc.name as category_name,
    m.name as manufacturer_name,
    ms.name as series_name,
    COALESCE(pv.stock_quantity - pv.reserved_quantity, 0) as available_stock,
    CASE 
        WHEN pv.stock_quantity > 0 AND pv.is_active THEN true
        ELSE false
    END as in_stock,
    COUNT(DISTINCT vi.id) as image_count,
    COUNT(DISTINCT vc.id) as characteristic_count
FROM product_variants pv
JOIN products p ON pv.master_id = p.id
LEFT JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
LEFT JOIN model_series ms ON p.series_id = ms.id
LEFT JOIN variant_images vi ON pv.id = vi.variant_id
LEFT JOIN variant_characteristics vc ON pv.id = vc.variant_id
WHERE pv.is_deleted = false
GROUP BY pv.id, p.id, pc.id, m.id, ms.id;

-- =====================================================
-- 8. ФУНКЦИИ ДЛЯ РАБОТЫ С ВАРИАНТАМИ
-- =====================================================

-- Функция для генерации slug варианта
CREATE OR REPLACE FUNCTION generate_variant_slug(variant_name TEXT, variant_id INTEGER DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Создаем базовый slug
    base_slug := lower(regexp_replace(variant_name, '[^a-zA-Z0-9а-яА-Я]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    
    final_slug := base_slug;
    
    -- Проверяем уникальность
    WHILE EXISTS (
        SELECT 1 FROM product_variants 
        WHERE slug = final_slug 
        AND (variant_id IS NULL OR id != variant_id)
    ) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON product_variants;
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE
    ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_variant_characteristics_updated_at ON variant_characteristics;
CREATE TRIGGER update_variant_characteristics_updated_at BEFORE UPDATE
    ON variant_characteristics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. МИГРАЦИЯ СУЩЕСТВУЮЩИХ ДАННЫХ
-- =====================================================

-- Миграция из product_sizes в product_variants (если таблица существует)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_sizes') THEN
        INSERT INTO product_variants (
            master_id,
            name,
            sku,
            price,
            discount_price,
            stock_quantity,
            weight,
            attributes,
            sort_order,
            is_active
        )
        SELECT 
            product_id as master_id,
            COALESCE(name, size_name) as name,
            sku,
            price,
            discount_price,
            stock_quantity,
            weight::decimal,
            jsonb_build_object('size', size_name, 'size_value', size_value),
            sort_order,
            is_available as is_active
        FROM product_sizes
        WHERE NOT EXISTS (
            SELECT 1 FROM product_variants pv 
            WHERE pv.master_id = product_sizes.product_id 
            AND pv.attributes->>'size' = product_sizes.size_name
        );
    END IF;
END $$;

-- =====================================================
-- 10. КОММЕНТАРИИ К ТАБЛИЦАМ И ПОЛЯМ
-- =====================================================

COMMENT ON TABLE product_variants IS 'Основная таблица вариантов товаров с полной информацией';
COMMENT ON COLUMN product_variants.master_id IS 'ID товара';
COMMENT ON COLUMN product_variants.attributes IS 'JSON с атрибутами варианта (размер, цвет и т.д.)';
COMMENT ON COLUMN product_variants.stock_quantity IS 'Общее количество на складе';
COMMENT ON COLUMN product_variants.reserved_quantity IS 'Зарезервированное количество';
COMMENT ON COLUMN product_variants.custom_fields IS 'Дополнительные пользовательские поля в формате JSON';

-- =====================================================
-- ГОТОВО! Система вариантов товаров создана
-- =====================================================