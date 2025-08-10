import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';
import { guardDbOr503Fast, tablesExist } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

function isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

/**
 * UNIFIED CHARACTERISTICS API
 * Использует реальные таблицы БД и создает ту же структуру разделов,
 * что и в API редактирования товара
 */

export async function GET(request: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const fast = guardDbOr503Fast()
    if (fast) return fast

    const need = await tablesExist(['characteristics_groups_simple','characteristics_values_simple'])
    if (!need.characteristics_groups_simple || !need.characteristics_values_simple) {
      return NextResponse.json({ success: false, error: 'Characteristics schema is not initialized' }, { status: 503 })
    }

    const pool = getPool();

    const valuesQuery = `
      SELECT
        g.id as group_id,
        g.name as group_name,
        g.sort_order as group_sort_order,
        g.is_section,
        g.parent_id,
        g.description,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', v.id,
              'value', v.value,
              'color_hex', v.color_hex,
              'sort_order', v.sort_order,
              'description', v.description,
              'is_active', v.is_active
            ) ORDER BY v.sort_order, v.value
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'::json
        ) as values
      FROM characteristics_groups_simple g
      LEFT JOIN characteristics_values_simple v ON g.id = v.group_id AND v.is_active = true
      WHERE g.is_active = true
      GROUP BY g.id, g.name, g.sort_order, g.is_section, g.parent_id, g.description
      ORDER BY g.sort_order, g.name
    `;

    const valuesResult = await pool.query(valuesQuery);

    const createSections = (availableGroups: any[]) => {
      const sectionMap = new Map();
      const processedGroups = new Set();

      availableGroups.forEach(group => {
        if (group.is_section) {
          const childGroups: any[] = [];
          availableGroups.forEach(childGroup => {
            if (childGroup.group_id !== group.group_id &&
                !childGroup.is_section &&
                childGroup.parent_id === group.group_id) {
              childGroups.push({
                group_id: childGroup.group_id,
                group_name: childGroup.group_name,
                group_ordering: childGroup.group_sort_order,
                values: childGroup.values || []
              });
              processedGroups.add(childGroup.group_id);
            }
          });

          sectionMap.set(group.group_id, {
            section_id: group.group_id,
            section_name: group.group_name,
            section_ordering: group.group_sort_order || 0,
            section_description: group.description || '',
            groups: childGroups.sort((a, b) => (a.group_ordering || 999) - (b.group_ordering || 999)),
            is_real_section: true
          });

          processedGroups.add(group.group_id);
        }
      });

      const uncategorizedGroups: any[] = [];
      availableGroups.forEach(group => {
        if (!processedGroups.has(group.group_id) && !group.is_section) {
          uncategorizedGroups.push({
            group_id: group.group_id,
            group_name: group.group_name,
            group_ordering: group.group_sort_order,
            values: group.values || []
          });
        }
      });

      if (uncategorizedGroups.length > 0) {
        sectionMap.set(999999, {
          section_id: 999999,
          section_name: 'Дополнительные характеристики',
          section_ordering: 999999,
          section_description: 'Прочие характеристики и дополнительные сведения',
          groups: uncategorizedGroups.sort((a, b) => (a.group_ordering || 999) - (b.group_ordering || 999)),
          is_real_section: false
        });
      }

      return Array.from(sectionMap.values()).sort((a, b) => a.section_ordering - b.section_ordering);
    };

    const sections = createSections(valuesResult.rows);

    return NextResponse.json({
      success: true,
      data: {
        sections: sections,
        available_characteristics: valuesResult.rows,
        groups: valuesResult.rows,
        total_groups: valuesResult.rows.length,
        total_sections: sections.length
      }
    });

  } catch (error) {
    console.error('❌ Database error in characteristics GET:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch characteristics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Создать новую группу характеристик
export async function POST(request: NextRequest) {

  try {
    const body = await request.json();

    const {
      name,
      description,
      parent_id,
      sort_order,
      show_in_main_params,
      main_params_priority,
      is_section
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Название группы обязательно' },
        { status: 400 }
      );
    }

    const pool = getPool();

    // Валидация: если создаем группу характеристик (не раздел),
    // то parent_id должен указывать на раздел, а не на группу
    if (!is_section && parent_id) {

      const parentCheck = await pool.query(
        'SELECT id, name, is_section FROM characteristics_groups_simple WHERE id = $1',
        [parent_id]
      );

      if (parentCheck.rows.length === 0) {

        return NextResponse.json(
          { success: false, error: 'Родительский элемент не найден' },
          { status: 400 }
        );
      }

      const parent = parentCheck.rows[0]

      if (!parent.is_section) {

        return NextResponse.json(
          { success: false, error: 'Группы характеристик можно создавать только в разделах, а не в других группах' },
          { status: 400 }
        );
      }

    }

    // Создаем группу характеристик в упрощенной системе
    const result = await pool.query(
      `INSERT INTO characteristics_groups_simple (
        name,
        description,
        parent_id,
        sort_order,
        show_in_main_params,
        main_params_priority,
        is_section,
        is_active,
        created_at,
        updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        parent_id || null,
        sort_order || 0,
        show_in_main_params || false,
        main_params_priority || null,
        is_section || false
      ]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Группа характеристик создана успешно'
    });

  } catch (error) {
    console.error('❌ Error creating characteristic group:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка создания группы характеристик' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID характеристики обязателен' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      name,
      description,
      sort_order,
      show_in_main_params,
      main_params_priority,
      enum_values,
      parent_id
    } = body

    const pool = getPool()

    // Если обновляем только parent_id (drag and drop)
    if (parent_id !== undefined && (!name || name.trim() === '')) {

      const result = await pool.query(`
        UPDATE characteristics_groups_simple
        SET
          parent_id = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [
        parent_id || null,
        parseInt(id)
      ])

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Группа не найдена' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: result.rows[0],
        message: 'Группа перемещена успешно'
      })
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Название характеристики обязательно' },
        { status: 400 }
      )
    }

    // Обновляем группу полностью
    const result = await pool.query(`
      UPDATE characteristics_groups_simple
      SET
        name = $1,
        description = $2,
        sort_order = $3,
        show_in_main_params = $4,
        main_params_priority = $5,
        parent_id = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [
      name.trim(),
      description || null,
      sort_order || 0,
      show_in_main_params || false,
      main_params_priority || null,
      parent_id || null,
      parseInt(id)
    ])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Характеристика не найдена' },
        { status: 404 }
      )
    }

    // Если переданы enum значения, обновляем их
    if (enum_values && Array.isArray(enum_values)) {

      // Удаляем старые значения
      await pool.query('DELETE FROM characteristics_values_simple WHERE group_id = $1', [parseInt(id)])

      // Создаем новые значения
      for (let i = 0; i < enum_values.length; i++) {
        const enumValue = enum_values[i]
        await pool.query(`
          INSERT INTO characteristics_values_simple (
            group_id, value, color_hex, sort_order, is_active
          )
          VALUES ($1, $2, $3, $4, true)
        `, [
          parseInt(id),
          enumValue.value || enumValue.name,
          enumValue.color_hex || null,
          i
        ])
      }
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('❌ Error updating characteristic:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления характеристики', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const force = searchParams.get('force') === 'true'

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID характеристики обязателен' },
        { status: 400 }
      )
    }

const pool = getPool()

    // Проверяем существование группы
    const checkResult = await pool.query(
      'SELECT id, name FROM characteristics_groups_simple WHERE id = $1',
      [parseInt(id)]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    const groupName = checkResult.rows[0].name
if (!force) {
      // Проверяем наличие дочерних групп
      const childrenCheck = await pool.query(
        'SELECT COUNT(*) as count, array_agg(name) as names FROM characteristics_groups_simple WHERE parent_id = $1 AND is_active = true',
        [parseInt(id)]
      )

      const childrenCount = parseInt(childrenCheck.rows[0].count)
      if (childrenCount > 0) {
        const childrenNames = childrenCheck.rows[0].names.join(', ')

        return NextResponse.json(
          {
            success: false,
            error: `Невозможно удалить группу "${groupName}"`,
            details: `Сначала удалите ${childrenCount} дочерних групп: ${childrenNames}`,
            code: 'HAS_CHILDREN'
          },
          { status: 409 }
        )
      }

      // Проверяем, используется ли в характеристиках товаров
      const usageCheck = await pool.query(`
        SELECT
          COUNT(*) as count,
          COUNT(DISTINCT p.id) as product_count
        FROM product_characteristics_simple pc
        JOIN characteristics_values_simple cv ON pc.value_id = cv.id
        LEFT JOIN products p ON pc.product_id = p.id
        WHERE cv.group_id = $1
      `, [parseInt(id)])

      const characteristicsCount = parseInt(usageCheck.rows[0].count)
      const productCount = parseInt(usageCheck.rows[0].product_count)

      if (characteristicsCount > 0) {

        return NextResponse.json(
          {
            success: false,
            error: `Невозможно удалить группу "${groupName}"`,
            details: `Группа используется в ${characteristicsCount} характеристиках у ${productCount} товаров`,
            code: 'HAS_CHARACTERISTICS',
            stats: {
              characteristicsCount,
              productCount
            }
          },
          { status: 409 }
        )
      }
    } else {
      // Принудительное удаление - удаляем каскадно

      // Функция для получения всех дочерних групп рекурсивно
      const getAllChildren = async (parentId: number): Promise<number[]> => {
        const childrenResult = await pool.query(`
          SELECT id FROM characteristics_groups_simple
          WHERE parent_id = $1 AND is_active = true
        `, [parentId])

        let allChildIds: number[] = []

        for (const child of childrenResult.rows) {
          allChildIds.push(child.id)
          // Рекурсивно получаем детей этого ребенка
          const grandChildIds = await getAllChildren(child.id)
          allChildIds = allChildIds.concat(grandChildIds)
        }

        return allChildIds
      }

      // Получаем все дочерние группы
      const childGroupIds = await getAllChildren(parseInt(id))
      const allGroupIds = [parseInt(id), ...childGroupIds]

// Удаляем все характеристики товаров, связанные с значениями всех групп
      const deletedCharacteristics = await pool.query(`
        DELETE FROM product_characteristics_simple
        WHERE value_id IN (
          SELECT id FROM characteristics_values_simple WHERE group_id = ANY($1)
        )
        RETURNING id
      `, [allGroupIds])

      // Удаляем все значения характеристик для всех групп
      const deletedValues = await pool.query(
        'DELETE FROM characteristics_values_simple WHERE group_id = ANY($1) RETURNING id',
        [allGroupIds]
      )

      // Помечаем все дочерние группы как неактивные
      if (childGroupIds.length > 0) {
        const deletedChildren = await pool.query(`
          UPDATE characteristics_groups_simple
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1)
          RETURNING id, name
        `, [childGroupIds])

      }
    }

    // Удаляем значения характеристик только если не было принудительного удаления
    if (!force) {
      const valuesResult = await pool.query(
        'DELETE FROM characteristics_values_simple WHERE group_id = $1 RETURNING id',
        [parseInt(id)]
      )

    }

    // Помечаем основную группу как неактивную

    const result = await pool.query(`
      UPDATE characteristics_groups_simple
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name
    `, [parseInt(id)])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Характеристика не найдена' },
        { status: 404 }
      )
    }

return NextResponse.json({
      success: true,
      message: force
        ? `Группа "${groupName}" принудительно удалена со всеми связанными данными`
        : `Группа "${groupName}" удалена`,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('❌ Error deleting characteristic:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка удаления характеристики',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}