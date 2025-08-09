import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, testConnection } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in manufacturers GET")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('include_stats') === 'true';

    // Проверяем существование таблицы manufacturers
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'manufacturers'
      )
    `

    const tableExists = await executeQuery(tableCheckQuery)

    if (!tableExists.rows[0].exists) {

      // Создаем таблицу если она не существует
      await executeQuery(`
        CREATE TABLE manufacturers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          website_url VARCHAR(500),
          country VARCHAR(100),
          founded_year INTEGER,
          logo_url VARCHAR(500),
          is_active BOOLEAN DEFAULT true,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
    }

    let query = `
      SELECT
        m.id,
        m.name,
        m.description,
        m.website_url,
        m.country,
        m.founded_year,
        m.logo_url,
        m.is_active,
        m.sort_order,
        m.created_at,
        m.updated_at,
        COUNT(ms.id)::text as model_lines_count
      FROM manufacturers m
      LEFT JOIN model_series ms ON m.id = ms.manufacturer_id
      GROUP BY m.id
      ORDER BY m.name
    `;

    const result = await executeQuery(query);
    const manufacturers = result.rows;

    return NextResponse.json({
      success: true,
      data: manufacturers
    });

  } catch (error) {
    console.error('❌ Manufacturers API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to fetch manufacturers', details: error.message, success: false },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in manufacturers POST")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    // Получаем данные из запроса
    const data = await request.json()

    // Валидация
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required', success: false },
        { status: 400 }
      )
    }

    // Проверяем существование таблицы manufacturers
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'manufacturers'
      )
    `

    const tableExists = await executeQuery(tableCheckQuery)

    if (!tableExists.rows[0].exists) {

      // Создаем таблицу если она не существует
      await executeQuery(`
        CREATE TABLE manufacturers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          website_url VARCHAR(500),
          country VARCHAR(100),
          founded_year INTEGER,
          logo_url VARCHAR(500),
          is_active BOOLEAN DEFAULT true,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
    }

    // Проверяем, существует ли производитель с таким именем
    const checkQuery = `SELECT id FROM manufacturers WHERE name = $1`
    const checkResult = await executeQuery(checkQuery, [data.name.trim()])

    if (checkResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Manufacturer with this name already exists', success: false },
        { status: 409 }
      )
    }

    // Создаем нового производителя
    const query = `
      INSERT INTO manufacturers (
        name,
        description,
        website_url,
        country,
        founded_year,
        logo_url,
        is_active,
        sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `

    const values = [
      data.name.trim(),
      data.description || null,
      data.website_url || null,
      data.country || null,
      data.founded_year || null,
      data.logo_url || null,
      data.is_active !== undefined ? data.is_active : true,
      data.sort_order || 0
    ]

    const result = await executeQuery(query, values)
    const manufacturer = result.rows[0]

    return NextResponse.json({
      success: true,
      data: manufacturer
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Manufacturers API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Проверяем, является ли ошибка нарушением уникальности
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: 'Manufacturer with this name already exists', success: false },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create manufacturer', details: error.message, success: false },
      { status: 500 }
    );
  }
}