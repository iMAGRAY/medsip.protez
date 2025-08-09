import { NextRequest, NextResponse } from "next/server"
import { executeQuery, getPool } from "@/lib/db-connection"

export async function GET() {
  try {

    // Запрос к реальным таблицам spec_groups
    const query = `
      WITH RECURSIVE group_tree AS (
        -- Базовый случай: корневые группы
        SELECT
          sg.id,
          sg.name,
          sg.description,
          sg.parent_id,
          sg.ordering,
          sg.is_active,
          sg.created_at,
          sg.updated_at,
          0 as level,
          ARRAY[sg.ordering, sg.id] as path
        FROM characteristics_groups_simple sg
        WHERE sg.parent_id IS NULL AND sg.is_active = true

        UNION ALL

        -- Рекурсивный случай: дочерние группы
        SELECT
          sg.id,
          sg.name,
          sg.description,
          sg.parent_id,
          sg.ordering,
          sg.is_active,
          sg.created_at,
          sg.updated_at,
          gt.level + 1,
          gt.path || ARRAY[sg.ordering, sg.id]
        FROM characteristics_groups_simple sg
        INNER JOIN group_tree gt ON sg.parent_id = gt.id
        WHERE sg.is_active = true
      )
      SELECT
        gt.id,
        gt.name,
        gt.description,
        gt.parent_id,
        gt.ordering,
        gt.level,
        gt.is_active,
        gt.created_at,
        gt.updated_at,
        (SELECT COUNT(*) FROM characteristics_groups_simple WHERE parent_id = gt.id AND is_active = true) as children_count
      FROM group_tree gt
      ORDER BY gt.path
    `

    const result = await executeQuery(query)

    return NextResponse.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    })

  } catch (error) {
    console.error("Database error in spec-groups GET:", error)
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

export async function POST(request: NextRequest) {
  try {
    const { name, description, parent_id } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      )
    }

    const result = await executeQuery(
      `INSERT INTO spec_groups (name, description, parent_id, ordering, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, COALESCE((SELECT MAX(ordering) + 1 FROM characteristics_groups_simple WHERE parent_id = $3), 0), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [name.trim(), description?.trim() || null, parent_id || null]
    )

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error("Database error in spec-groups POST:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create spec group" },
      { status: 500 }
    )
  }
}

// PUT - Обновить группу характеристик
export async function PUT(request: NextRequest) {
  const pool = getPool()

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {

      return NextResponse.json(
        { error: 'ID группы обязателен' },
        { status: 400 }
      )
    }

    const body = await request.json()
const { name, description, parent_id } = body

if (!name?.trim()) {

      return NextResponse.json(
        { error: 'Название группы обязательно' },
        { status: 400 }
      )
    }

    const client = await pool.connect()

    // Проверяем существование группы для обновления
    const existsCheck = await client.query(
      'SELECT id, name FROM characteristics_groups_simple WHERE id = $1',
      [parseInt(id)]
    )

    if (existsCheck.rows.length > 0) {

    }

    if (existsCheck.rows.length === 0) {
      client.release()

      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    // Если указан parent_id, проверяем что родительская группа существует и не является дочерней
    if (parent_id) {

      // Проверяем, что группа не пытается стать родителем самой себя
      if (parseInt(parent_id) === parseInt(id)) {
        client.release()

        return NextResponse.json(
          { error: 'Группа не может быть родителем самой себя' },
          { status: 400 }
        )
      }

      const parentCheck = await client.query(
        'SELECT id, name FROM characteristics_groups_simple WHERE id = $1',
        [parent_id]
      )

      if (parentCheck.rows.length > 0) {

      }

      if (parentCheck.rows.length === 0) {
        client.release()

        return NextResponse.json(
          { error: 'Родительская группа не найдена' },
          { status: 400 }
        )
      }

      // Проверяем, что не создаем циклическую зависимость

      // Ищем всех потомков текущей группы
      const cyclicCheck = await client.query(`
        WITH RECURSIVE hierarchy AS (
          -- Начинаем с текущей редактируемой группы
          SELECT id, parent_id, 1 as level, ARRAY[id] as path
          FROM characteristics_groups_simple
          WHERE id = $1

          UNION ALL

          -- Ищем всех потомков этой группы
          SELECT sg.id, sg.parent_id, h.level + 1, h.path || sg.id
          FROM characteristics_groups_simple sg
          JOIN hierarchy h ON sg.parent_id = h.id
          WHERE h.level < 10 AND NOT (sg.id = ANY(h.path))
        )
        SELECT COUNT(*) as count, array_agg(id) as descendant_ids
        FROM hierarchy
        WHERE id = $2 AND level > 1
      `, [parseInt(id), parent_id])

      if (cyclicCheck.rows[0].count > 0) {
        client.release()

        return NextResponse.json(
          { error: `Нельзя установить группу как родительскую для своего предка. Группа ${parent_id} является потомком группы ${id}.` },
          { status: 400 }
        )
      }
    }

    const result = await client.query(`
      UPDATE spec_groups
      SET name = $1, description = $2, parent_id = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [name.trim(), description?.trim() || null, parent_id || null, parseInt(id)])

    if (result.rows.length > 0) {

    }

    client.release()

    if (result.rows.length === 0) {
return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('❌ Error updating spec group:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: error.code,
      detail: error.detail,
      stack: error.stack
    })

    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { // unique violation
      return NextResponse.json(
        { error: 'Группа с таким названием уже существует' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Ошибка обновления группы характеристик' },
      { status: 500 }
    )
  }
}

// DELETE - Удалить группу характеристик
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const force = searchParams.get('force') === 'true'

    if (!id) {
      return NextResponse.json(
        { error: 'ID группы обязателен' },
        { status: 400 }
      )
    }

const pool = getPool()
    const client = await pool.connect()

    try {
          // Проверяем существование группы
    const checkResult = await client.query(
      'SELECT id, name FROM characteristics_groups_simple WHERE id = $1',
      [parseInt(id)]
    )

      if (checkResult.rows.length === 0) {
        client.release()
        return NextResponse.json(
          { error: 'Группа не найдена' },
          { status: 404 }
        )
      }

      const groupName = checkResult.rows[0].name
// Check if this is a protected group that cannot be deleted
      if (groupName === 'Общие параметры') {
        client.release()
        return NextResponse.json(
          {
            error: 'Группа "Общие параметры" защищена от удаления',
            details: 'Эта группа является системной и не может быть удалена',
            code: 'PROTECTED_GROUP'
          },
          { status: 403 }
        )
      }

      if (!force) {
        // Обычное удаление - проверяем связи

        // Проверяем наличие дочерних групп
        const childrenCheck = await client.query(
          'SELECT COUNT(*) as count, array_agg(name) as names FROM characteristics_groups_simple WHERE parent_id = $1',
          [parseInt(id)]
        )

        const childrenCount = parseInt(childrenCheck.rows[0].count)
        if (childrenCount > 0) {
          const childrenNames = childrenCheck.rows[0].names.join(', ')

          client.release()
          return NextResponse.json(
            {
              error: `Невозможно удалить группу "${groupName}"`,
              details: `Сначала удалите ${childrenCount} дочерних групп: ${childrenNames}`,
              code: 'HAS_CHILDREN'
            },
            { status: 409 }
          )
        }

        // Проверяем наличие связанных характеристик в product_characteristics_simple
        const characteristicsCheck = await client.query(`
          SELECT
            COUNT(*) as count,
            COUNT(DISTINCT p.id) as product_count,
            array_agg(DISTINCT p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL) as product_names
          FROM product_characteristics_simple pc
          JOIN characteristics_values_simple cv ON cv.id = pc.value_id
          LEFT JOIN products p ON pc.product_id = p.id
          WHERE cv.group_id = $1
        `, [parseInt(id)])

        const characteristicsCount = parseInt(characteristicsCheck.rows[0].count)
        const productCount = parseInt(characteristicsCheck.rows[0].product_count)

        if (characteristicsCount > 0) {
          const productNames = characteristicsCheck.rows[0].product_names || []
          const productList = productNames.length > 5
            ? productNames.slice(0, 5).join(', ') + ` и еще ${productNames.length - 5}...`
            : productNames.join(', ')

          client.release()
          return NextResponse.json(
            {
              error: `Невозможно удалить группу "${groupName}"`,
              details: `Группа используется в ${characteristicsCount} характеристиках у ${productCount} товаров${productList ? ': ' + productList : ''}`,
              code: 'HAS_CHARACTERISTICS',
              stats: {
                characteristicsCount,
                productCount,
                products: productNames.length <= 10 ? productNames : productNames.slice(0, 10)
              }
            },
            { status: 409 }
          )
        }
      } else {
        // Принудительное удаление - удаляем каскадно

        // Сначала удаляем все характеристики товаров, связанные с этой группой
        const deletedCharacteristics = await client.query(`
          DELETE FROM product_characteristics_simple
          WHERE value_id IN (
            SELECT id FROM characteristics_values_simple WHERE group_id = $1
          )
          RETURNING id
        `, [parseInt(id)])

        // Затем рекурсивно удаляем все дочерние группы
        const deleteChildrenRecursively = async (parentId: number) => {
          const children = await client.query(
            'SELECT id, name FROM characteristics_groups_simple WHERE parent_id = $1',
            [parentId]
          )

          for (const child of children.rows) {
// Рекурсивно удаляем детей этого ребенка
            await deleteChildrenRecursively(child.id)

            // Удаляем характеристики товаров дочерней группы
            await client.query(`
              DELETE FROM product_characteristics_simple
              WHERE value_id IN (
                SELECT id FROM characteristics_values_simple WHERE group_id = $1
              )
            `, [child.id])

            // Удаляем enum значения дочерней группы
            await client.query('DELETE FROM characteristics_values_simple WHERE group_id = $1', [child.id])

            // Удаляем дочернюю группу
            await client.query('DELETE FROM characteristics_groups_simple WHERE id = $1', [child.id])
          }
        }

        await deleteChildrenRecursively(parseInt(id))
      }

      // Удаляем enum значения основной группы
      const valuesCheck = await client.query(
        'SELECT COUNT(*) as count FROM characteristics_values_simple WHERE group_id = $1',
        [parseInt(id)]
      )

      const valuesCount = parseInt(valuesCheck.rows[0].count)
      if (valuesCount > 0) {

        await client.query('DELETE FROM characteristics_values_simple WHERE group_id = $1', [parseInt(id)])

      }

      // Удаляем основную группу

      const result = await client.query(
        'DELETE FROM characteristics_groups_simple WHERE id = $1 RETURNING *',
        [parseInt(id)]
      )

client.release()

      return NextResponse.json({
        success: true,
        message: force
          ? `Группа "${groupName}" принудительно удалена со всеми связанными данными`
          : `Группа "${groupName}" удалена`,
        data: result.rows[0]
      })

    } catch (innerError) {
      client.release()
      throw innerError
    }

  } catch (error) {
    console.error('❌ Ошибка удаления группы характеристик:', error)

    // Проверяем нарушение внешних ключей
    if ((error as any).code === '23503') {
      const detail = (error as any).detail || ''

      // Извлекаем информацию из detail сообщения
      const match = detail.match(/Key \(id\)=\((\d+)\) is still referenced from table "(\w+)"/)
      const constraintInfo = match ? `ID ${match[1]} используется в таблице "${match[2]}"` : 'существуют связанные записи'

      return NextResponse.json(
        {
          error: 'Невозможно удалить группу',
          details: `Группа все еще используется в базе данных (${constraintInfo}). Сначала удалите все связанные записи.`,
          code: 'FOREIGN_KEY_CONSTRAINT'
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: 'Ошибка удаления группы характеристик',
        details: error instanceof Error ? error.message : 'Неизвестная ошибка'
      },
      { status: 500 }
    )
  }
}