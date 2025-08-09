import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const entity_type = searchParams.get('entity_type')

    // Получаем все доступные сущности по отдельности для надежности
    const entitiesByType: {
      spec_group: any[]
      category: any[]
      manufacturer: any[]
      model_line: any[]
      manufacturers_category: any[]
    } = {
      spec_group: [],
      category: [],
      manufacturer: [],
      model_line: [],
      manufacturers_category: []
    }

    // 1. Группы характеристик (только корневые)
    if (!entity_type || entity_type === 'spec_group') {

      const specGroupsQuery = `
        SELECT
          'spec_group' as entity_type,
          cg.id as entity_id,
          cg.name,
          cg.description,
          cg.parent_id,
          cg.is_active,
          CASE WHEN cms.id IS NOT NULL THEN true ELSE false END as in_menu,
          (SELECT COUNT(*) FROM characteristics_values_simple cv WHERE cv.group_id = cg.id AND cv.is_active = true) as characteristics_count,
          (SELECT COUNT(*) FROM characteristics_groups_simple child WHERE child.parent_id = cg.id AND child.is_active = true) as children_count
        FROM characteristics_groups_simple cg
        LEFT JOIN catalog_menu_settings cms ON cms.entity_type = 'spec_group' AND cms.entity_id::integer = cg.id
        WHERE cg.is_active = true AND cg.parent_id IS NULL
        ORDER BY cg.name
      `
      const specGroupsResult = await executeQuery(specGroupsQuery)

      specGroupsResult.rows.forEach(row => {
        entitiesByType.spec_group.push({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          name: row.name,
          description: row.description,
          parent_id: row.parent_id,
          is_active: row.is_active,
          in_menu: row.in_menu,
          characteristics_count: parseInt(row.characteristics_count || 0),
          children_count: parseInt(row.children_count || 0),
          is_root: true
        })
      })
    }

    // 2. Категории (только корневые)
    if (!entity_type || entity_type === 'category') {

      const categoriesQuery = `
        SELECT
          'category' as entity_type,
          c.id as entity_id,
          c.name,
          c.description,
          c.parent_id,
          c.is_active,
          CASE WHEN cms.id IS NOT NULL THEN true ELSE false END as in_menu,
          c.type as category_type,
          (SELECT COUNT(*) FROM product_categories child WHERE child.parent_id = c.id AND child.is_active = true) as children_count
FROM product_categories c
        LEFT JOIN catalog_menu_settings cms ON cms.entity_type = 'category' AND cms.entity_id::integer = c.id
        WHERE c.is_active = true AND c.parent_id IS NULL
        ORDER BY c.name
      `
      const categoriesResult = await executeQuery(categoriesQuery)

      categoriesResult.rows.forEach(row => {
        entitiesByType.category.push({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          name: row.name,
          description: row.description,
          parent_id: row.parent_id,
          is_active: row.is_active,
          in_menu: row.in_menu,
          characteristics_count: 0,
          category_type: row.category_type,
          children_count: parseInt(row.children_count || 0),
          is_root: true
        })
      })
    }

    // 3. Производители
    if (!entity_type || entity_type === 'manufacturer') {

      const manufacturersQuery = `
        SELECT
          'manufacturer' as entity_type,
          m.id as entity_id,
          m.name,
          m.description,
          m.is_active,
          CASE WHEN cms.id IS NOT NULL THEN true ELSE false END as in_menu,
          m.country,
          (SELECT COUNT(*) FROM model_series ml WHERE ml.manufacturer_id = m.id AND ml.is_active = true) as model_series_count
        FROM manufacturers m
        LEFT JOIN catalog_menu_settings cms ON cms.entity_type = 'manufacturer' AND cms.entity_id::integer = m.id
        WHERE m.is_active = true
        ORDER BY m.name
      `
      const manufacturersResult = await executeQuery(manufacturersQuery)

      manufacturersResult.rows.forEach(row => {
        entitiesByType.manufacturer.push({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          name: row.name,
          description: row.description,
          parent_id: null,
          is_active: row.is_active,
          in_menu: row.in_menu,
          characteristics_count: 0,
          country: row.country,
          model_series_count: parseInt(row.model_series_count || 0)
        })
      })
    }

    // 4. Модельные ряды
    if (!entity_type || entity_type === 'model_line') {

      const modelLinesQuery = `
        SELECT
          'model_line' as entity_type,
          ml.id as entity_id,
          ml.name,
          ml.description,
          ml.is_active,
          CASE WHEN cms.id IS NOT NULL THEN true ELSE false END as in_menu,
          ml.manufacturer_id,
          (SELECT m.name FROM manufacturers m WHERE m.id = ml.manufacturer_id) as manufacturer_name
                  FROM model_series ml
        LEFT JOIN catalog_menu_settings cms ON cms.entity_type = 'model_line' AND cms.entity_id::integer = ml.id
        WHERE ml.is_active = true
        ORDER BY ml.name
      `
      const modelLinesResult = await executeQuery(modelLinesQuery)

      modelLinesResult.rows.forEach(row => {
        entitiesByType.model_line.push({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          name: row.name,
          description: row.description,
          parent_id: null,
          is_active: row.is_active,
          in_menu: row.in_menu,
          characteristics_count: 0,
          manufacturer_id: row.manufacturer_id,
          manufacturer_name: row.manufacturer_name
        })
      })
    }

    // 5. Специальная категория "Производители" (виртуальная сущность)
    if (!entity_type || entity_type === 'manufacturers_category') {

      // Проверяем, не существует ли уже такая категория в меню
      const existingQuery = `
        SELECT COUNT(*) as count
        FROM catalog_menu_settings
        WHERE entity_type = 'manufacturers_category'
      `
      const existingResult = await executeQuery(existingQuery)
      const alreadyExists = parseInt(existingResult.rows[0].count) > 0

      if (!alreadyExists) {
        // Считаем количество активных производителей
        const manufacturersCountQuery = `
          SELECT COUNT(*) as manufacturers_count
          FROM manufacturers
          WHERE is_active = true
        `
        const countResult = await executeQuery(manufacturersCountQuery)
        const manufacturersCount = parseInt(countResult.rows[0].manufacturers_count)

        entitiesByType.manufacturers_category.push({
          entity_type: 'manufacturers_category',
          entity_id: 0, // Специальное значение
          name: 'Все производители',
          description: `Автоматическая категория, включающая всех активных производителей (${manufacturersCount})`,
          parent_id: null,
          is_active: true,
          in_menu: false,
          characteristics_count: manufacturersCount,
          virtual: true
        })

} else {

      }
    }

    // Собираем статистику
    const allEntities = [
      ...entitiesByType.spec_group,
      ...entitiesByType.category,
      ...entitiesByType.manufacturer,
      ...entitiesByType.model_line,
      ...entitiesByType.manufacturers_category
    ]

    const stats = {
      total: allEntities.length,
      in_menu: allEntities.filter(entity => entity.in_menu).length,
      not_in_menu: allEntities.filter(entity => !entity.in_menu).length,
      by_type: {
        spec_group: entitiesByType.spec_group.length,
        category: entitiesByType.category.length,
        manufacturer: entitiesByType.manufacturer.length,
        model_line: entitiesByType.model_line.length,
        manufacturers_category: entitiesByType.manufacturers_category.length
      }
    }

// Helper function to get entities by type safely
    const getEntitiesByType = (type: string) => {
      switch (type) {
        case 'spec_group': return entitiesByType.spec_group
        case 'category': return entitiesByType.category
        case 'manufacturer': return entitiesByType.manufacturer
        case 'model_line': return entitiesByType.model_line
        case 'manufacturers_category': return entitiesByType.manufacturers_category
        default: return []
      }
    }

    return NextResponse.json({
      success: true,
      data: entity_type ? getEntitiesByType(entity_type) : entitiesByType,
      flat: allEntities,
      stats,
      entity_types: ['spec_group', 'category', 'manufacturer', 'model_line', 'manufacturers_category']
    })

  } catch (error) {
    console.error("Database error in available-entities GET:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch available entities",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}