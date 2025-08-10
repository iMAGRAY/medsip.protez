import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRESQL_HOST,
  port: parseInt(process.env.POSTGRESQL_PORT || '5432'),
  database: process.env.POSTGRESQL_DBNAME,
  user: process.env.POSTGRESQL_USER,
  password: process.env.POSTGRESQL_PASSWORD,
  ssl: process.env.DATABASE_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

export async function POST(_request: NextRequest) {
  try {

    // Создаем таблицы для полной иерархии
    await pool.query(`
      -- 1. Регионы
      CREATE TABLE IF NOT EXISTS warehouse_regions (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(10) UNIQUE NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      -- 2. Города
      CREATE TABLE IF NOT EXISTS warehouse_cities (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          region_id INTEGER REFERENCES warehouse_regions(id) ON DELETE CASCADE,
          code VARCHAR(10) NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(region_id, code)
      );
    `);

    await pool.query(`
      -- 3. Склады
      CREATE TABLE IF NOT EXISTS warehouse_warehouses (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          city_id INTEGER REFERENCES warehouse_cities(id) ON DELETE CASCADE,
          code VARCHAR(20) NOT NULL,
          address TEXT,
          phone VARCHAR(50),
          email VARCHAR(100),
          manager_name VARCHAR(255),
          total_capacity INTEGER DEFAULT 0,
          warehouse_type VARCHAR(50) DEFAULT 'standard',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(city_id, code)
      );
    `);

    // Добавляем колонки к существующим таблицам
    await pool.query(`
      ALTER TABLE warehouse_zones
      ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouse_warehouses(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS code VARCHAR(20);
    `);

    await pool.query(`
      -- 4. Артикулы товаров
      CREATE TABLE IF NOT EXISTS warehouse_articles (
          id SERIAL PRIMARY KEY,
          article_code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100),
          subcategory VARCHAR(100),
          brand VARCHAR(100),
          model VARCHAR(100),
          unit_of_measure VARCHAR(20) DEFAULT 'шт',
          weight_kg DECIMAL(10,3),
          dimensions_cm VARCHAR(50),
          barcode VARCHAR(100),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      ALTER TABLE warehouse_inventory
      ADD COLUMN IF NOT EXISTS article_id INTEGER REFERENCES warehouse_articles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS warehouse_id INTEGER;
    `);

    // Создаем индексы
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_cities_region ON warehouse_cities(region_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_warehouses_city ON warehouse_warehouses(city_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_zones_warehouse ON warehouse_zones(warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_article ON warehouse_inventory(article_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse ON warehouse_inventory(warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_articles_code ON warehouse_articles(article_code);
    `);

    // Добавляем тестовые регионы
    await pool.query(`
      INSERT INTO warehouse_regions (name, code, description) VALUES
      ('Центральный ФО', 'CFO', 'Центральный федеральный округ'),
      ('Северо-Западный ФО', 'NWFO', 'Северо-Западный федеральный округ'),
      ('Южный ФО', 'SFO', 'Южный федеральный округ')
      ON CONFLICT (code) DO NOTHING;
    `);

    // Добавляем тестовые города
    await pool.query(`
      INSERT INTO warehouse_cities (name, region_id, code, description) VALUES
      ('Москва', (SELECT id FROM warehouse_regions WHERE code = 'CFO'), 'MSK', 'Столица России'),
      ('Санкт-Петербург', (SELECT id FROM warehouse_regions WHERE code = 'NWFO'), 'SPB', 'Северная столица'),
      ('Краснодар', (SELECT id FROM warehouse_regions WHERE code = 'SFO'), 'KRD', 'Краснодарский край')
      ON CONFLICT (region_id, code) DO NOTHING;
    `);

    // Добавляем тестовые склады
    await pool.query(`
      INSERT INTO warehouse_warehouses (name, city_id, code, address, phone, manager_name, total_capacity, warehouse_type) VALUES
      ('Главный склад МедСИП', (SELECT id FROM warehouse_cities WHERE code = 'MSK'), 'MSK-001', 'г. Москва, ул. Медицинская, 15', '+7 (495) 123-45-67', 'Иванов И.И.', 2000, 'medical'),
      ('Склад протезов СПб', (SELECT id FROM warehouse_cities WHERE code = 'SPB'), 'SPB-001', 'г. Санкт-Петербург, пр. Медиков, 22', '+7 (812) 987-65-43', 'Петров П.П.', 1500, 'medical'),
      ('Южный распределительный центр', (SELECT id FROM warehouse_cities WHERE code = 'KRD'), 'KRD-001', 'г. Краснодар, ул. Складская, 8', '+7 (861) 555-33-22', 'Сидоров С.С.', 1200, 'distribution')
      ON CONFLICT (city_id, code) DO NOTHING;
    `);

    // Обновляем существующие зоны, привязывая к складам
    await pool.query(`
      UPDATE warehouse_zones
      SET warehouse_id = (SELECT id FROM warehouse_warehouses WHERE code = 'MSK-001' LIMIT 1),
          code = CASE
            WHEN name LIKE '%Зона A%' THEN 'A'
            WHEN name LIKE '%Зона B%' THEN 'B'
            WHEN name LIKE '%Зона C%' THEN 'C'
            WHEN name LIKE '%Зона D%' THEN 'D'
            ELSE 'UNK'
          END
      WHERE warehouse_id IS NULL;
    `);

    // Добавляем тестовые артикулы
    await pool.query(`
      INSERT INTO warehouse_articles (article_code, name, description, category, subcategory, brand, model, unit_of_measure, weight_kg, dimensions_cm) VALUES
      ('MSP-ARM-001', 'Протез руки миоэлектрический', 'Миоэлектрический протез руки с управлением от мышц', 'Протезы', 'Протезы рук', 'МедСИП', 'MSP-ARM-2024', 'шт', 1.2, '35x15x8'),
      ('MSP-LEG-001', 'Протез ноги механический', 'Механический протез ноги с коленным шарниром', 'Протезы', 'Протезы ног', 'МедСИП', 'MSP-LEG-2024', 'шт', 2.8, '95x20x15'),
      ('OTT-CLEG-001', 'C-Leg 4 компьютерный протез', 'Компьютерный протез голени с микропроцессором', 'Протезы', 'Протезы ног', 'OttoBock', 'C-Leg 4', 'шт', 3.5, '40x15x12'),
      ('OSS-RHEO-001', 'Rheo Knee коленный модуль', 'Магнитно-реологический коленный модуль', 'Протезы', 'Коленные модули', 'Össur', 'Rheo Knee', 'шт', 1.8, '25x12x8'),
      ('MSP-ORTH-001', 'Ортез голеностопный', 'Ортез голеностопного сустава с боковой поддержкой', 'Ортезы', 'Ортезы ног', 'МедСИП', 'MSP-ORTH-2024', 'шт', 0.5, '30x25x10')
      ON CONFLICT (article_code) DO NOTHING;
    `);

    // Обновляем существующий инвентарь, привязывая к артикулам
    await pool.query(`
      UPDATE warehouse_inventory
      SET article_id = (
        SELECT id FROM warehouse_articles
        WHERE article_code = CASE
          WHEN warehouse_inventory.name LIKE '%протез%руки%' THEN 'MSP-ARM-001'
          WHEN warehouse_inventory.name LIKE '%протез%ноги%' THEN 'MSP-LEG-001'
          WHEN warehouse_inventory.name LIKE '%C-Leg%' THEN 'OTT-CLEG-001'
          WHEN warehouse_inventory.name LIKE '%ортез%' THEN 'MSP-ORTH-001'
          ELSE 'MSP-ARM-001'
        END
        LIMIT 1
      ),
      warehouse_id = (SELECT warehouse_id FROM warehouse_zones WHERE id = warehouse_inventory.section_id LIMIT 1)
      WHERE article_id IS NULL;
    `);

    return NextResponse.json({
      success: true,
      message: 'Полная иерархия складов создана успешно',
      hierarchy: {
        regions: 'warehouse_regions',
        cities: 'warehouse_cities',
        warehouses: 'warehouse_warehouses',
        zones: 'warehouse_zones',
        sections: 'warehouse_sections',
        articles: 'warehouse_articles',
        inventory: 'warehouse_inventory'
      }
    });

  } catch (error) {
    console.error('Ошибка создания иерархии складов:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка создания иерархии складов: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}