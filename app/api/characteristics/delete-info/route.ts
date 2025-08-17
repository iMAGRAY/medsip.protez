import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID характеристики обязателен' },
        { status: 400 }
      )
    }

    const pool = getPool()

    // Проверяем существование группы
    const groupResult = await pool.query(
      'SELECT id, name, description, is_section, parent_id FROM characteristics_groups_simple WHERE id = $1',
      [parseInt(id)]
    )

    if (groupResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    const group = groupResult.rows[0]
// Функция для получения всех дочерних групп рекурсивно
    const getAllChildren = async (parentId: number): Promise<any[]> => {
      const childrenResult = await pool.query(`
        SELECT id, name, description, is_section, parent_id
        FROM characteristics_groups_simple
        WHERE parent_id = $1 AND is_active = true
        ORDER BY name
      `, [parentId])

      let allChildren: any[] = []

      for (const child of childrenResult.rows) {
        allChildren.push(child)
        // Рекурсивно получаем детей этого ребенка
        const grandChildren = await getAllChildren(child.id)
        allChildren = allChildren.concat(grandChildren)
      }

      return allChildren
    }

    // Получаем все дочерние группы
    const childGroups = await getAllChildren(parseInt(id))

    // Получаем количество значений характеристик в основной группе
    const valuesResult = await pool.query(
      'SELECT COUNT(*) as count FROM characteristics_values_simple WHERE group_id = $1',
      [parseInt(id)]
    )
    const valuesCount = parseInt(valuesResult.rows[0].count)

    // Получаем количество значений характеристик во всех дочерних группах
    let childValuesCount = 0
    const childGroupIds = childGroups.map(g => g.id)
    if (childGroupIds.length > 0) {
      const childValuesResult = await pool.query(
        `SELECT COUNT(*) as count FROM characteristics_values_simple
         WHERE group_id = ANY($1)`,
        [childGroupIds]
      )
      childValuesCount = parseInt(childValuesResult.rows[0].count)
    }

    // Получаем количество характеристик товаров, которые будут удалены
    const allGroupIds = [parseInt(id), ...childGroupIds]
    const productCharacteristicsResult = await pool.query(`
      SELECT
        COUNT(*) as count,
        COUNT(DISTINCT pc.product_id) as product_count
      FROM product_characteristics_simple pc
      JOIN characteristics_values_simple cv ON pc.value_id = cv.id
      WHERE cv.group_id = ANY($1)
    `, [allGroupIds])

    const productCharacteristicsCount = parseInt(productCharacteristicsResult.rows[0].count)
    const affectedProductsCount = parseInt(productCharacteristicsResult.rows[0].product_count)

    // Получаем список затронутых товаров (первые 10)
    const affectedProductsResult = await pool.query(`
      SELECT DISTINCT p.id, p.name
      FROM product_characteristics_simple pc
      JOIN characteristics_values_simple cv ON pc.value_id = cv.id
      JOIN products p ON pc.product_id = p.id
      WHERE cv.group_id = ANY($1)
      ORDER BY p.name
      LIMIT 10
    `, [allGroupIds])

    const deleteInfo = {
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        is_section: group.is_section,
        type: group.is_section ? 'раздел' : 'группа'
      },
      will_be_deleted: {
        child_groups: childGroups.length,
        child_groups_list: childGroups.map(g => ({
          id: g.id,
          name: g.name,
          type: g.is_section ? 'раздел' : 'группа'
        })),
        values_in_main_group: valuesCount,
        values_in_child_groups: childValuesCount,
        total_values: valuesCount + childValuesCount,
        product_characteristics: productCharacteristicsCount,
        affected_products: affectedProductsCount,
        affected_products_list: affectedProductsResult.rows
      },
      warnings: [] as string[]
    }

    // Добавляем предупреждения
    if (childGroups.length > 0) {
      deleteInfo.warnings.push(
        `Будут удалены ${childGroups.length} дочерних ${childGroups.length === 1 ? 'группа' : 'групп'}`
      )
    }

    if (deleteInfo.will_be_deleted.total_values > 0) {
      deleteInfo.warnings.push(
        `Будут удалены ${deleteInfo.will_be_deleted.total_values} значений характеристик`
      )
    }

    if (productCharacteristicsCount > 0) {
      deleteInfo.warnings.push(
        `Будут удалены ${productCharacteristicsCount} характеристик у ${affectedProductsCount} товаров`
      )
    }

    return NextResponse.json({
      success: true,
      data: deleteInfo
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка получения информации об удалении',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}