import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"

export async function GET() {

  try {

    // Запрос для получения иерархической структуры: разделы -> группы -> характеристики
    const query = `
      WITH sections AS (
        SELECT
          id,
          name,
          description,
          sort_order,
          is_section
        FROM characteristics_groups_simple
        WHERE is_active = true AND is_section = true
      ),
      groups_with_characteristics AS (
      SELECT
        sg.id,
        sg.name,
        sg.description,
        sg.parent_id,
                  sg.sort_order,
        sg.is_section,
        COUNT(se.id) as characteristics_count,
        COALESCE(
          json_agg(
            CASE WHEN se.id IS NOT NULL
            THEN json_build_object(
              'id', se.id,
              'value', se.value,
              'description', se.description,
              'color_hex', se.color_hex,
              'sort_order', se.sort_order
            ) END
              ORDER BY se.sort_order, se.value
          ) FILTER (WHERE se.id IS NOT NULL),
          '[]'::json
        ) as characteristics
      FROM characteristics_groups_simple sg
      LEFT JOIN characteristics_values_simple se ON sg.id = se.group_id AND se.is_active = true
        WHERE sg.is_active = true AND sg.is_section = false AND sg.parent_id IS NOT NULL
        GROUP BY sg.id, sg.name, sg.description, sg.parent_id, sg.sort_order, sg.is_section
      )
      SELECT
        s.id,
        s.name,
        s.description,
        s.sort_order,
        s.is_section,
        COALESCE(
          json_agg(
            json_build_object(
              'id', g.id,
              'name', g.name,
              'description', g.description,
              'sort_order', g.sort_order,
              'characteristics_count', g.characteristics_count,
              'characteristics', g.characteristics
            )
            ORDER BY g.sort_order, g.name
          ) FILTER (WHERE g.id IS NOT NULL),
          '[]'::json
        ) as groups
      FROM sections s
      LEFT JOIN groups_with_characteristics g ON s.id = g.parent_id
      GROUP BY s.id, s.name, s.description, s.sort_order, s.is_section
      ORDER BY s.sort_order, s.name
    `

    const result = await executeQuery(query)

return NextResponse.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    })

  } catch (error) {
    console.error("Database error in spec-groups-optimized GET:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch spec groups",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}