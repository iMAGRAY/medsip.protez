import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

export async function POST(_request: NextRequest) {
  try {

    // SQL для создания всех таблиц
    const createTablesSQL = `
      -- 1. Таблица регионов складской системы
      CREATE TABLE IF NOT EXISTS warehouse_regions (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          code VARCHAR(50),
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Таблица городов в регионах
      CREATE TABLE IF NOT EXISTS warehouse_cities (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50),
          region_id INTEGER NOT NULL REFERENCES warehouse_regions(id) ON DELETE CASCADE,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(region_id, name)
      );

      -- 3. Таблица складов в городах
      CREATE TABLE IF NOT EXISTS warehouse_warehouses (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50),
          city_id INTEGER NOT NULL REFERENCES warehouse_cities(id) ON DELETE CASCADE,
          address TEXT,
          phone VARCHAR(50),
          email VARCHAR(255),
          manager_name VARCHAR(255),
          total_capacity INTEGER NOT NULL DEFAULT 1000,
          warehouse_type VARCHAR(50) DEFAULT 'standard',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(city_id, name)
      );

      -- 4. Создание индексов
      CREATE INDEX IF NOT EXISTS idx_warehouse_regions_active ON warehouse_regions(is_active);
      CREATE INDEX IF NOT EXISTS idx_warehouse_cities_region ON warehouse_cities(region_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_cities_active ON warehouse_cities(is_active);
      CREATE INDEX IF NOT EXISTS idx_warehouse_warehouses_city ON warehouse_warehouses(city_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_warehouses_active ON warehouse_warehouses(is_active);
    `;

    // Выполняем создание таблиц
    await executeQuery(createTablesSQL);

    // Создаем тестовые данные
    const testDataSQL = `
      INSERT INTO warehouse_regions (name, code, description)
      VALUES ('Центральный регион', 'CTR', 'Центральный регион России')
      ON CONFLICT (name) DO NOTHING;
    `;

    await executeQuery(testDataSQL);

    // Проверяем созданные таблицы
    const tablesResult = await executeQuery(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'warehouse_%'
      ORDER BY table_name
    `);

    return NextResponse.json({
      success: true,
      message: 'Складская система инициализирована успешно',
      tables: tablesResult.rows.map(row => row.table_name)
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка инициализации складской системы',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}