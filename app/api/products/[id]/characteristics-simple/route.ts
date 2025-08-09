import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';
import { requireAuth, hasPermission } from '@/lib/database-auth';

/**
 * SIMPLIFIED CHARACTERISTICS API - МАКСИМАЛЬНАЯ ЭФФЕКТИВНОСТЬ
 * Заменяет 5+ переусложненных API эндпоинтов одним простым
 *
 * GET - получить характеристики продукта
 * POST - сохранить характеристики продукта
 * PUT - обновить характеристики продукта
 * DELETE - удалить характеристики продукта
 */

// GET /api/products/[id]/characteristics-simple - получить характеристики продукта из упрощенной системы
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = parseInt(params.id);

  try {
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'Неверный ID товара' },
        { status: 400 }
      );
    }

    const pool = getPool();

    // Получаем характеристики продукта из упрощенной системы и группируем их логически
    const productCharacteristics = await pool.query(`
      SELECT
        g.id as group_id,
        g.name as group_name,
        g.sort_order as group_sort_order,
        v.id as value_id,
        v.value as value_name,
        v.color_hex,
        v.sort_order as value_sort_order,
        pc.additional_value,
        pc.created_at,
        pc.updated_at
      FROM product_characteristics_simple pc
      JOIN characteristics_values_simple v ON pc.value_id = v.id
      JOIN characteristics_groups_simple g ON v.group_id = g.id
      WHERE pc.product_id = $1
      ORDER BY g.sort_order, v.sort_order
    `, [productId]);

    // Получаем все характеристики используя ту же логику что и на странице характеристик
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
              'is_active', v.is_active,
              'is_selected', CASE WHEN pc.product_id IS NOT NULL THEN true ELSE false END
            ) ORDER BY v.sort_order, v.value
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'::json
        ) as values
      FROM characteristics_groups_simple g
      LEFT JOIN characteristics_values_simple v ON g.id = v.group_id AND v.is_active = true
      LEFT JOIN product_characteristics_simple pc ON (v.id = pc.value_id AND pc.product_id = $1)
      WHERE g.is_active = true
      GROUP BY g.id, g.name, g.sort_order, g.is_section, g.parent_id, g.description
      ORDER BY g.sort_order, g.name
    `;

    const availableCharacteristics = await pool.query(valuesQuery, [productId]);

    // Используем ту же логику создания разделов что и в /api/characteristics
    const createSections = (availableGroups: any[]) => {
      const sectionMap = new Map();
      const processedGroups = new Set(); // Отслеживаем обработанные группы

      // 1. Создаем реальные разделы из БД (is_section=true)
      availableGroups.forEach(group => {
        if (group.is_section) {
          // Находим дочерние группы для этого раздела
          const childGroups: any[] = [];
          availableGroups.forEach(childGroup => {
            if (childGroup.group_id !== group.group_id && // Не сам раздел
                !childGroup.is_section && // Не раздел
                childGroup.parent_id === group.group_id) { // Прямые дочерние группы
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

          processedGroups.add(group.group_id); // Помечаем раздел как обработанный
        }
      });

      // 2. Помещаем оставшиеся группы без раздела в "Дополнительные характеристики"
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

    // Создаем разделы используя ту же логику что и на странице характеристик
    let sections = createSections(availableCharacteristics.rows);

    // Заполняем разделы выбранными характеристиками товара для отображения на странице продукта
    const selectedCharsByGroup = productCharacteristics.rows.reduce((acc: any, char: any) => {
      if (!acc[char.group_id]) {
        acc[char.group_id] = [];
      }
      acc[char.group_id].push({
        value_id: char.value_id,
        value_name: char.value_name,
        group_id: char.group_id,
        additional_value: char.additional_value || '',
        color_hex: char.color_hex
      });
      return acc;
    }, {});

    // Добавляем выбранные характеристики в каждую группу каждого раздела
    sections = sections.map((section: any) => ({
      ...section,
      groups: section.groups.map((group: any) => ({
        ...group,
        characteristics: selectedCharsByGroup[group.group_id] || []
      }))
    }));

    // Создаем структуру selected_characteristics для компонента CompactCharacteristics
    const selectedCharacteristicsForCompact = productCharacteristics.rows.reduce((groups: any[], char: any) => {
      let existingGroup = groups.find(g => g.group_id === char.group_id);
      if (!existingGroup) {
        existingGroup = {
          group_id: char.group_id,
          group_name: char.group_name,
          characteristics: []
        };
        groups.push(existingGroup);
      }

      existingGroup.characteristics.push({
        value_id: char.value_id,
        value_name: char.value_name,
        group_id: char.group_id,
        additional_value: char.additional_value || '',
        color_hex: char.color_hex
      });

      return groups;
    }, []);

    return NextResponse.json({
      success: true,
      data: {
        sections: sections,
        selected_characteristics: selectedCharacteristicsForCompact,
        available_characteristics: availableCharacteristics.rows,
        product_id: productId
      }
    });

  } catch (error) {
    console.error('❌ Error loading product characteristics:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки характеристик товара' },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/characteristics-simple - сохранить характеристики продукта
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = parseInt(params.id);

  try {
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'Неверный ID товара' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { characteristics } = body;

    if (!Array.isArray(characteristics)) {
      return NextResponse.json(
        { success: false, error: 'Ожидается массив характеристик' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query('BEGIN');

    try {
      // Удаляем все существующие характеристики товара
      await pool.query(`
        DELETE FROM product_characteristics_simple
        WHERE product_id = $1
      `, [productId]);

      const savedCharacteristics = [];

      // Добавляем новые характеристики
      for (const char of characteristics) {
        const { value_id, additional_value } = char;

        if (!value_id) {
          console.warn('Пропускаем характеристику без value_id:', char);
          continue;
        }

        // Проверяем существование value_id
        const valueCheck = await pool.query(
          'SELECT id FROM characteristics_values_simple WHERE id = $1',
          [value_id]
        );

        if (valueCheck.rows.length === 0) {
          console.warn(`Пропускаем несуществующий value_id: ${value_id}`);
          continue;
        }

        // Вставляем характеристику
        const result = await pool.query(`
          INSERT INTO product_characteristics_simple (product_id, value_id, additional_value)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [productId, value_id, additional_value || null]);

        savedCharacteristics.push(result.rows[0]);
      }

      await pool.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: {
          product_id: productId,
          saved_characteristics: savedCharacteristics,
          total_saved: savedCharacteristics.length
        }
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Ошибка сохранения характеристик (упрощенная система):', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сохранения характеристик', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id]/characteristics-simple - обновить характеристики продукта (UPSERT)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = parseInt(params.id);

  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.update') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'Неверный ID товара' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { characteristics } = body;

    if (!Array.isArray(characteristics)) {
      return NextResponse.json(
        { success: false, error: 'Ожидается массив характеристик' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query('BEGIN');

    try {
      // Сначала удаляем все существующие характеристики товара
      await pool.query(`
        DELETE FROM product_characteristics_simple
        WHERE product_id = $1
      `, [productId]);

      const updatedCharacteristics = [];

      // Затем добавляем новые характеристики
      for (const char of characteristics) {
        const { value_id, value_name, group_name, additional_value } = char;

        if (!value_id) {
          console.warn('⚠️ Пропускаем характеристику без value_id:', char);
          continue;
        }

        let finalValueId = value_id;

        // Проверяем, является ли value_id временным (отрицательное число)
        const isTemporaryId = value_id < 0;

        if (isTemporaryId) {

          if (!value_name || !group_name) {
            console.warn('⚠️ Пропускаем временную характеристику без value_name или group_name:', char);
            continue;
          }

          // Сначала найдем или создадим группу
          let groupResult = await pool.query(
            'SELECT id FROM characteristics_groups_simple WHERE name = $1',
            [group_name]
          );

          let groupId;
          if (groupResult.rows.length === 0) {
            // Создаем новую группу
            const newGroupResult = await pool.query(
              'INSERT INTO characteristics_groups_simple (name) VALUES ($1) RETURNING id',
              [group_name]
            );
            groupId = newGroupResult.rows[0].id;
          } else {
            groupId = groupResult.rows[0].id;
          }

          // Теперь создаем новое значение характеристики
          const newValueResult = await pool.query(
            'INSERT INTO characteristics_values_simple (group_id, value) VALUES ($1, $2) RETURNING id',
            [groupId, value_name]
          );
          finalValueId = newValueResult.rows[0].id;
        } else {
          // Проверяем существование обычного value_id
          const valueCheck = await pool.query(
            'SELECT id FROM characteristics_values_simple WHERE id = $1',
            [value_id]
          );

          if (valueCheck.rows.length === 0) {
            console.warn(`⚠️ Пропускаем несуществующий value_id: ${value_id}`);
            continue;
          }
        }

        // Вставляем характеристику с финальным value_id
        const result = await pool.query(`
          INSERT INTO product_characteristics_simple (product_id, value_id, additional_value)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [productId, finalValueId, additional_value || null]);

        updatedCharacteristics.push(result.rows[0]);
      }

      await pool.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: {
          product_id: productId,
          updated_characteristics: updatedCharacteristics,
          total_updated: updatedCharacteristics.length
        }
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Ошибка обновления характеристик (упрощенная система):', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления характеристик', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id]/characteristics-simple - удалить характеристики продукта
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = parseInt(params.id);

  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.update') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'Неверный ID товара' },
        { status: 400 }
      );
    }

    const pool = getPool();

    // Удаляем все характеристики товара
    const result = await pool.query(`
      DELETE FROM product_characteristics_simple
      WHERE product_id = $1
      RETURNING *
    `, [productId]);

    return NextResponse.json({
      success: true,
      data: {
        product_id: productId,
        deleted_count: result.rows.length
      }
    });

  } catch (error) {
    console.error('❌ Ошибка удаления характеристик (упрощенная система):', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления характеристик', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}