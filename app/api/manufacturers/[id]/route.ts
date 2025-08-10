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
      console.error("Database connection failed in manufacturer GET")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const manufacturerId = params.id;

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
      return NextResponse.json(
        { error: 'Manufacturers table does not exist', success: false },
        { status: 404 }
      )
    }

    const query = `
      SELECT 
        m.id, m.name, m.description, m.website_url, m.country, m.founded_year, m.logo_url, m.is_active, m.sort_order,
        m.created_at, m.updated_at,
        COUNT(DISTINCT ms.id) as model_lines_count,
        COUNT(DISTINCT p.id) as products_count,
        COUNT(DISTINCT CASE WHEN (p.is_deleted = false OR p.is_deleted IS NULL) THEN p.id END) as active_products_count
      FROM manufacturers m
      LEFT JOIN model_series ms ON m.id = ms.manufacturer_id
      LEFT JOIN products p ON p.manufacturer_id = m.id
      WHERE m.id = $1
      GROUP BY m.id
    `

    const result = await executeQuery(query, [manufacturerId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Manufacturer not found', success: false },
        { status: 404 }
      );
    }

    const manufacturer = result.rows[0];

    // Проверяем существование таблицы model_series
    const modelSeriesTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'model_series'
      )
    `

    const modelSeriesTableExists = await executeQuery(modelSeriesTableQuery)

    // Загружаем статистику производителя только если таблица model_series существует
    if (modelSeriesTableExists.rows[0].exists) {
      const statsQuery = `
        SELECT
          COUNT(DISTINCT ms.id) as model_lines_count,
          COUNT(DISTINCT p.id) as products_count,
          COUNT(DISTINCT CASE WHEN p.is_active = true THEN p.id END) as active_products_count
        FROM manufacturers m
        LEFT JOIN model_series ms ON m.id = ms.manufacturer_id
        LEFT JOIN products p ON ms.id = p.series_id
        WHERE m.id = $1
      `;

      const statsResult = await executeQuery(statsQuery, [manufacturerId]);
      const stats = statsResult.rows[0];

      manufacturer.stats = {
        modelLinesCount: parseInt(stats.model_lines_count) || 0,
        productsCount: parseInt(stats.products_count) || 0,
        activeProductsCount: parseInt(stats.active_products_count) || 0
      };
    } else {
      manufacturer.stats = {
        modelLinesCount: 0,
        productsCount: 0,
        activeProductsCount: 0
      };
    }

    return NextResponse.json({
      success: true,
      data: manufacturer
    });

  } catch (error) {
    console.error('❌ Manufacturer API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to fetch manufacturer', success: false, details: error.message },
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
      console.error("Database connection failed in manufacturer PUT")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const manufacturerId = params.id;
    const data = await request.json();

    // Валидация обязательных полей
    if (!data.name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required', success: false },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Manufacturers table does not exist', success: false },
        { status: 404 }
      )
    }

    const query = `
      UPDATE manufacturers SET
        name = $1,
        description = $2,
        country = $3,
        website_url = $4,
        founded_year = $5,
        logo_url = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const values = [
      data.name.trim(),
      data.description?.trim() || null,
      data.country?.trim() || null,
      data.website_url?.trim() || null,
      data.founded_year || null,
      data.logo_url?.trim() || null,
      manufacturerId
    ];

    const result = await executeQuery(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Manufacturer not found', success: false },
        { status: 404 }
      );
    }

    const manufacturer = result.rows[0];

    return NextResponse.json({
      success: true,
      data: manufacturer
    });

  } catch (error) {
    console.error('❌ Manufacturer API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Обработка дубликатов
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: 'Manufacturer with this name already exists', success: false },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update manufacturer', success: false, details: error.message },
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
      console.error("Database connection failed in manufacturer DELETE")
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const manufacturerId = params.id;

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
      return NextResponse.json(
        { error: 'Manufacturers table does not exist', success: false },
        { status: 404 }
      )
    }

    // Проверяем существование таблицы model_series
    const modelSeriesTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'model_series'
      )
    `

    const modelSeriesTableExists = await executeQuery(modelSeriesTableQuery)

    // Проверяем связанные модельные ряды только если таблица существует
    if (modelSeriesTableExists.rows[0].exists) {
      const modelLinesCheckQuery = 'SELECT COUNT(*) as count FROM model_series WHERE manufacturer_id = $1';
      const modelLinesCheckResult = await executeQuery(modelLinesCheckQuery, [manufacturerId]);
      const modelLinesCount = parseInt(modelLinesCheckResult.rows[0].count);

      if (modelLinesCount > 0) {
        return NextResponse.json(
          { error: `Cannot delete manufacturer with ${modelLinesCount} model lines. Delete model lines first.`, success: false },
          { status: 400 }
        );
      }
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
      const productsCheckQuery = 'SELECT COUNT(*) as count FROM products WHERE manufacturer_id = $1';
      const productsCheckResult = await executeQuery(productsCheckQuery, [manufacturerId]);
      const productsCount = parseInt(productsCheckResult.rows[0].count);

      if (productsCount > 0) {
        return NextResponse.json(
          { error: `Cannot delete manufacturer with ${productsCount} products. Delete products first.`, success: false },
          { status: 400 }
        );
      }
    }

    // Проверяем, существует ли производитель
    const checkQuery = 'SELECT id FROM manufacturers WHERE id = $1';
    const checkResult = await executeQuery(checkQuery, [manufacturerId]);

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Manufacturer not found', success: false },
        { status: 404 }
      );
    }

    // Удаляем производителя
    const deleteQuery = 'DELETE FROM manufacturers WHERE id = $1 RETURNING id';
    const result = await executeQuery(deleteQuery, [manufacturerId]);

    return NextResponse.json({
      message: 'Manufacturer deleted successfully',
      success: true
    });

  } catch (error) {
    console.error('❌ Manufacturer API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to delete manufacturer', success: false, details: error.message },
      { status: 500 }
    );
  }
}