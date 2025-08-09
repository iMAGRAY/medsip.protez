import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

// PUT - обновить вместимость зон склада
export async function PUT(request: NextRequest) {
  try {
    const { zones } = await request.json();

    if (!zones || !Array.isArray(zones)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный формат данных зон'
      }, { status: 400 });
    }

    // Обновляем вместимость каждой зоны
    for (const zone of zones) {
      if (!zone.name || typeof zone.capacity !== 'number') {
        console.warn('⚠️ Пропускаем зону с неверными данными:', zone);
        continue;
      }

      // Находим зону по имени и обновляем её вместимость
      const updateResult = await executeQuery(`
        UPDATE warehouse_zones
        SET capacity = $1, updated_at = CURRENT_TIMESTAMP
        WHERE name = $2
        RETURNING id, name, capacity
      `, [zone.capacity, zone.name]);

      if (updateResult.rows.length === 0) {
        console.warn(`⚠️ Зона "${zone.name}" не найдена в базе данных`);
      } else {

      }
    }

    // Получаем обновленные данные для подтверждения
    const updatedZones = await executeQuery(`
      SELECT id, name, capacity, updated_at
      FROM warehouse_zones
      WHERE name = ANY($1)
      ORDER BY name
    `, [zones.map(z => z.name)]);

    return NextResponse.json({
      success: true,
      message: 'Вместимость зон склада успешно обновлена',
      data: {
        updated_count: updatedZones.rows.length,
        zones: updatedZones.rows
      }
    });

  } catch (error) {
    console.error('❌ Ошибка обновления вместимости зон склада:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка обновления вместимости зон склада'
    }, { status: 500 });
  }
}

// GET - получить текущую вместимость зон склада
export async function GET(request: NextRequest) {
  try {
    const zonesResult = await executeQuery(`
      SELECT id, name, capacity, updated_at
      FROM warehouse_zones
      WHERE is_active = true
      ORDER BY name
    `);

    return NextResponse.json({
      success: true,
      data: zonesResult.rows
    });

  } catch (error) {
    console.error('❌ Ошибка получения вместимости зон склада:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения вместимости зон склада'
    }, { status: 500 });
  }
}