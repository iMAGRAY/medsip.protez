import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/suppliers - получить всех поставщиков
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        s.*,
        COUNT(ps.variant_id) as products_count
      FROM suppliers s
      LEFT JOIN product_suppliers ps ON s.id = ps.supplier_id
      WHERE s.is_deleted = FALSE
    `;

    const queryParams: any[] = [];

    if (search) {
      query += ` AND s.name ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${search}%`);
    }

    query += `
      GROUP BY s.id
      ORDER BY s.name
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Получаем общее количество для пагинации
    let countQuery = `
      SELECT COUNT(*) as total
      FROM suppliers
      WHERE is_deleted = FALSE
    `;
    const countParams: any[] = [];

    if (search) {
      countQuery += ` AND name ILIKE $1`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      suppliers: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка получения поставщиков' },
      { status: 500 }
    );
  }
}

// POST /api/suppliers - создать нового поставщика
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, contact_info } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Название поставщика обязательно' },
        { status: 400 }
      );
    }

    // Проверяем на дублирование названия
    const existing = await pool.query(
      'SELECT id FROM suppliers WHERE name = $1 AND is_deleted = FALSE',
      [name.trim()]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Поставщик с таким названием уже существует' },
        { status: 409 }
      );
    }

    // Создаем нового поставщика
    const result = await pool.query(`
      INSERT INTO suppliers (name, contact_info)
      VALUES ($1, $2)
      RETURNING *
    `, [name.trim(), contact_info || {}]);

    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (error) {
    return NextResponse.json(
      { error: 'Ошибка создания поставщика' },
      { status: 500 }
    );
  }
}