import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

// GET - получить настройки складской системы
export async function GET(request: NextRequest) {
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
      // Создаем таблицу если она не существует
      await executeQuery(`
        CREATE TABLE warehouse_settings (
          id SERIAL PRIMARY KEY,
          setting_key VARCHAR(255) UNIQUE NOT NULL,
          setting_value TEXT,
          data_type VARCHAR(50) DEFAULT 'string',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Вставляем настройки по умолчанию
      const defaultSettings = [
        { key: 'auto_reorder_enabled', value: 'false', type: 'boolean' },
        { key: 'low_stock_threshold', value: '10', type: 'number' },
        { key: 'critical_stock_threshold', value: '5', type: 'number' },
        { key: 'default_warehouse_capacity', value: '1000', type: 'number' },
        { key: 'email_notifications', value: 'true', type: 'boolean' },
        { key: 'low_stock_alerts', value: 'true', type: 'boolean' },
        { key: 'movement_notifications', value: 'false', type: 'boolean' },
        { key: 'daily_reports', value: 'true', type: 'boolean' },
        { key: 'auto_zone_assignment', value: 'false', type: 'boolean' },
        { key: 'auto_section_optimization', value: 'false', type: 'boolean' },
        { key: 'batch_processing_enabled', value: 'true', type: 'boolean' },
        { key: 'require_confirmation_for_deletion', value: 'true', type: 'boolean' },
        { key: 'audit_trail_enabled', value: 'true', type: 'boolean' },
        { key: 'user_activity_tracking', value: 'true', type: 'boolean' },
        { key: 'cache_analytics_minutes', value: '15', type: 'number' },
        { key: 'max_concurrent_operations', value: '5', type: 'number' },
        { key: 'enable_background_sync', value: 'true', type: 'boolean' }
      ];

      for (const setting of defaultSettings) {
        await executeQuery(`
          INSERT INTO warehouse_settings (setting_key, setting_value, data_type)
          VALUES ($1, $2, $3)
        `, [setting.key, setting.value, setting.type]);
      }
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