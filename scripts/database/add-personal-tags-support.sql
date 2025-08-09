-- Добавление поддержки личных тегов для товаров

-- Добавляем поле product_id в таблицу product_tags
-- NULL означает общий тег, доступный всем товарам
-- Не NULL означает личный тег, доступный только указанному товару
ALTER TABLE product_tags 
ADD COLUMN IF NOT EXISTS product_id INTEGER DEFAULT NULL;

-- Создаем индекс для быстрого поиска личных тегов товара
CREATE INDEX IF NOT EXISTS idx_product_tags_product_id ON product_tags(product_id);

-- Убираем уникальность с name и slug, так как теперь могут быть личные теги с одинаковыми названиями для разных товаров
ALTER TABLE product_tags DROP CONSTRAINT IF EXISTS product_tags_name_key;
ALTER TABLE product_tags DROP CONSTRAINT IF EXISTS product_tags_slug_key;

-- Добавляем составной уникальный индекс: (name, product_id) и (slug, product_id)
-- Это позволит иметь одинаковые названия для личных тегов разных товаров
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_tags_name_product_id ON product_tags(name, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_tags_slug_product_id ON product_tags(slug, product_id);

-- Комментарии
COMMENT ON COLUMN product_tags.product_id IS 'ID товара для личных тегов. NULL для общих тегов';

-- Примеры личных тегов
-- INSERT INTO product_tags (name, slug, color, bg_color, icon, product_id, sort_order) VALUES 
--   ('Последний размер', 'last-size', '#dc2626', '#fee2e2', 'alert-circle', 123, 5),
--   ('Подарок в комплекте', 'gift-included', '#9333ea', '#f3e8ff', 'gift', 123, 15);