import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';

/**
 * FILTER CHARACTERISTICS API - НОВАЯ EAV СИСТЕМА
 * Возвращает характеристики для фильтрации товаров
 * Использует таблицы characteristic_groups, characteristic_values, product_characteristics_simple
 */

export async function GET(request: NextRequest) {
  try {

    const pool = getPool();

    // Новый запрос: уникальные значения по group_id через WITH
    const query = `
      WITH value_counts AS (
        SELECT
          cv.id as value_id,
          COUNT(DISTINCT pc.product_id) as product_count
        FROM characteristic_values cv
        LEFT JOIN product_characteristics_simple pc ON pc.value_id = cv.id
        WHERE cv.is_active = true
        GROUP BY cv.id
      ),
      unique_values AS (
        SELECT DISTINCT ON (cv.id)
          cv.id,
          cv.group_id,
          cv.value,
          cv.color_hex,
          cv.sort_order,
          cv.description,
          cv.is_active,
          COALESCE(vc.product_count, 0) as product_count
        FROM characteristic_values cv
        LEFT JOIN value_counts vc ON vc.value_id = cv.id
        WHERE cv.is_active = true
      )
      SELECT
        cg.id as group_id,
        cg.name as group_name,
        cg.description,
        cg.ordering,
        cg.show_in_main_params,
        cg.main_params_priority,
        COUNT(DISTINCT pc.product_id) as product_count,
        COUNT(DISTINCT uv.id) as values_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', uv.id,
              'value', uv.value,
              'color_hex', uv.color_hex,
              'sort_order', uv.sort_order,
              'description', uv.description,
              'is_active', uv.is_active,
              'product_count', uv.product_count
            ) ORDER BY uv.sort_order, uv.value
          ) FILTER (WHERE uv.id IS NOT NULL),
          '[]'::json
        ) as values
      FROM characteristic_groups cg
      LEFT JOIN unique_values uv ON uv.group_id = cg.id
      LEFT JOIN product_characteristics_simple pc ON pc.value_id = uv.id
      WHERE cg.is_active = true
      GROUP BY cg.id, cg.name, cg.description, cg.ordering, cg.show_in_main_params, cg.main_params_priority
      HAVING COUNT(DISTINCT pc.product_id) > 0
      ORDER BY COUNT(DISTINCT pc.product_id) DESC, cg.ordering, cg.name
    `;

    const result = await pool.query(query);

    // Форматируем ответ
    const formattedGroups = result.rows.map(row => ({
      id: row.group_id,
      name: row.group_name,
      description: row.description,
      ordering: row.ordering,
      show_in_main_params: row.show_in_main_params,
      main_params_priority: row.main_params_priority,
      product_count: parseInt(row.product_count),
      values_count: parseInt(row.values_count),
      values: row.values || []
    }));

    return NextResponse.json({
      success: true,
      data: {
        groups: formattedGroups,
        total_groups: formattedGroups.length,
        total_characteristics: formattedGroups.reduce((sum, group) => sum + group.values_count, 0)
      }
    });

  } catch (error) {
    console.error('❌ Database error in filter-characteristics GET (new EAV system):', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch filter characteristics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}