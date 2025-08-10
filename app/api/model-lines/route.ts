import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, testConnection } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'

function isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

export async function GET(request: NextRequest) {

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const isConnected = await testConnection()
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'model_series'
      )
    `

    const tableExists = await executeQuery(tableCheckQuery)

    if (!tableExists.rows[0].exists) {
      return NextResponse.json({ success: false, error: 'Model series schema is not initialized' }, { status: 503 })
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
        true as is_active,
        ms.created_at,
        ms.updated_at,
        m.name as manufacturer_name
      FROM model_series ms
      LEFT JOIN manufacturers m ON ms.manufacturer_id = m.id
    `;

    const categoriesTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'product_categories'
      )
    `

    const categoriesTableExists = await executeQuery(categoriesTableQuery)

    if (categoriesTableExists.rows[0].exists) {
      query = `
        SELECT
          ms.id,
          ms.name,
          ms.description,
          ms.manufacturer_id,
          ms.category_id,
          true as is_active,
          ms.created_at,
          ms.updated_at,
          m.name as manufacturer_name,
          c.name as category_name
        FROM model_series ms
        LEFT JOIN manufacturers m ON ms.manufacturer_id = m.id
        LEFT JOIN product_categories c ON ms.category_id = c.id
      `;
    }

    const params = [] as any[]
    if (manufacturerId) {
      query += ' WHERE ms.manufacturer_id = $1';
      params.push(manufacturerId);
    }

    query += ' ORDER BY ms.name';

    const result = await executeQuery(query, params);
    const modelLines = result.rows as any[];

    if (includeProducts && modelLines.length > 0) {
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
            (p.is_deleted = false OR p.is_deleted IS NULL) as is_active,
            p.created_at
          FROM products p
          WHERE p.series_id = ANY($1)
          ORDER BY p.name
        `;

        const productsResult = await executeQuery(productsQuery, [modelLineIds]);

        const productsByModelLine = new Map<number, any[]>();
        productsResult.rows.forEach((product: any) => {
          if (!productsByModelLine.has(product.model_line_id)) {
            productsByModelLine.set(product.model_line_id, []);
          }
          productsByModelLine.get(product.model_line_id)!.push(product);
        });

        modelLines.forEach(modelLine => {
          modelLine.products = productsByModelLine.get(modelLine.id) || [];
          modelLine.products_count = modelLine.products.length;
        });
      } else {
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
    return NextResponse.json(
      { error: 'Failed to fetch model lines', success: false, details: (error as any).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const isConnected = await testConnection()
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Database connection failed', success: false },
        { status: 503 }
      )
    }

    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'model_series'
      )
    `

    const tableExists = await executeQuery(tableCheckQuery)

    if (!tableExists.rows[0].exists) {
      return NextResponse.json({ success: false, error: 'Model series schema is not initialized' }, { status: 503 })
    }

    const data = await request.json();

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
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: 'Model line with this name already exists', success: false },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create model line', success: false, details: (error as any).message },
      { status: 500 }
    );
  }
}