import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"

export async function GET() {
  try {

    // Получаем доступные группы характеристик с их значениями
    const query = `
      WITH RECURSIVE hierarchy AS (
        -- Корневые группы
        SELECT
          sg.id,
          sg.name,
          sg.description,
          sg.parent_id,
          sg.sort_order as ordering,
          false as show_in_main_params,
          0 as main_params_priority,
          null as main_params_label_override,
          sg.is_active,
          0 as level,
          ARRAY[sg.sort_order, sg.id] as path
        FROM characteristics_groups_simple sg
        WHERE sg.parent_id IS NULL AND sg.is_active = true

        UNION ALL

        -- Дочерние группы
        SELECT
          sg.id,
          sg.name,
          sg.description,
          sg.parent_id,
          sg.sort_order as ordering,
          false as show_in_main_params,
          0 as main_params_priority,
          null as main_params_label_override,
          sg.is_active,
          h.level + 1,
          h.path || ARRAY[sg.sort_order, sg.id]
        FROM characteristics_groups_simple sg
        INNER JOIN hierarchy h ON sg.parent_id = h.id
        WHERE sg.is_active = true
      )
      SELECT
        h.id,
        h.name,
        h.description,
        h.parent_id,
        h.ordering,
        h.show_in_main_params,
        h.main_params_priority,
        h.main_params_label_override,
        h.level,
        h.is_active,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', cv.id,
              'value', cv.value,
              'display_name', cv.value,
              'color_hex', cv.color_hex,
              'ordering', cv.sort_order
            ) ORDER BY cv.sort_order, cv.value
          ) FILTER (WHERE cv.id IS NOT NULL),
          '[]'::json
        ) as available_values,
        (SELECT COUNT(*) FROM characteristics_groups_simple WHERE parent_id = h.id AND is_active = true) as children_count
      FROM hierarchy h
      LEFT JOIN characteristics_values_simple cv ON h.id = cv.group_id
      GROUP BY h.id, h.name, h.description, h.parent_id, h.ordering, h.show_in_main_params, h.main_params_priority, h.main_params_label_override, h.level, h.is_active, h.path
      ORDER BY h.path
    `

    const result = await executeQuery(query)

    return NextResponse.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch available specifications",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}