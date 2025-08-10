import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'

function isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

export async function GET(request: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const exists = await executeQuery(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name = ANY($1)
    `, [[
      'characteristics_groups_simple',
      'characteristics_values_simple'
    ]])
    const names = new Set(exists.rows.map((r: any) => r.table_name))
    if (!names.has('characteristics_groups_simple') || !names.has('characteristics_values_simple')) {
      return NextResponse.json({ success: false, error: 'Characteristics schema is not initialized' }, { status: 503 })
    }

    const groupsQuery = `
      SELECT
        cg.id as group_id,
        cg.name as group_name,
        cg.sort_order as group_sort_order,
        cg.parent_id,
        CASE
          WHEN cg.parent_id IS NULL THEN cg.id
          ELSE cg.parent_id
        END as section_id,
        CASE
          WHEN cg.parent_id IS NULL THEN cg.name
          ELSE (SELECT name FROM characteristics_groups_simple WHERE id = cg.parent_id)
        END as section_name,
        cg.sort_order as group_ordering
      FROM characteristics_groups_simple cg
      WHERE cg.is_active = true
      ORDER BY cg.sort_order ASC, cg.name ASC
    `
    const groupsResult = await executeQuery(groupsQuery)
    const groups = groupsResult.rows

    const sectionsMap = new Map()
    groups.forEach(group => {
      if (!group.parent_id) {
        sectionsMap.set(group.group_id, {
          section_id: group.group_id,
          section_name: group.group_name,
          section_ordering: group.group_sort_order,
          section_description: null
        })
      }
    })
    const sections = Array.from(sectionsMap.values())

    const valuesQuery = `
      SELECT
        cv.id,
        cv.value,
        cv.color_hex,
        cv.sort_order,
        cv.group_id,
        cg.name as group_name
      FROM characteristics_values_simple cv
      JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
      WHERE cg.is_active = true
      ORDER BY cv.sort_order ASC, cv.value ASC
    `
    const valuesResult = await executeQuery(valuesQuery)
    const values = valuesResult.rows

    const valuesByGroup = values.reduce((acc: any, value: any) => {
      if (!acc[value.group_id]) {
        acc[value.group_id] = []
      }
      acc[value.group_id].push({
        id: value.id,
        value: value.value,
        color_hex: value.color_hex,
        sort_order: value.sort_order,
        is_selected: false
      })
      return acc
    }, {})

    const groupsBySection = groups.reduce((acc: any, group: any) => {
      if (!acc[group.section_id]) {
        acc[group.section_id] = []
      }
      acc[group.section_id].push({
        group_id: group.group_id,
        group_name: group.group_name,
        group_sort_order: group.group_sort_order,
        ordering: group.group_ordering,
        values: valuesByGroup[group.group_id] || []
      })
      return acc
    }, {})

    const sectionsWithGroups = sections.map((section: any) => ({
      section_id: section.section_id,
      section_name: section.section_name,
      section_ordering: section.section_ordering,
      section_description: section.section_description,
      groups: groupsBySection[section.section_id] || []
    }))

    const availableCharacteristics = sectionsWithGroups.flatMap(section =>
      section.groups.map((group: any) => ({
        group_id: group.group_id,
        group_name: group.group_name,
        group_sort_order: group.group_sort_order,
        section_id: section.section_id,
        section_name: section.section_name,
        values: group.values || []
      }))
    )

    return NextResponse.json({
      success: true,
      data: {
        sections: sectionsWithGroups,
        available_characteristics: availableCharacteristics,
        selected_characteristics: []
      }
    })

  } catch (error) {
    console.error('❌ Error loading available characteristics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка загрузки доступных характеристик',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}