import { NextResponse, NextRequest } from "next/server"
import { executeQuery } from "@/lib/db-connection"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parent_id')

    if (!parentId) {
      return NextResponse.json(
        { success: false, error: "parent_id parameter is required" },
        { status: 400 }
      )
    }

    // Сначала пытаемся найти в catalog_menu_settings
    const parentMenuQuery = `
      SELECT entity_type, entity_id, name
      FROM catalog_menu_settings
      WHERE id = $1
    `

    const parentMenuResult = await executeQuery(parentMenuQuery, [parseInt(parentId)])

    let parentMenu = null

    if (parentMenuResult.rows.length > 0) {
      // Найдено в catalog_menu_settings
      parentMenu = parentMenuResult.rows[0]
} else {
      // Не найдено в catalog_menu_settings, пытаемся найти напрямую в таблицах

      // Проверяем в categories
      const categoryQuery = `SELECT id, name FROM product_categories WHERE id = $1 AND is_active = true`
      const categoryResult = await executeQuery(categoryQuery, [parseInt(parentId)])

      if (categoryResult.rows.length > 0) {
        parentMenu = {
          entity_type: 'category',
          entity_id: parentId,
          name: categoryResult.rows[0].name
        }

      } else {
        // Проверяем в characteristics_groups_simple
        const specGroupQuery = `SELECT id, name FROM characteristics_groups_simple WHERE id = $1 AND is_active = true`
        const specGroupResult = await executeQuery(specGroupQuery, [parseInt(parentId)])

        if (specGroupResult.rows.length > 0) {
          parentMenu = {
            entity_type: 'characteristic_group',
            entity_id: parentId,
            name: specGroupResult.rows[0].name
          }

        } else {
          // Проверяем в manufacturers
          const manufacturerQuery = `SELECT id, name FROM manufacturers WHERE id = $1 AND is_active = true`
          const manufacturerResult = await executeQuery(manufacturerQuery, [parseInt(parentId)])

          if (manufacturerResult.rows.length > 0) {
            parentMenu = {
              entity_type: 'manufacturer',
              entity_id: parentId,
              name: manufacturerResult.rows[0].name
            }

          }
        }
      }

      if (!parentMenu) {
        return NextResponse.json(
          { success: false, error: "Parent item not found in any table" },
          { status: 404 }
        )
      }
    }

    // Интерфейс для субгрупп с всеми возможными свойствами
    interface SubgroupItem {
      id: number
      name: string
      description?: string
      parent_id: number | null
      is_active?: boolean
      created_at?: string
      updated_at?: string
      entity_type: string
      entity_id: number
      characteristics_count: number | string
      children_count: string
      products_count?: number
      category_type?: string
      manufacturer_id?: number
      country?: string
    }

    let subgroups: SubgroupItem[] = []

    // В зависимости от типа родительского элемента загружаем соответствующие подэлементы
    switch (parentMenu.entity_type) {
      case 'category':
        // Загружаем подкатегории
        const categoryQuery = `
          SELECT
            c.id,
            c.name,
            c.description,
            c.parent_id,
            c.is_active,
            c.type as category_type,
            c.created_at,
            c.updated_at,
            (SELECT COUNT(*) FROM product_categories c2 WHERE c2.parent_id = c.id AND c2.is_active = true) as children_count,
(SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as products_count
FROM product_categories c
          WHERE c.parent_id = $1 AND c.is_active = true
          ORDER BY c.name ASC
        `
        const categoryResult = await executeQuery(categoryQuery, [parseInt(parentMenu.entity_id)])
        subgroups = categoryResult.rows.map(row => ({
          ...row,
          entity_type: 'category',
          entity_id: row.id,
          characteristics_count: row.products_count,
          children_count: row.children_count.toString() // Важно: UI ожидает строку
        })) as SubgroupItem[]
        break

      case 'characteristic_group':
        // Загружаем подгруппы характеристик (новая логика)
        const characteristicGroupQuery = `
          SELECT
            cg.id,
            cg.name,
            cg.description,
            cg.parent_id,
            cg.is_active,
            cg.created_at,
            cg.updated_at,
            (SELECT COUNT(*) FROM characteristics_values_simple cv WHERE cv.group_id = cg.id AND cv.is_active = true) as characteristics_count,
            (SELECT COUNT(*) FROM characteristics_groups_simple cg2 WHERE cg2.parent_id = cg.id AND cg2.is_active = true) as children_count
          FROM characteristics_groups_simple cg
          WHERE cg.parent_id = $1 AND cg.is_active = true
          ORDER BY cg.name ASC
        `
        const characteristicGroupResult = await executeQuery(characteristicGroupQuery, [parseInt(parentMenu.entity_id)])
        subgroups = characteristicGroupResult.rows.map(row => ({
          ...row,
          entity_type: 'characteristic_group',
          entity_id: row.id,
          children_count: row.children_count.toString() // Важно: UI ожидает строку
        })) as SubgroupItem[]
        break

      case 'manufacturer':
        // Загружаем модельные ряды производителя
        const modelLineQuery = `
          SELECT
            ml.id,
            ml.name,
            ml.description,
            ml.manufacturer_id,
            ml.is_active,
            ml.created_at,
            ml.updated_at,
            (SELECT COUNT(*) FROM products p WHERE p.model_line_id = ml.id) as products_count,
            0 as children_count
          FROM model_series ml
          WHERE ml.manufacturer_id = $1 AND ml.is_active = true
          ORDER BY ml.name ASC
        `
        const modelLineResult = await executeQuery(modelLineQuery, [parseInt(parentMenu.entity_id)])
        subgroups = modelLineResult.rows.map(row => ({
          ...row,
          entity_type: 'model_line',
          entity_id: row.id,
          characteristics_count: row.products_count,
          parent_id: row.manufacturer_id,
          children_count: row.children_count.toString() // Важно: UI ожидает строку
        })) as SubgroupItem[]
        break

      case 'manufacturers_category':
        // Загружаем всех производителей
        const manufacturersQuery = `
          SELECT
            m.id,
            m.name,
            m.description,
            m.country,
            m.is_active,
            m.created_at,
            m.updated_at,
            (SELECT COUNT(*) FROM model_series ml WHERE ml.manufacturer_id = m.id AND ml.is_active = true) as children_count,
            (SELECT COUNT(*) FROM products p WHERE p.manufacturer_id = m.id) as products_count
          FROM manufacturers m
          WHERE m.is_active = true
          ORDER BY m.name ASC
        `
        const manufacturersResult = await executeQuery(manufacturersQuery)
        subgroups = manufacturersResult.rows.map(row => ({
          ...row,
          entity_type: 'manufacturer',
          entity_id: row.id,
          characteristics_count: row.products_count,
          parent_id: null, // Производители не имеют родителя в этом контексте
          children_count: row.children_count.toString() // Важно: UI ожидает строку
        })) as SubgroupItem[]
        break

      default:

        break
    }

    return NextResponse.json({
      success: true,
      data: subgroups,
      parent: {
        id: parseInt(parentId),
        name: parentMenu.name,
        entity_type: parentMenu.entity_type,
        entity_id: parentMenu.entity_id
      },
      total: subgroups.length,
      parent_id: parseInt(parentId)
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch subgroups",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}