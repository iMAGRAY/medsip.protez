import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

// GET - получить все склады с иерархией
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get('city_id');
    const includeStats = searchParams.get('include_stats') === 'true';

    let query = `
      SELECT
        w.*,
        c.name as city_name,
        r.name as region_name
      FROM warehouse_warehouses w
      LEFT JOIN warehouse_cities c ON w.city_id = c.id
      LEFT JOIN warehouse_regions r ON c.region_id = r.id
      WHERE w.is_active = true
    `;

    const params = [];
    if (cityId) {
      query += ` AND w.city_id = $1`;
      params.push(cityId);
    }

    query += ` ORDER BY r.name, c.name, w.name`;

    const result = await executeQuery(query, params);

    // Если нужна статистика - добавляем количество зон и секций
    if (includeStats) {
      for (const warehouse of result.rows) {
        const statsQuery = `
          SELECT
            COUNT(DISTINCT z.id) as zones_count,
            COUNT(DISTINCT s.id) as sections_count,
            COUNT(DISTINCT i.id) as inventory_count
          FROM warehouse_warehouses w
          LEFT JOIN warehouse_zones z ON w.id = z.warehouse_id AND z.is_active = true
          LEFT JOIN warehouse_sections s ON z.id = s.zone_id AND s.is_active = true
          LEFT JOIN warehouse_inventory i ON s.id = i.section_id
          WHERE w.id = $1
        `;

        const statsResult = await executeQuery(statsQuery, [warehouse.id]);
        warehouse.stats = statsResult.rows[0];
      }
    }

    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Ошибка получения складов:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения складов'
    }, { status: 500 });
  }
}

// POST - создать новый склад
export async function POST(request: NextRequest) {
  try {
    const {
      name, code, city_id, address, phone, email, manager_name,
      total_capacity, warehouse_type
    } = await request.json();

    if (!name || !code || !city_id) {
      return NextResponse.json({
        success: false,
        error: 'Название, код и город обязательны'
      }, { status: 400 });
    }

    // Проверяем, что город существует
    const cityCheck = await executeQuery(`
      SELECT id FROM warehouse_cities WHERE id = $1 AND is_active = true
    `, [city_id]);

    if (cityCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Город не найден'
      }, { status: 404 });
    }

    const result = await executeQuery(`
      INSERT INTO warehouse_warehouses (
        name, code, city_id, address, phone, email, manager_name,
        total_capacity, warehouse_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      name, code, city_id, address, phone, email, manager_name,
      total_capacity || 1000, warehouse_type || 'standard'
    ]);

    // Автоматически создаем базовую зону для нового склада
    await executeQuery(`
      INSERT INTO warehouse_zones (
        name, code, warehouse_id, description, location, capacity,
        temperature_min, temperature_max, humidity_min, humidity_max
      )
      VALUES ($1, $2, $3, $4, 'main', $5, 18.0, 22.0, 40.0, 60.0)
    `, [
      `${name} - Основная зона`, 'MAIN', result.rows[0].id,
      'Основная зона склада', Math.floor((total_capacity || 1000) * 0.8)
    ]);

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания склада:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка создания склада'
    }, { status: 500 });
  }
}

// PUT - обновить склад
export async function PUT(request: NextRequest) {
  try {
    const {
      id, name, code, city_id, address, phone, email, manager_name,
      total_capacity, warehouse_type, is_active
    } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID склада обязателен'
      }, { status: 400 });
    }

    const result = await executeQuery(`
      UPDATE warehouse_warehouses
      SET name = $2, code = $3, city_id = $4, address = $5, phone = $6,
          email = $7, manager_name = $8, total_capacity = $9,
          warehouse_type = $10, is_active = $11, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      id, name, code, city_id, address, phone, email, manager_name,
      total_capacity, warehouse_type, is_active
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Склад не найден'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления склада:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка обновления склада'
    }, { status: 500 });
  }
}

// DELETE - удалить склад
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID склада обязателен'
      }, { status: 400 });
    }

    // Проверяем наличие зон и инвентаря
    const checkResult = await executeQuery(`
      SELECT
        COUNT(DISTINCT z.id) as zones_count,
        COUNT(DISTINCT i.id) as items_count
      FROM warehouse_warehouses w
      LEFT JOIN warehouse_zones z ON w.id = z.warehouse_id
      LEFT JOIN warehouse_sections s ON z.id = s.zone_id
      LEFT JOIN warehouse_inventory i ON s.id = i.section_id
      WHERE w.id = $1
    `, [id]);

    const { zones_count, items_count } = checkResult.rows[0];

    if (parseInt(items_count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'Невозможно удалить склад с инвентарем. Сначала перенесите или списайте все товары.'
      }, { status: 400 });
    }

    // Если есть зоны без товаров, деактивируем склад вместо удаления
    if (parseInt(zones_count) > 0) {
      await executeQuery(`
        UPDATE warehouse_warehouses SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [id]);

      return NextResponse.json({
        success: true,
        message: 'Склад деактивирован (содержит зоны)'
      });
    }

    // Полное удаление пустого склада
    await executeQuery(`DELETE FROM warehouse_warehouses WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      message: 'Склад удален'
    });
  } catch (error) {
    console.error('Ошибка удаления склада:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка удаления склада'
    }, { status: 500 });
  }
}