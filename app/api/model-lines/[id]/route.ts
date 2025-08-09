import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, testConnection } from '@/lib/db-connection'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in model line GET")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const modelLineId = params.id;

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
      return NextResponse.json(
        { error: 'Model series table does not exist', success: false },
        { status: 404 }
      )
    }

    const query = `
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
      WHERE ms.id = $1
    `;

    const result = await executeQuery(query, [modelLineId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Model line not found', success: false },
        { status: 404 }
      );
    }

    const modelLine = result.rows[0];

    // Проверяем существование таблицы products
    const productsTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'products'
      )
    `

    const productsTableExists = await executeQuery(productsTableQuery)

    // Загружаем продукты только если таблица существует
    if (productsTableExists.rows[0].exists) {
      const productsQuery = `
        SELECT
          p.id,
          p.name,
          p.description,
          p.is_active,
          p.created_at
        FROM products p
        WHERE p.series_id = $1
        ORDER BY p.name
      `;

      const productsResult = await executeQuery(productsQuery, [modelLineId]);
      modelLine.products = productsResult.rows;
      modelLine.products_count = productsResult.rows.length;
    } else {
      modelLine.products = [];
      modelLine.products_count = 0;
    }

    return NextResponse.json({
      success: true,
      data: modelLine
    });

  } catch (error) {
    console.error('❌ Model Line API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to fetch model line', success: false, details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in model line PUT")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const modelLineId = params.id;
    const data = await request.json();

    // Валидация обязательных полей
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
      return NextResponse.json(
        { error: 'Model series table does not exist', success: false },
        { status: 404 }
      )
    }

    const query = `
      UPDATE model_series SET
        name = $1,
        description = $2,
        manufacturer_id = $3,
        category_id = $4,
        is_active = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;

    const values = [
      data.name.trim(),
      data.description?.trim() || null,
      data.manufacturer_id,
      data.category_id || null,
      data.is_active ?? true,
      modelLineId
    ];

    const result = await executeQuery(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Model line not found', success: false },
        { status: 404 }
      );
    }

    const modelLine = result.rows[0];

    return NextResponse.json({
      success: true,
      data: modelLine
    });

  } catch (error) {
    console.error('❌ Model Line API Error:', error);
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
      { error: 'Failed to update model line', success: false, details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in model line DELETE")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const modelLineId = params.id;

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
      return NextResponse.json(
        { error: 'Model series table does not exist', success: false },
        { status: 404 }
      )
    }

    // Проверяем существование таблицы products
    const productsTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'products'
      )
    `

    const productsTableExists = await executeQuery(productsTableQuery)

    // Проверяем связанные продукты только если таблица существует
    if (productsTableExists.rows[0].exists) {
      const productsCheckQuery = 'SELECT COUNT(*) as count FROM products WHERE series_id = $1';
      const productsCheckResult = await executeQuery(productsCheckQuery, [modelLineId]);
      const productsCount = parseInt(productsCheckResult.rows[0].count);

      if (productsCount > 0) {
        return NextResponse.json(
          { error: `Cannot delete model line with ${productsCount} products. Delete products first.`, success: false },
          { status: 400 }
        );
      }
    }

    // Проверяем, существует ли модельная линия
    const checkQuery = 'SELECT id FROM model_series WHERE id = $1';
    const checkResult = await executeQuery(checkQuery, [modelLineId]);

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Model line not found', success: false },
        { status: 404 }
      );
    }

    // Удаляем модельную линию
    const deleteQuery = 'DELETE FROM model_series WHERE id = $1 RETURNING id';
    const result = await executeQuery(deleteQuery, [modelLineId]);

    return NextResponse.json({
      message: 'Model line deleted successfully',
      success: true
    });

  } catch (error) {
    console.error('❌ Model Line API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to delete model line', success: false, details: error.message },
      { status: 500 }
    );
  }
}