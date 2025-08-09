-- Добавление поля discount_price в таблицу product_sizes
ALTER TABLE product_sizes 
ADD COLUMN IF NOT EXISTS discount_price DECIMAL(12,2);

-- Комментарий к новому полю
COMMENT ON COLUMN product_sizes.discount_price IS 'Цена со скидкой для варианта товара';

-- Индекс для оптимизации запросов по цене со скидкой
CREATE INDEX IF NOT EXISTS idx_product_sizes_discount_price 
ON product_sizes(discount_price) 
WHERE discount_price IS NOT NULL;