-- Создание таблицы для хранения характеристик вариантов товара в упрощенной системе
CREATE TABLE IF NOT EXISTS variant_characteristics_simple (
  id SERIAL PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  value_id INTEGER NOT NULL REFERENCES characteristics_values_simple(id) ON DELETE CASCADE,
  additional_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Уникальный индекс для предотвращения дублирования
  UNIQUE(variant_id, value_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_variant_characteristics_simple_variant ON variant_characteristics_simple(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_characteristics_simple_value ON variant_characteristics_simple(value_id);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_variant_characteristics_simple_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_variant_characteristics_simple_updated_at ON variant_characteristics_simple;
CREATE TRIGGER update_variant_characteristics_simple_updated_at
BEFORE UPDATE ON variant_characteristics_simple
FOR EACH ROW
EXECUTE FUNCTION update_variant_characteristics_simple_updated_at();

-- Комментарии к таблице
COMMENT ON TABLE variant_characteristics_simple IS 'Характеристики вариантов товаров в упрощенной системе';
COMMENT ON COLUMN variant_characteristics_simple.variant_id IS 'ID варианта товара';
COMMENT ON COLUMN variant_characteristics_simple.value_id IS 'ID значения характеристики из characteristics_values_simple';
COMMENT ON COLUMN variant_characteristics_simple.additional_value IS 'Дополнительное значение (например, для уточнения)';

-- Если нужно мигрировать данные из старой системы (product_characteristics_new)
-- можно использовать следующий запрос (закомментирован для безопасности):
/*
INSERT INTO variant_characteristics_simple (variant_id, value_id, additional_value)
SELECT DISTINCT
  pc.variant_id,
  cv.id as value_id,
  pc.raw_value as additional_value
FROM product_characteristics_new pc
JOIN characteristic_templates ct ON pc.template_id = ct.id
JOIN characteristic_groups cg ON ct.group_id = cg.id
LEFT JOIN characteristic_values cv ON pc.enum_value_id = cv.id
WHERE pc.variant_id IS NOT NULL
  AND cv.id IS NOT NULL
ON CONFLICT (variant_id, value_id) DO NOTHING;
*/