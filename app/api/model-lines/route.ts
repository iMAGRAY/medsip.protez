import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, testConnection } from '@/lib/db-connection'

export async function GET(request: NextRequest) {

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in model lines GET")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    // Проверяем существование таблицы model_series
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'model_series'
      )
    `

    const tableExists = await executeQuery(tableCheckQuery)

    if (!tableExists.rows[0].exists) {

      // Создаем таблицу если она не существует
      await executeQuery(`
        CREATE TABLE model_series (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          manufacturer_id INTEGER NOT NULL,
          category_id INTEGER,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
    }

    const { searchParams } = new URL(request.url);
    const manufacturerId = searchParams.get('manufacturer_id');
    const includeProducts = searchParams.get('include_products') === 'true';

    let query = `
      SELECT
        ms.id,
        ms.name,
        ms.description,
        ms.manufacturer_id,
        ms.category_id,
        ms.is_active,
        ms.created_at,
        ms.updated_at,
        m.name as manufacturer_name
      FROM model_series ms
      LEFT JOIN manufacturers m ON ms.manufacturer_id = m.id
    `;

    // Проверяем существование таблицы product_categories
    const categoriesTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'product_categories'
      )
    `

    const categoriesTableExists = await executeQuery(categoriesTableQuery)

    // Добавляем JOIN с категориями только если таблица существует
    if (categoriesTableExists.rows[0].exists) {
      query = `
        SELECT
          ms.id,
          ms.name,
          ms.description,
          ms.manufacturer_id,
          ms.category_id,
          ms.is_active,
          ms.created_at,
          ms.updated_at,
          m.name as manufacturer_name,
          c.name as category_name
        FROM model_series ms
        LEFT JOIN manufacturers m ON ms.manufacturer_id = m.id
        LEFT JOIN product_categories c ON ms.category_id = c.id
      `;
    }

    const params = [];
    if (manufacturerId) {
      query += ' WHERE ms.manufacturer_id = $1';
      params.push(manufacturerId);
    }

    query += ' ORDER BY ms.name';

    const result = await executeQuery(query, params);
    const modelLines = result.rows;

    // Если нужны продукты, загружаем их
    if (includeProducts && modelLines.length > 0) {
      // Проверяем существование таблицы products
      const productsTableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'products'
        )
      `

      const productsTableExists = await executeQuery(productsTableQuery)

      if (productsTableExists.rows[0].exists) {
        const modelLineIds = modelLines.map(ml => ml.id);

        const productsQuery = `
          SELECT
            p.id,
            p.name,
            p.series_id as model_line_id,
            p.is_active,
            p.created_at
          FROM products p
          WHERE p.series_id = ANY($1)
          ORDER BY p.name
        `;

        const productsResult = await executeQuery(productsQuery, [modelLineIds]);

        // Группируем продукты по model_line_id
        const productsByModelLine = new Map();
        productsResult.rows.forEach(product => {
          if (!productsByModelLine.has(product.model_line_id)) {
            productsByModelLine.set(product.model_line_id, []);
          }
          productsByModelLine.get(product.model_line_id).push(product);
        });

        // Добавляем продукты к линейкам моделей
        modelLines.forEach(modelLine => {
          modelLine.products = productsByModelLine.get(modelLine.id) || [];
          modelLine.products_count = modelLine.products.length;
        });
      } else {
        // Если таблица продуктов не существует, добавляем пустые массивы
        modelLines.forEach(modelLine => {
          modelLine.products = [];
          modelLine.products_count = 0;
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: modelLines
    });

  } catch (error) {
    console.error('❌ Model Lines API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to fetch model lines', success: false, details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in model lines POST")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    // Проверяем существование таблицы model_series
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'model_series'
      )
    `

    const tableExists = await executeQuery(tableCheckQuery)

    if (!tableExists.rows[0].exists) {

      // Создаем таблицу если она не существует
      await executeQuery(`
        CREATE TABLE model_series (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          manufacturer_id INTEGER NOT NULL,
          category_id INTEGER,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
    }

    const data = await request.json();

    // Валидация данных
    if (!data.name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required', success: false },
        { status: 400 }
      );
    }

    if (!data.manufacturer_id) {
      return NextResponse.json(
        { error: 'Manufacturer ID is required', success: false },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO model_series (
        name, description, manufacturer_id, category_id, is_active
      ) VALUES (
        $1, $2, $3, $4, $5
      ) RETURNING *
    `;

    const values = [
      data.name.trim(),
      data.description?.trim() || null,
      data.manufacturer_id,
      data.category_id || null,
      data.is_active ?? true
    ];

    const result = await executeQuery(query, values);
    const modelLine = result.rows[0];

    return NextResponse.json({
      success: true,
      data: modelLine
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Model Lines API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Обработка дубликатов
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: 'Model line with this name already exists', success: false },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create model line', success: false, details: error.message },
      { status: 500 }
    );
  }
}