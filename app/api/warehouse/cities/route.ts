import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

// GET - получить все города с иерархией
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get('region_id');
    const _includeStats = searchParams.get('include_stats') === 'true';

    let query = `
      SELECT
        c.*,
        r.name as region_name,
        COUNT(DISTINCT w.id) as warehouses_count
      FROM warehouse_cities c
      LEFT JOIN warehouse_regions r ON c.region_id = r.id
      LEFT JOIN warehouse_warehouses w ON c.id = w.city_id AND w.is_active = true
      WHERE c.is_active = true
    `;

    const params = [];
    if (regionId) {
      query += ` AND c.region_id = $1`;
      params.push(regionId);
    }

    query += `
      GROUP BY c.id, c.name, c.code, c.region_id, c.description, c.is_active, c.created_at, c.updated_at, r.name
      ORDER BY r.name, c.name
    `;

    const result = await executeQuery(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения городов'
    }, { status: 500 });
  }
}

// POST - создать новый город
export async function POST(request: NextRequest) {
  try {
    const { name, code, region_id, description } = await request.json();

    if (!name || !region_id) {
      return NextResponse.json({
        success: false,
        error: 'Обязательные поля: name, region_id'
      }, { status: 400 });
    }

    const result = await executeQuery(`
      INSERT INTO warehouse_cities (name, code, region_id, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, code, region_id, description]);

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка создания города'
    }, { status: 500 });
  }
}

// PUT - обновить город
export async function PUT(request: NextRequest) {
  try {
    const { id, name, code, region_id, description, is_active } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID города обязателен'
      }, { status: 400 });
    }

    const result = await executeQuery(`
      UPDATE warehouse_cities
      SET name = $2, code = $3, region_id = $4, description = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, name, code, region_id, description, is_active]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Город не найден'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка обновления города'
    }, { status: 500 });
  }
}

// DELETE - удалить город
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID города обязателен'
      }, { status: 400 });
    }

    // Проверяем наличие складов в городе
    const checkResult = await executeQuery(`
      SELECT COUNT(*) as count FROM warehouse_warehouses
      WHERE city_id = $1 AND is_active = true
    `, [id]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'Нельзя удалить город с активными складами'
      }, { status: 400 });
    }

    const result = await executeQuery(`
      UPDATE warehouse_cities
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Город не найден'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка удаления города'
    }, { status: 500 });
  }
}