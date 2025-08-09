import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function POST(request: NextRequest) {
  try {

    // Проверяем, существует ли уже таблица
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'form_templates'
      );
    `;

    const checkResult = await pool.query(checkTableQuery);

    if (checkResult.rows[0].exists) {
      return NextResponse.json({
        success: true,
        message: 'Таблица form_templates уже существует',
        data: { exists: true }
      });
    }

    // Создаем таблицу
    const createTableQuery = `
      CREATE TABLE form_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        characteristics JSONB NOT NULL DEFAULT '[]',
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableQuery);

    // Создаем индексы для оптимизации
    const createIndexQueries = [
      'CREATE INDEX idx_form_templates_name ON form_templates(name);',
      'CREATE INDEX idx_form_templates_created_at ON form_templates(created_at);',
      'CREATE INDEX idx_form_templates_is_favorite ON form_templates(is_favorite);'
    ];

    for (const query of createIndexQueries) {
      await pool.query(query);
    }

    // Создаем тестовые данные
    const insertTestData = `
      INSERT INTO form_templates (name, description, characteristics, is_favorite) VALUES
      ('Базовый шаблон', 'Основные характеристики для протеза',
       '[{"id":1,"group_id":1,"characteristic_type":"text","label":"Материал","value_text":"Титан"}]', false),
      ('Расширенный шаблон', 'Подробные характеристики',
       '[{"id":2,"group_id":1,"characteristic_type":"numeric","label":"Вес","value_numeric":150,"unit_id":1}]', true);
    `;

    await pool.query(insertTestData);

    return NextResponse.json({
      success: true,
      message: 'Таблица form_templates успешно создана!',
      data: {
        created: true,
        hasIndexes: true,
        hasTestData: true
      }
    });

  } catch (error) {
    console.error('❌ Ошибка при создании таблицы:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка при создании таблицы',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем состояние таблицы
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'form_templates'
      );
    `;

    const checkResult = await pool.query(checkTableQuery);
    const exists = checkResult.rows[0].exists;

    if (!exists) {
      return NextResponse.json({
        success: false,
        message: 'Таблица form_templates не существует',
        data: { exists: false }
      });
    }

    // Получаем информацию о структуре таблицы
    const structureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'form_templates'
      ORDER BY ordinal_position;
    `;

    const structureResult = await pool.query(structureQuery);

    // Получаем количество записей
    const countQuery = 'SELECT COUNT(*) FROM form_templates';
    const countResult = await pool.query(countQuery);

    return NextResponse.json({
      success: true,
      message: 'Таблица form_templates существует',
      data: {
        exists: true,
        structure: structureResult.rows,
        count: parseInt(countResult.rows[0].count)
      }
    });

  } catch (error) {
    console.error('❌ Ошибка при проверке таблицы:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка при проверке таблицы',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}