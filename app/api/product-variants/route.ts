import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/product-variants - получить все варианты товаров
// GET /api/product-variants?master_id=X - получить варианты конкретного товара
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const masterId = searchParams.get('master_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        pv.*,
        p.name as product_name,
        p.description as product_description,
        pc.name as category_name,
        m.name as manufacturer_name,
        ms.name as series_name
      FROM product_variants pv
      JOIN products p ON pv.master_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      LEFT JOIN model_series ms ON p.series_id = ms.id
      WHERE pv.is_deleted = FALSE
    `;

    const queryParams: any[] = [];

    if (masterId) {
      query += ` AND pv.master_id = $${queryParams.length + 1}`;
      queryParams.push(masterId);
    }

    query += ` ORDER BY pv.id DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Получаем общее количество для пагинации
    let countQuery = `
      SELECT COUNT(*) as total
      FROM product_variants pv
      WHERE pv.is_deleted = FALSE
    `;
    const countParams: any[] = [];

    if (masterId) {
      countQuery += ` AND pv.master_id = $1`;
      countParams.push(masterId);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      variants: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения вариантов товаров' },
      { status: 500 }
    );
  }
}

// POST /api/product-variants - создать новый вариант товара
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { master_id, sku, price_override, stock_override, attributes_json } = body;

    if (!master_id) {
      return NextResponse.json(
        { error: 'Не указан master_id товара' },
        { status: 400 }
      );
    }

    // Проверяем, что master товар существует
    const masterCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND is_deleted = FALSE',
      [master_id]
    );

    if (masterCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Мастер-товар не найден' },
        { status: 404 }
      );
    }

    // Создаем новый вариант
    const result = await pool.query(`
      INSERT INTO product_variants (
        master_id, sku, price_override, stock_override, attributes_json
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [master_id, sku, price_override, stock_override, attributes_json || {}]);

    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка создания варианта товара' },
      { status: 500 }
    );
  }
}