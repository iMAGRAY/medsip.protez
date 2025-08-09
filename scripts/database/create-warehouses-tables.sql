-- Создание таблицы складов
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы остатков товаров по складам
CREATE TABLE IF NOT EXISTS product_warehouse_stock (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, warehouse_id)
);

-- Создание таблицы остатков вариантов товаров по складам
CREATE TABLE IF NOT EXISTS variant_warehouse_stock (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(variant_id, warehouse_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_product_warehouse_stock_product_id ON product_warehouse_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_product_warehouse_stock_warehouse_id ON product_warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_variant_warehouse_stock_variant_id ON variant_warehouse_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_warehouse_stock_warehouse_id ON variant_warehouse_stock(warehouse_id);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_warehouse_stock_updated_at BEFORE UPDATE ON product_warehouse_stock
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variant_warehouse_stock_updated_at BEFORE UPDATE ON variant_warehouse_stock
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Добавление примеров складов
INSERT INTO warehouses (name, code, address, city, sort_order) VALUES
    ('Основной склад', 'MAIN', 'ул. Центральная, 1', 'Москва', 1),
    ('Склад №2', 'WH2', 'ул. Складская, 15', 'Санкт-Петербург', 2),
    ('Склад №3', 'WH3', 'пр. Индустриальный, 45', 'Новосибирск', 3)
ON CONFLICT (code) DO NOTHING;

-- Комментарии к таблицам
COMMENT ON TABLE warehouses IS 'Склады для хранения товаров';
COMMENT ON TABLE product_warehouse_stock IS 'Остатки товаров по складам';
COMMENT ON TABLE variant_warehouse_stock IS 'Остатки вариантов товаров по складам';

COMMENT ON COLUMN product_warehouse_stock.reserved_quantity IS 'Зарезервированное количество (например, в заказах)';
COMMENT ON COLUMN variant_warehouse_stock.reserved_quantity IS 'Зарезервированное количество (например, в заказах)';