-- Создание таблицы тегов
CREATE TABLE IF NOT EXISTS product_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6366f1', -- HEX цвет
  bg_color VARCHAR(7) DEFAULT '#e0e7ff', -- HEX цвет фона
  icon VARCHAR(50), -- название иконки из lucide
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связь товаров с тегами
CREATE TABLE IF NOT EXISTS product_tag_relations (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, tag_id)
);

-- Индексы для производительности
CREATE INDEX idx_product_tag_relations_product_id ON product_tag_relations(product_id);
CREATE INDEX idx_product_tag_relations_tag_id ON product_tag_relations(tag_id);
CREATE INDEX idx_product_tags_slug ON product_tags(slug);
CREATE INDEX idx_product_tags_is_active ON product_tags(is_active);

-- Вставка начальных тегов
INSERT INTO product_tags (name, slug, color, bg_color, icon, sort_order) VALUES 
  ('Новинка', 'new', '#10b981', '#d1fae5', 'sparkles', 10),
  ('Хит продаж', 'bestseller', '#f59e0b', '#fef3c7', 'trending-up', 20),
  ('Рекомендуем', 'recommended', '#8b5cf6', '#ede9fe', 'star', 30),
  ('Акция', 'sale', '#ef4444', '#fee2e2', 'percent', 40),
  ('Эксклюзив', 'exclusive', '#6366f1', '#e0e7ff', 'crown', 50),
  ('Премиум', 'premium', '#f59e0b', '#fef3c7', 'gem', 60),
  ('Экологичный', 'eco', '#10b981', '#d1fae5', 'leaf', 70),
  ('Гарантия 5 лет', 'warranty-5', '#3b82f6', '#dbeafe', 'shield-check', 80),
  ('Быстрая доставка', 'fast-delivery', '#06b6d4', '#cffafe', 'truck', 90),
  ('Сделано в России', 'made-in-russia', '#ef4444', '#fee2e2', 'flag', 100)
ON CONFLICT (slug) DO NOTHING;