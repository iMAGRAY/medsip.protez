import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export async function POST() {
  try {

    // Создаем таблицу если не существует
    await pool.query(`
      CREATE TABLE IF NOT EXISTS form_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        characteristics JSONB NOT NULL DEFAULT '[]',
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Создаем тестовые характеристики
    const testCharacteristics = [
      {
        id: 'test_char_1',
        group_id: 1,
        group_name: 'Основные характеристики',
        characteristic_type: 'text',
        label: 'Материал',
        value_text: 'Титан',
        is_primary: true,
        is_required: true,
        sort_order: 1
      },
      {
        id: 'test_char_2',
        group_id: 1,
        group_name: 'Основные характеристики',
        characteristic_type: 'numeric',
        label: 'Вес (г)',
        value_numeric: 250,
        is_primary: false,
        is_required: false,
        sort_order: 2
      },
      {
        id: 'test_char_3',
        group_id: 2,
        group_name: 'Размеры',
        characteristic_type: 'select',
        label: 'Размер',
        selected_enum_id: 1,
        selected_enum_value: 'M',
        is_primary: true,
        is_required: true,
        sort_order: 3
      }
    ]

    // Добавляем тестовый шаблон
    const result = await pool.query(`
      INSERT INTO form_templates (name, description, characteristics, is_favorite)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, characteristics, created_at, is_favorite
    `, [
      'Тестовый шаблон протеза',
      'Пример шаблона с основными характеристиками протеза',
      JSON.stringify(testCharacteristics),
      false
    ])

    return NextResponse.json({
      success: true,
      template: result.rows[0],
      message: 'Test template created successfully'
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {

    // Проверяем существование таблицы
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'form_templates'
      )
    `)

    const tableExists = tableCheck.rows[0].exists

    if (!tableExists) {
      return NextResponse.json({
        success: false,
        message: 'Table form_templates does not exist'
      })
    }

    // Получаем все шаблоны
    const templates = await pool.query(`
      SELECT id, name, description, characteristics, created_at, is_favorite
      FROM form_templates
      ORDER BY created_at DESC
    `)

    return NextResponse.json({
      success: true,
      tableExists,
      templates: templates.rows,
      count: templates.rows.length
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}