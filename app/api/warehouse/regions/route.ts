import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

// GET - получить все регионы с иерархией
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _includeStats = searchParams.get('include_stats') === 'true';

    const query = `
      SELECT
        r.*,
        COUNT(DISTINCT c.id) as cities_count,
        COUNT(DISTINCT w.id) as warehouses_count
      FROM warehouse_regions r
      LEFT JOIN warehouse_cities c ON r.id = c.region_id AND c.is_active = true
      LEFT JOIN warehouse_warehouses w ON c.id = w.city_id AND w.is_active = true
      WHERE r.is_active = true
      GROUP BY r.id, r.name, r.code, r.description, r.is_active, r.created_at, r.updated_at
      ORDER BY r.name
    `;

    const result = await executeQuery(query, []);

    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Ошибка получения регионов:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения регионов'
    }, { status: 500 });
  }
}

// POST - создать новый регион
export async function POST(request: NextRequest) {
  try {
    const { name, code, description } = await request.json();

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Обязательное поле: name'
      }, { status: 400 });
    }

    const result = await executeQuery(`
      INSERT INTO warehouse_regions (name, code, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, code, description]);

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания региона:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка создания региона'
    }, { status: 500 });
  }
}

// PUT - обновить регион
export async function PUT(request: NextRequest) {
  try {
    const { id, name, code, description, is_active } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID региона обязателен'
      }, { status: 400 });
    }

    const result = await executeQuery(`
      UPDATE warehouse_regions
      SET name = $2, code = $3, description = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, name, code, description, is_active]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Регион не найден'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления региона:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка обновления региона'
    }, { status: 500 });
  }
}

// DELETE - удалить регион
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID региона обязателен'
      }, { status: 400 });
    }

    // Проверяем наличие городов в регионе
    const checkResult = await executeQuery(`
      SELECT COUNT(*) as count FROM warehouse_cities
      WHERE region_id = $1 AND is_active = true
    `, [id]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'Нельзя удалить регион с активными городами'
      }, { status: 400 });
    }

    const result = await executeQuery(`
      UPDATE warehouse_regions
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Регион не найден'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка удаления региона:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка удаления региона'
    }, { status: 500 });
  }
}