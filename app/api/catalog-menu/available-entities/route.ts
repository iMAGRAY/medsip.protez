import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"
import { guardDbOr503Fast } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

export async function GET(request: Request) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const entity_type = searchParams.get('entity_type')

    const tables = ['characteristics_groups_simple','characteristics_values_simple','product_categories','manufacturers','model_series','catalog_menu_settings']
    const checks = await Promise.all(tables.map(t => executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=$1
      ) AS exist
    `, [t])))
    const exists: Record<string, boolean> = {}
    tables.forEach((t, i) => exists[t] = !!checks[i].rows?.[0]?.exist)

    if (!exists.characteristics_groups_simple && (!entity_type || entity_type === 'spec_group')) {
      // если явно просят только spec_group — считаем это отсутствием схемы
      if (entity_type === 'spec_group') {
        return NextResponse.json({ success: false, error: 'Characteristics schema is not initialized' }, { status: 503 })
      }
    }

    const entitiesByType: { spec_group: any[]; category: any[]; manufacturer: any[]; model_line: any[]; manufacturers_category: any[] } = {
      spec_group: [],
      category: [],
      manufacturer: [],
      model_line: [],
      manufacturers_category: []
    }

    if ((!entity_type || entity_type === 'spec_group') && exists.characteristics_groups_simple) {
      const specGroupsQuery = `
        SELECT
          'spec_group' as entity_type,
          cg.id as entity_id,
          cg.name,
          cg.description,
          cg.parent_id,
          cg.is_active,
          CASE WHEN ${exists.catalog_menu_settings ? `EXISTS(SELECT 1 FROM catalog_menu_settings cms WHERE cms.entity_type='spec_group' AND cms.entity_id::integer=cg.id)` : 'FALSE'} THEN true ELSE false END as in_menu,
          (SELECT COUNT(*) FROM characteristics_values_simple cv WHERE cv.group_id = cg.id AND cv.is_active = true) as characteristics_count,
          (SELECT COUNT(*) FROM characteristics_groups_simple child WHERE child.parent_id = cg.id AND child.is_active = true) as children_count
        FROM characteristics_groups_simple cg
        WHERE cg.is_active = true AND cg.parent_id IS NULL
        ORDER BY cg.name`
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

    if ((!entity_type || entity_type === 'category') && exists.product_categories) {
      const categoriesQuery = `
        SELECT
          'category' as entity_type,
          c.id as entity_id,
          c.name,
          c.description,
          c.parent_id,
          (c.is_deleted = false OR c.is_deleted IS NULL) as is_active,
          CASE WHEN ${exists.catalog_menu_settings ? `EXISTS(SELECT 1 FROM catalog_menu_settings cms WHERE cms.entity_type='category' AND cms.entity_id::integer=c.id)` : 'FALSE'} THEN true ELSE false END as in_menu,
          c.type as category_type,
          (SELECT COUNT(*) FROM product_categories child WHERE child.parent_id = c.id AND (child.is_deleted = false OR child.is_deleted IS NULL)) as children_count
        FROM product_categories c
        WHERE (c.is_deleted = false OR c.is_deleted IS NULL) AND c.parent_id IS NULL
        ORDER BY c.name`
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

    if ((!entity_type || entity_type === 'manufacturer') && exists.manufacturers) {
      const manufacturersQuery = `
        SELECT
          'manufacturer' as entity_type,
          m.id as entity_id,
          m.name,
          m.description,
          true as is_active,
          CASE WHEN ${exists.catalog_menu_settings ? `EXISTS(SELECT 1 FROM catalog_menu_settings cms WHERE cms.entity_type='manufacturer' AND cms.entity_id::integer=m.id)` : 'FALSE'} THEN true ELSE false END as in_menu,
          m.country,
          (SELECT COUNT(*) FROM model_series ml WHERE ml.manufacturer_id = m.id) as model_series_count
        FROM manufacturers m
        ORDER BY m.name`
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

    if ((!entity_type || entity_type === 'model_line') && exists.model_series) {
      const modelLinesQuery = `
        SELECT
          'model_line' as entity_type,
          ml.id as entity_id,
          ml.name,
          ml.description,
          true as is_active,
          CASE WHEN ${exists.catalog_menu_settings ? `EXISTS(SELECT 1 FROM catalog_menu_settings cms WHERE cms.entity_type='model_line' AND cms.entity_id::integer=ml.id)` : 'FALSE'} THEN true ELSE false END as in_menu,
          ml.manufacturer_id,
          (SELECT m.name FROM manufacturers m WHERE m.id = ml.manufacturer_id) as manufacturer_name
        FROM model_series ml
        ORDER BY ml.name`
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

    if (!entity_type || entity_type === 'manufacturers_category') {
      if (!exists.manufacturers) {
        // нет таблицы производителей — нет и виртуальной категории
      } else {
        const countResult = await executeQuery(`SELECT COUNT(*) as manufacturers_count FROM manufacturers`)
        const manufacturersCount = parseInt(countResult.rows[0].manufacturers_count)
        entitiesByType.manufacturers_category.push({
          entity_type: 'manufacturers_category',
          entity_id: 0,
          name: 'Все производители',
          description: `Автоматическая категория, включающая всех активных производителей (${manufacturersCount})`,
          parent_id: null,
          is_active: true,
          in_menu: false,
          characteristics_count: manufacturersCount,
          virtual: true
        })
      }
    }

    const allEntities = [
      ...entitiesByType.spec_group,
      ...entitiesByType.category,
      ...entitiesByType.manufacturer,
      ...entitiesByType.model_line,
      ...entitiesByType.manufacturers_category
    ]

    const _stats = {
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
      stats: _stats,
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