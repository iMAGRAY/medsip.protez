-- Добавление поддержки личных тегов для вариантов товаров

-- Добавляем поле variant_id в таблицу product_tags
-- NULL означает общий тег или личный тег товара
-- Не NULL означает личный тег варианта
ALTER TABLE product_tags 
ADD COLUMN IF NOT EXISTS variant_id INTEGER DEFAULT NULL;

-- Создаем индекс для быстрого поиска личных тегов варианта
CREATE INDEX IF NOT EXISTS idx_product_tags_variant_id ON product_tags(variant_id);

-- Добавляем составной уникальный индекс для вариантов
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_tags_name_variant_id ON product_tags(name, variant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_tags_slug_variant_id ON product_tags(slug, variant_id);

-- Комментарии
COMMENT ON COLUMN product_tags.variant_id IS 'ID варианта для личных тегов вариантов. NULL для общих тегов и личных тегов товаров';

-- Примеры личных тегов вариантов
-- INSERT INTO product_tags (name, slug, color, bg_color, icon, variant_id, sort_order) VALUES 
--   ('Размер XXL', 'size-xxl', '#dc2626', '#fee2e2', 'ruler', 456, 5),
--   ('Цвет: Синий металлик', 'color-blue-metallic', '#3b82f6', '#dbeafe', 'palette', 456, 15);