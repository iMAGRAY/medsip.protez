import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'

export async function GET(request: NextRequest) {
  try {
    // Загружаем все группы характеристик (используем корневые группы как разделы)
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

    // Создаем разделы из корневых групп
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

    // Загружаем все значения характеристик
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

    // Группируем значения по группам
    const valuesByGroup = values.reduce((acc: any, value: any) => {
      if (!acc[value.group_id]) {
        acc[value.group_id] = []
      }
      acc[value.group_id].push({
        id: value.id,
        value: value.value,
        color_hex: value.color_hex,
        sort_order: value.sort_order,
        is_selected: false // Для новых продуктов ничего не выбрано
      })
      return acc
    }, {})

    // Группируем группы по разделам
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

    // Формируем итоговую структуру разделов
    const sectionsWithGroups = sections.map((section: any) => ({
      section_id: section.section_id,
      section_name: section.section_name,
      section_ordering: section.section_ordering,
      section_description: section.section_description,
      groups: groupsBySection[section.section_id] || []
    }))

    // Формируем список всех доступных групп характеристик
    // Исключаем дублирование - берем только группы, которые реально есть в разделах
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
        selected_characteristics: [] // Для новых продуктов пустой массив
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