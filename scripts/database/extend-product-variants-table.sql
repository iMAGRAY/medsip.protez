-- Расширение таблицы product_sizes для полной настройки вариантов

-- Добавляем поля для полного описания варианта
ALTER TABLE product_sizes 
ADD COLUMN IF NOT EXISTS name VARCHAR(500),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS warranty VARCHAR(255),
ADD COLUMN IF NOT EXISTS battery_life VARCHAR(255),
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS characteristics JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS selection_tables JSONB DEFAULT '[]'::jsonb;

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_product_sizes_name ON product_sizes(name);
CREATE INDEX IF NOT EXISTS idx_product_sizes_is_featured ON product_sizes(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_product_sizes_is_new ON product_sizes(is_new) WHERE is_new = true;
CREATE INDEX IF NOT EXISTS idx_product_sizes_is_bestseller ON product_sizes(is_bestseller) WHERE is_bestseller = true;

-- Комментарии к новым полям
COMMENT ON COLUMN product_sizes.name IS 'Полное название варианта товара';
COMMENT ON COLUMN product_sizes.description IS 'Подробное описание варианта';
COMMENT ON COLUMN product_sizes.image_url IS 'Основное изображение варианта';
COMMENT ON COLUMN product_sizes.images IS 'Массив дополнительных изображений варианта';
COMMENT ON COLUMN product_sizes.warranty IS 'Гарантийный срок для варианта';
COMMENT ON COLUMN product_sizes.battery_life IS 'Время работы от батареи для варианта';
COMMENT ON COLUMN product_sizes.meta_title IS 'SEO заголовок варианта';
COMMENT ON COLUMN product_sizes.meta_description IS 'SEO описание варианта';
COMMENT ON COLUMN product_sizes.meta_keywords IS 'SEO ключевые слова варианта';
COMMENT ON COLUMN product_sizes.is_featured IS 'Рекомендуемый вариант';
COMMENT ON COLUMN product_sizes.is_new IS 'Новинка';
COMMENT ON COLUMN product_sizes.is_bestseller IS 'Хит продаж';
COMMENT ON COLUMN product_sizes.custom_fields IS 'Дополнительные пользовательские поля';
COMMENT ON COLUMN product_sizes.characteristics IS 'Характеристики варианта';
COMMENT ON COLUMN product_sizes.selection_tables IS 'Таблицы подбора для варианта';