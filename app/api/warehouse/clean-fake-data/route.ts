import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

// POST - очистить все фейковые данные из складской системы
export async function POST(_request: NextRequest) {
  try {

    // Очистка в правильном порядке (учитывая foreign key constraints)
    const cleanupQueries = [
      'DELETE FROM warehouse_movements',
      'DELETE FROM warehouse_inventory',
      'DELETE FROM warehouse_sections',
      'DELETE FROM warehouse_zones',
      'DELETE FROM warehouse_warehouses',
      'DELETE FROM warehouse_cities',
      'DELETE FROM warehouse_regions'
    ];

    // Сброс автоинкремента
    const resetSequences = [
      'ALTER SEQUENCE warehouse_movements_id_seq RESTART WITH 1',
      'ALTER SEQUENCE warehouse_inventory_id_seq RESTART WITH 1',
      'ALTER SEQUENCE warehouse_sections_id_seq RESTART WITH 1',
      'ALTER SEQUENCE warehouse_zones_id_seq RESTART WITH 1',
      'ALTER SEQUENCE warehouse_warehouses_id_seq RESTART WITH 1',
      'ALTER SEQUENCE warehouse_cities_id_seq RESTART WITH 1',
      'ALTER SEQUENCE warehouse_regions_id_seq RESTART WITH 1'
    ];

    // Выполняем очистку
    for (const query of cleanupQueries) {
      await executeQuery(query);
    }

    // Сбрасываем автоинкремент
    for (const query of resetSequences) {
      await executeQuery(query);
    }

    // Проверяем результат
    const checkQueries = [
      'SELECT COUNT(*) as count FROM warehouse_regions',
      'SELECT COUNT(*) as count FROM warehouse_cities',
      'SELECT COUNT(*) as count FROM warehouse_warehouses',
      'SELECT COUNT(*) as count FROM warehouse_zones',
      'SELECT COUNT(*) as count FROM warehouse_sections',
      'SELECT COUNT(*) as count FROM warehouse_inventory',
      'SELECT COUNT(*) as count FROM warehouse_movements'
    ];

    const results: Record<string, number> = {};
    const tables = ['regions', 'cities', 'warehouses', 'zones', 'sections', 'inventory', 'movements'];

    for (let i = 0; i < checkQueries.length; i++) {
      const result = await executeQuery(checkQueries[i]);
      results[tables[i]] = parseInt(result.rows[0].count);
    }

    return NextResponse.json({
      success: true,
      message: 'Фейковые данные успешно очищены',
      data: {
        cleaned_tables: tables,
        record_counts: results,
        total_deleted: Object.values(results).reduce((sum: number, count: number) => sum + count, 0)
      }
    });

  } catch (error) {
    console.error('❌ Ошибка очистки фейковых данных:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: 'Ошибка очистки фейковых данных: ' + errorMessage
    }, { status: 500 });
  }
}