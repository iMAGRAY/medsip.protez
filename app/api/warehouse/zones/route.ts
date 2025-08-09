import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

// GET - получить все зоны
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id');
    const includeStats = searchParams.get('include_stats') === 'true';

    let query = `
      SELECT
        z.*,
        w.name as warehouse_name,
        c.name as city_name,
        r.name as region_name
      FROM warehouse_zones z
      LEFT JOIN warehouse_warehouses w ON z.warehouse_id = w.id
      LEFT JOIN warehouse_cities c ON w.city_id = c.id
      LEFT JOIN warehouse_regions r ON c.region_id = r.id
      WHERE z.is_active = true
    `;

    const params = [];
    if (warehouseId) {
      query += ` AND z.warehouse_id = $1`;
      params.push(warehouseId);
    }

    query += ` ORDER BY r.name, c.name, w.name, z.name`;

    const result = await executeQuery(query, params);

    // Если нужна статистика - добавляем количество секций и инвентаря
    if (includeStats) {
      for (const zone of result.rows) {
        const statsQuery = `
          SELECT
            COUNT(DISTINCT s.id) as sections_count,
            COUNT(DISTINCT i.id) as inventory_count,
            COALESCE(SUM(i.quantity), 0) as total_quantity
          FROM warehouse_zones z
          LEFT JOIN warehouse_sections s ON z.id = s.zone_id AND s.is_active = true
          LEFT JOIN warehouse_inventory i ON s.id = i.section_id
          WHERE z.id = $1
        `;

        const statsResult = await executeQuery(statsQuery, [zone.id]);
        zone.stats = statsResult.rows[0];
      }
    }

    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Ошибка получения зон:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения зон'
    }, { status: 500 });
  }
}

// POST - создать новую зону
export async function POST(request: NextRequest) {
  try {
    const {
      name, code, warehouse_id, description, location, capacity,
      temperature_min, temperature_max, humidity_min, humidity_max
    } = await request.json();

    if (!name || !code || !warehouse_id) {
      return NextResponse.json({
        success: false,
        error: 'Название, код и склад обязательны'
      }, { status: 400 });
    }

    // Проверяем, что склад существует
    const warehouseCheck = await executeQuery(`
      SELECT id FROM warehouse_warehouses WHERE id = $1 AND is_active = true
    `, [warehouse_id]);

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Склад не найден'
      }, { status: 404 });
    }

    const result = await executeQuery(`
      INSERT INTO warehouse_zones (
        name, code, warehouse_id, description, location, capacity,
        temperature_min, temperature_max, humidity_min, humidity_max, last_inspection
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      name, code, warehouse_id, description, location || 'main', capacity || 100,
      temperature_min || 18.0, temperature_max || 22.0, humidity_min || 40.0, humidity_max || 60.0
    ]);

    // Автоматически создаем несколько базовых секций для новой зоны
    const sections = [
      { name: `${name} - Секция А`, row: 1, shelf: 1 },
      { name: `${name} - Секция Б`, row: 1, shelf: 2 },
      { name: `${name} - Секция В`, row: 2, shelf: 1 },
      { name: `${name} - Секция Г`, row: 2, shelf: 2 }
    ];

    for (const section of sections) {
      await executeQuery(`
        INSERT INTO warehouse_sections (zone_id, name, description, capacity, row_number, shelf_number)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        result.rows[0].id, section.name, `Автоматически созданная секция`,
        Math.floor((capacity || 100) / 4), section.row, section.shelf
      ]);
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания зоны:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка создания зоны'
    }, { status: 500 });
  }
}

// PUT - обновить зону
export async function PUT(request: NextRequest) {
  try {
    const {
      id, name, code, description, location, capacity,
      temperature_min, temperature_max, humidity_min, humidity_max, is_active
    } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID зоны обязателен'
      }, { status: 400 });
    }

    const result = await executeQuery(`
      UPDATE warehouse_zones
      SET name = $2, code = $3, description = $4, location = $5, capacity = $6,
          temperature_min = $7, temperature_max = $8, humidity_min = $9,
          humidity_max = $10, is_active = $11, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      id, name, code, description, location, capacity,
      temperature_min, temperature_max, humidity_min, humidity_max, is_active
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Зона не найдена'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления зоны:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка обновления зоны'
    }, { status: 500 });
  }
}

// DELETE - удалить зону
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID зоны обязателен'
      }, { status: 400 });
    }

    // Проверяем наличие секций и инвентаря
    const checkResult = await executeQuery(`
      SELECT
        COUNT(DISTINCT s.id) as sections_count,
        COUNT(DISTINCT i.id) as items_count
      FROM warehouse_zones z
      LEFT JOIN warehouse_sections s ON z.id = s.zone_id
      LEFT JOIN warehouse_inventory i ON s.id = i.section_id
      WHERE z.id = $1
    `, [id]);

    const { sections_count, items_count } = checkResult.rows[0];

    if (parseInt(items_count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'Невозможно удалить зону с инвентарем. Сначала перенесите или списайте все товары.'
      }, { status: 400 });
    }

    // Если есть секции без товаров, деактивируем зону вместо удаления
    if (parseInt(sections_count) > 0) {
      await executeQuery(`
        UPDATE warehouse_zones SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [id]);

      return NextResponse.json({
        success: true,
        message: 'Зона деактивирована (содержит секции)'
      });
    }

    // Полное удаление пустой зоны
    await executeQuery(`DELETE FROM warehouse_zones WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      message: 'Зона удалена'
    });
  } catch (error) {
    console.error('Ошибка удаления зоны:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка удаления зоны'
    }, { status: 500 });
  }
}