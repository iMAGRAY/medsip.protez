const { Pool } = require('pg');
const fs = require('fs');

// Подключение к удаленной базе из .env.local
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'medsip_protez'}`,
  ssl: false
});

async function setupRemoteDatabase() {
  try {
    // Проверяем подключение
    await pool.query('SELECT 1');
    // Проверяем существующие таблицы
    const tablesResult = await pool.query(`
      SELECT tablename FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('📋 Существующие таблицы:', tablesResult.rows.map(r => r.tablename));

    // Создаем таблицу manufacturers если её нет
    const manufacturersExists = tablesResult.rows.some(r => r.tablename === 'manufacturers');

    if (!manufacturersExists) {
      const createManufacturersSQL = `
        CREATE TABLE manufacturers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          logo_url TEXT,
          website_url TEXT,
          country VARCHAR(100),
          founded_year INTEGER,
          is_active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_manufacturers_name ON manufacturers(name);
        CREATE INDEX idx_manufacturers_country ON manufacturers(country);
        CREATE INDEX idx_manufacturers_active ON manufacturers(is_active);
      `;

      await pool.query(createManufacturersSQL);
      // Добавляем производителей
      const insertManufacturersSQL = `
        INSERT INTO manufacturers (name, description, country, founded_year, is_active, sort_order) VALUES
        ('МедСИП', 'Российский производитель инновационных протезов и ортопедических изделий', 'Россия', 2015, true, 1),
        ('OttoBock', 'Немецкая компания, мировой лидер в области протезирования', 'Германия', 1919, true, 2),
        ('Össur', 'Исландская компания, специализирующаяся на протезах и ортопедических решениях', 'Исландия', 1971, true, 3),
        ('Blatchford', 'Британская компания с более чем столетним опытом в протезировании', 'Великобритания', 1890, true, 4)
      `;

      await pool.query(insertManufacturersSQL);
    } else {
    }

    // Проверяем есть ли колонка manufacturer_id в model_lines
    const modelLinesColumns = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'model_lines' AND table_schema = 'public'
    `);

    const hasManufacturerId = modelLinesColumns.rows.some(r => r.column_name === 'manufacturer_id');

    if (!hasManufacturerId) {
      await pool.query(`
        ALTER TABLE model_lines
        ADD COLUMN manufacturer_id INTEGER,
        ADD CONSTRAINT fk_model_lines_manufacturer
        FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
      `);
      // Привязываем существующие модельные ряды к МедСИП (id=1)
      await pool.query(`
        UPDATE model_lines
        SET manufacturer_id = 1
        WHERE manufacturer_id IS NULL
      `);
    } else {
    }

    // Проверяем результат
    const manufacturersCount = await pool.query('SELECT COUNT(*) FROM manufacturers');
    const modelLinesCount = await pool.query('SELECT COUNT(*) FROM model_lines WHERE manufacturer_id IS NOT NULL');
  } catch (error) {
    console.error('❌ Ошибка настройки:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

setupRemoteDatabase();