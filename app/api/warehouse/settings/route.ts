import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

export const dynamic = 'force-dynamic'

// GET - получить настройки складской системы
export async function GET(_request: NextRequest) {
  try {
    // Проверяем существование таблицы настроек
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'warehouse_settings'
      )
    `;

    const tableExists = await executeQuery(tableCheckQuery);

    if (!tableExists.rows[0].exists) {
      return NextResponse.json({ success: false, error: 'Warehouse settings schema is not initialized' }, { status: 503 })
    }

    // Получаем все настройки
    const settingsResult = await executeQuery(`
      SELECT setting_key, setting_value, data_type
      FROM warehouse_settings
      ORDER BY setting_key
    `);

    // Преобразуем настройки в объект
    const settings: { [key: string]: any } = {};

    for (const row of settingsResult.rows) {
      const { setting_key, setting_value, data_type } = row;

      switch (data_type) {
        case 'boolean':
          settings[setting_key] = setting_value === 'true';
          break;
        case 'number':
          settings[setting_key] = parseInt(setting_value) || 0;
          break;
        default:
          settings[setting_key] = setting_value;
      }
    }

    return NextResponse.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Ошибка получения настроек склада:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения настроек складской системы'
    }, { status: 500 });
  }
}

// PUT - обновить настройки складской системы
export async function PUT(request: NextRequest) {
  try {
    const settings = await request.json();

    // Обновляем каждую настройку
    for (const [key, value] of Object.entries(settings)) {
      let dataType = 'string';
      let stringValue = String(value);

      if (typeof value === 'boolean') {
        dataType = 'boolean';
        stringValue = value ? 'true' : 'false';
      } else if (typeof value === 'number') {
        dataType = 'number';
        stringValue = String(value);
      }

      await executeQuery(`
        INSERT INTO warehouse_settings (setting_key, setting_value, data_type, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          data_type = EXCLUDED.data_type,
          updated_at = CURRENT_TIMESTAMP
      `, [key, stringValue, dataType]);
    }

    return NextResponse.json({
      success: true,
      message: 'Настройки сохранены'
    });

  } catch (error) {
    console.error('Ошибка сохранения настроек склада:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка сохранения настроек складской системы'
    }, { status: 500 });
  }
}