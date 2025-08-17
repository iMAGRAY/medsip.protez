import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';

export async function GET(_request: NextRequest) {
  try {
    const pool = getPool();

    // Проверяем группы с названием "Материал"
    const materialGroupsQuery = `
      SELECT
        g.id as group_id,
        g.name as group_name,
        g.sort_order,
        g.parent_id,
        g.is_section,
        g.is_active,
        COUNT(v.id) as values_count
      FROM characteristics_groups_simple g
      LEFT JOIN characteristics_values_simple v ON g.id = v.group_id AND v.is_active = true
      WHERE g.name = 'Материал' AND g.is_active = true
      GROUP BY g.id, g.name, g.sort_order, g.parent_id, g.is_section, g.is_active
      ORDER BY g.id
    `;

    const materialGroups = await pool.query(materialGroupsQuery);

    // Получаем все характеристики для каждой группы "Материал"
    const materialDetailsQuery = `
      SELECT
        g.id as group_id,
        g.name as group_name,
        v.id as value_id,
        v.value as value_name,
        v.sort_order,
        v.is_active
      FROM characteristics_groups_simple g
      JOIN characteristics_values_simple v ON g.id = v.group_id
      WHERE g.name = 'Материал' AND g.is_active = true AND v.is_active = true
      ORDER BY g.id, v.sort_order, v.value
    `;

    const materialDetails = await pool.query(materialDetailsQuery);

    // Группируем детали по group_id
    const detailsByGroup = materialDetails.rows.reduce((acc: any, detail: any) => {
      if (!acc[detail.group_id]) {
        acc[detail.group_id] = [];
      }
      acc[detail.group_id].push({
        value_id: detail.value_id,
        value_name: detail.value_name,
        sort_order: detail.sort_order,
        is_active: detail.is_active
      });
      return acc;
    }, {});

    // Формируем результат
    const result = materialGroups.rows.map(group => ({
      ...group,
      values: detailsByGroup[group.group_id] || []
    }));

    return NextResponse.json({
      success: true,
      message: `Найдено ${materialGroups.rows.length} групп с названием "Материал"`,
      data: {
        groups: result,
        total_groups: materialGroups.rows.length,
        total_values: materialDetails.rows.length
      }
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка проверки групп характеристик',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}