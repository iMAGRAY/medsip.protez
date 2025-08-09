import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';
import { requireAuth, hasPermission } from '@/lib/database-auth';

// GET /api/products/[id]/characteristics - получить характеристики товара из EAV системы
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

    // Используем только старую систему, так как новая таблица не существует

    const oldSystemQuery = `
      SELECT
        pc.id,
        pc.product_id,
        pc.value_id,
        pc.additional_value,
        pc.numeric_value,
        pc.is_primary,
        -- Информация о значении
        cv.id AS value_id_full,
        cv.group_id,
        cv.value,
        cv.color_hex,
        -- Информация о группе
        cg.id AS group_id_full,
        cg.name AS group_name,
        cg.description AS group_description,
        cg.sort_order AS group_ordering,
        cg.show_in_main_params,
        cg.main_params_priority,
        cg.parent_id AS group_parent_id,
        cg.is_section
      FROM product_characteristics_simple pc
      JOIN characteristics_values_simple cv ON cv.id = pc.value_id
      JOIN characteristics_groups_simple cg ON cg.id = cv.group_id
      WHERE pc.product_id = $1
        AND cg.is_active = true
      ORDER BY
        COALESCE(cg.sort_order, 999),
        COALESCE(cg.main_params_priority, 999),
        cv.value
    `;

    const oldSystemResult = await pool.query(oldSystemQuery, [productId]);

    return formatOldCharacteristics(oldSystemResult.rows, productId);

  } catch (error) {
    console.error('❌ Ошибка получения характеристик товара:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения характеристик товара', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Функция для форматирования характеристик из новой EAV системы
function formatEAVCharacteristics(rows: any[], productId: number) {
  const groupedCharacteristics: any = {};

  rows.forEach((row: any) => {
    if (!groupedCharacteristics[row.group_id]) {
      groupedCharacteristics[row.group_id] = {
        group_id: row.group_id,
        group_name: row.group_name,
        group_description: row.group_description,
        group_ordering: row.group_ordering,
        show_in_main_params: row.show_in_main_params,
        main_params_priority: row.main_params_priority,
        main_params_label_override: row.main_params_label_override,
        characteristics: []
      };
    }

    // Определяем отображаемое значение
    let displayValue = 'Не указано';
    let actualValue = null;

    if (row.enum_value_id) {
      // ✅ РАСШИРЕННАЯ ЛОГИКА ДЛЯ ENUM ЗНАЧЕНИЙ
      if (row.enum_display_name && row.enum_display_name.trim()) {
        displayValue = row.enum_display_name.trim();
        actualValue = row.enum_display_name.trim();
      } else if (row.enum_display_value && row.enum_display_value.trim()) {
        displayValue = row.enum_display_value.trim();
        actualValue = row.enum_display_value.trim();
      } else {
        // Если enum значение не найдено в джойне, используем template_name как значение
        displayValue = row.template_name || `Enum ID: ${row.enum_value_id}`;
        actualValue = displayValue;
      }
    } else if (row.bool_value !== null) {
      // Булево значение
      displayValue = row.bool_value ? 'Да' : 'Нет';
      actualValue = row.bool_value;
    } else if (row.numeric_value !== null) {
      // Числовое значение
      displayValue = row.numeric_value.toString();
      if (row.unit_code) {
        displayValue += ` ${row.unit_code}`;
      }
      actualValue = row.numeric_value;
    } else if (row.raw_value) {
      // Текстовое значение
      displayValue = row.raw_value;
      actualValue = row.raw_value;
    } else if (row.date_value) {
      // Дата
      displayValue = new Date(row.date_value).toLocaleDateString('ru-RU');
      actualValue = row.date_value;
    }

    // Создаем уникальный ID для каждой характеристики, включая enum_value_id для enum характеристик
    let uniqueId: string;
    if (row.enum_value_id) {
      uniqueId = `eav-${row.variant_id}-${row.template_id}-enum-${row.enum_value_id}`;
    } else {
      uniqueId = `eav-${row.variant_id}-${row.template_id}-text`;
    }

    groupedCharacteristics[row.group_id].characteristics.push({
      id: uniqueId,
      label: row.template_name,
      type: row.input_type || 'text',
      display_value: displayValue,
      actual_value: actualValue,
      raw_value: row.raw_value,
      numeric_value: row.numeric_value,
      bool_value: row.bool_value,
      date_value: row.date_value,
      file_url: row.file_url,
      enum_value_id: row.enum_value_id,
      enum_color_hex: row.enum_color_hex,
      unit_code: row.unit_code,
      unit_name: row.unit_name,
      template_id: row.template_id,
      variant_id: row.variant_id,
      source: 'eav_system',
      // ✅ ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ ДЛЯ ОТЛАДКИ
      enum_value: row.enum_display_value,
      found_enum_id: row.found_enum_id
    });
  });

  const formattedResult = Object.values(groupedCharacteristics);

  return NextResponse.json({
    success: true,
    data: {
      characteristics: formattedResult,
      product_data: {},
      system: 'eav_unified',
      total_characteristics: rows.length,
      total_groups: formattedResult.length
    }
  });
}

// Функция для форматирования характеристик из старой системы (fallback)
function formatOldCharacteristics(rows: any[], productId: number) {
  const groupedCharacteristics: any = {};

  rows.forEach((row: any) => {
    if (!groupedCharacteristics[row.group_id]) {
      groupedCharacteristics[row.group_id] = {
        group_id: row.group_id,
        group_name: row.group_name,
        group_description: row.group_description,
        group_ordering: row.group_ordering,
        show_in_main_params: row.show_in_main_params,
        main_params_priority: row.main_params_priority,
        main_params_label_override: row.main_params_label_override,
        characteristics: []
      };
    }

    // Определяем отображаемое значение (логика из старой системы)
    let displayValue = 'Не указано';
    let actualValue = null;

    if (row.numeric_value !== null) {
      displayValue = row.numeric_value.toString();
      actualValue = row.numeric_value;
    } else if (row.additional_value) {
      displayValue = row.additional_value;
      actualValue = row.additional_value;
    } else if (row.value) {
      displayValue = row.value;
      actualValue = row.value;
    }

    groupedCharacteristics[row.group_id].characteristics.push({
      id: row.id,
      label: row.value || 'Характеристика',
      type: 'text',
      display_value: displayValue,
      actual_value: actualValue,
      value_id: row.value_id,
      enum_value_id: row.value_id, // Для совместимости с конфигурируемыми характеристиками
      value_name: row.value, // Для ProductConfigurationSelector
      group_id: row.group_id, // Для ProductConfigurationSelector
      group_name: row.group_name, // Для ProductConfigurationSelector
      additional_value: row.additional_value,
      numeric_value: row.numeric_value,
      color_hex: row.color_hex,
      is_primary: row.is_primary,
      source: 'legacy_system'
    });
  });

  const formattedResult = Object.values(groupedCharacteristics);

  return NextResponse.json({
    success: true,
    data: {
      characteristics: formattedResult,
      product_data: {},
      system: 'legacy_product_characteristics',
      total_characteristics: rows.length,
      total_groups: formattedResult.length
    }
  });
}

export async function POST(
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
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const pool = getPool();

    let body: any = {};
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Ошибка парсинга JSON:', error);
      return NextResponse.json({
        error: 'Invalid JSON in request body'
      }, { status: 400 });
    }

    // Поддерживаем новый формат с вариантами
    if (body.variant_characteristics && Array.isArray(body.variant_characteristics)) {
      const savedCharacteristics = [];

      for (const variantData of body.variant_characteristics) {
        let { variant_id, characteristics } = variantData;

        if (!variant_id || !characteristics || !Array.isArray(characteristics)) {
          console.warn('Пропускаем невалидные данные варианта:', variantData);
          continue;
        }

        // Проверяем что вариант принадлежит данному продукту, если нет - создаем базовый вариант
        let variantCheck = await pool.query(
          'SELECT id FROM product_variants WHERE id = $1 AND master_id = $2',
          [variant_id, productId]
        );

        if (variantCheck.rows.length === 0) {

          // Создаем базовый вариант продукта если он не существует
          try {
            // Проверяем, есть ли уже какой-либо вариант для данного продукта
            const existingVariantResult = await pool.query(
              'SELECT id FROM product_variants WHERE master_id = $1 LIMIT 1',
              [productId]
            );

            if (existingVariantResult.rows.length > 0) {
              // Используем существующий вариант
              const existingVariantId = existingVariantResult.rows[0].id;

              // Обновляем variant_id для дальнейшего использования
              variant_id = existingVariantId;
            } else {
              // Создаем новый базовый вариант с автоинкрементным ID
              const createVariantResult = await pool.query(
                'INSERT INTO product_variants (master_id, sku, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
                [productId, `BASE-${productId}`]
              );

              if (createVariantResult.rows.length > 0) {
                const newVariantId = createVariantResult.rows[0].id;

                // Обновляем variant_id для дальнейшего использования
                variant_id = newVariantId;
              } else {
                console.error(`❌ Не удалось создать базовый вариант для продукта ${productId}`);
                continue;
              }
            }
          } catch (createError) {
            console.error(`❌ Ошибка создания базового варианта:`, createError);
            continue;
          }
        }

        // 🚀 НОВАЯ СИСТЕМА: UPSERT + ЯВНОЕ УДАЛЕНИЕ

        // Обрабатываем явные удаления (если есть)
        if (variantData.to_delete && Array.isArray(variantData.to_delete)) {

          for (const deleteItem of variantData.to_delete) {
            const { template_id, enum_value_id } = deleteItem;

            let deleteQuery;
            let deleteParams;

            if (enum_value_id) {
              deleteQuery = 'DELETE FROM product_characteristics_new WHERE variant_id = $1 AND template_id = $2 AND enum_value_id = $3';
              deleteParams = [variant_id, template_id, enum_value_id];
            } else {
              deleteQuery = 'DELETE FROM product_characteristics_new WHERE variant_id = $1 AND template_id = $2 AND enum_value_id IS NULL';
              deleteParams = [variant_id, template_id];
            }

            try {
              const deleteResult = await pool.query(deleteQuery, deleteParams);

            } catch (deleteError) {
              console.error(`❌ Ошибка удаления характеристики:`, deleteError);
            }
          }
        }

        // Дедуплицируем характеристики для сохранения
        const deduplicatedCharacteristics = [];
        const seenKeys = new Set();

        for (const char of characteristics) {
          let uniqueKey: string;
          if (char.enum_value_id) {
            uniqueKey = `${char.template_id}_enum_${char.enum_value_id}`;
          } else {
            uniqueKey = `${char.template_id}_text`;
          }

          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            deduplicatedCharacteristics.push(char);
          }
        }

        // 🚀 ИСПОЛЬЗУЕМ UPSERT ДЛЯ ВСЕХ ХАРАКТЕРИСТИК
                for (let charIndex = 0; charIndex < deduplicatedCharacteristics.length; charIndex++) {
          const char = deduplicatedCharacteristics[charIndex];
          const {
            raw_value,
            numeric_value,
            bool_value,
            date_value,
            file_url,
            enum_value_id
          } = char;

          // Используем let для template_id чтобы можно было переназначить
          let template_id = char.template_id;

          if (!template_id) {
            console.warn('❌ Пропускаем характеристику без template_id:', char);
            continue;
          }

          // Проверяем существование шаблона

          let templateCheck = await pool.query(
            'SELECT id, input_type FROM characteristic_templates WHERE id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)',
            [template_id]
          );

          // Если шаблон не найден, проверяем, может ли это быть group_id
          if (templateCheck.rows.length === 0) {

            const groupCheck = await pool.query(
              'SELECT id, name FROM characteristics_groups_simple WHERE id = $1 AND is_active = true',
              [template_id]
            );

            if (groupCheck.rows.length > 0) {
              const group = groupCheck.rows[0];

              // Создаем базовый шаблон для группы
              try {
                // Сначала проверяем, есть ли уже шаблон для этой группы
                const existingTemplateResult = await pool.query(
                  'SELECT id, input_type FROM characteristic_templates WHERE group_id = $1 LIMIT 1',
                  [template_id]
                );

                let createTemplateResult;
                if (existingTemplateResult.rows.length > 0) {
                  // Используем существующий шаблон

                  createTemplateResult = existingTemplateResult;
                } else {
                  // Создаем новый шаблон
                  createTemplateResult = await pool.query(`
                    INSERT INTO characteristic_templates (
                      group_id, name, key, input_type, is_required, sort_order, is_template, created_at, updated_at
                    ) VALUES ($1, $2, $3, 'enum', false, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id, input_type
                  `, [template_id, `${group.name} (автошаблон)`, `auto_template_group_${template_id}`]);
                }

                if (createTemplateResult.rows.length > 0) {

                  // Обновляем template_id на созданный шаблон
                  template_id = createTemplateResult.rows[0].id;
                  templateCheck = createTemplateResult;
                } else {
                  console.warn(`❌ Не удалось создать базовый шаблон для группы ${template_id}`);
                  continue;
                }
              } catch (createError) {
                console.error(`❌ Ошибка создания базового шаблона для группы ${template_id}:`, createError);
                continue;
              }
            } else {
              console.warn(`❌ Группа ${template_id} не найдена или неактивна`);
              continue;
            }
          }

          // 🚀 ИСПОЛЬЗУЕМ UPSERT ДЛЯ КОРРЕКТНОГО ОБНОВЛЕНИЯ/ВСТАВКИ
          try {
            let upsertResult;

            if (enum_value_id) {
              // Enum-характеристика: уникальность по (variant_id, template_id, COALESCE(enum_value_id, -1))
              upsertResult = await pool.query(`
                INSERT INTO product_characteristics_new (
                  variant_id, template_id, enum_value_id, raw_value, numeric_value,
                  bool_value, date_value, file_url, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (variant_id, template_id, COALESCE(enum_value_id, -1))
                DO UPDATE SET
                  raw_value = EXCLUDED.raw_value,
                  numeric_value = EXCLUDED.numeric_value,
                  bool_value = EXCLUDED.bool_value,
                  date_value = EXCLUDED.date_value,
                  file_url = EXCLUDED.file_url,
                  updated_at = CURRENT_TIMESTAMP
                RETURNING *
              `, [
                variant_id,
                template_id,
                enum_value_id,
                raw_value || null,
                numeric_value || null,
                bool_value || null,
                date_value || null,
                file_url || null
              ]);
            } else {
              // Текстовая характеристика: используем DELETE + INSERT для NULL enum_value_id
              // Сначала удаляем существующую запись
              await pool.query(`
                DELETE FROM product_characteristics_new
                WHERE variant_id = $1 AND template_id = $2 AND enum_value_id IS NULL
              `, [variant_id, template_id]);

              // Затем вставляем новую
              upsertResult = await pool.query(`
                INSERT INTO product_characteristics_new (
                  variant_id, template_id, enum_value_id, raw_value, numeric_value,
                  bool_value, date_value, file_url, created_at, updated_at
                )
                VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
              `, [
                variant_id,
                template_id,
                raw_value || null,
                numeric_value || null,
                bool_value || null,
                date_value || null,
                file_url || null
              ]);
            }

            savedCharacteristics.push(upsertResult.rows[0]);
          } catch (upsertError) {
            console.error(`❌ Ошибка UPSERT характеристики:`, upsertError.message);
            console.error(`❌ Данные:`, { variant_id, template_id, enum_value_id, raw_value });
            continue;
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: savedCharacteristics,
        message: `Сохранено ${savedCharacteristics.length} характеристик в новой EAV системе`,
        system: 'eav_unified'
      });

    } else {
      // Обратная совместимость со старым форматом (не рекомендуется)
      return NextResponse.json({
        success: false,
        error: 'Используйте новый формат данных с variant_characteristics',
        required_format: {
          variant_characteristics: [
            {
              variant_id: 'number',
              characteristics: [
                {
                  template_id: 'number',
                  raw_value: 'string (optional)',
                  numeric_value: 'number (optional)',
                  bool_value: 'boolean (optional)',
                  date_value: 'date (optional)',
                  file_url: 'string (optional)',
                  enum_value_id: 'number (optional)'
                }
              ]
            }
          ]
        }
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Ошибка сохранения характеристик товара (новая система):', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сохранения характеристик товара', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('variant_id');
    const templateId = searchParams.get('template_id');

    if (variantId && templateId) {
      // Удаляем конкретную характеристику варианта
      const result = await pool.query(`
        DELETE FROM product_characteristics_new
        WHERE variant_id = $1 AND template_id = $2
        AND variant_id IN (
          SELECT id FROM product_variants WHERE master_id = $3
        )
        RETURNING *
      `, [variantId, templateId, productId]);

      return NextResponse.json({
        success: true,
        message: `Удалена характеристика варианта ${variantId}, шаблон ${templateId}`,
        deleted_count: result.rows.length
      });

    } else if (variantId) {
      // Удаляем все характеристики варианта
      const result = await pool.query(`
        DELETE FROM product_characteristics_new
        WHERE variant_id = $1
        AND variant_id IN (
          SELECT id FROM product_variants WHERE master_id = $2
        )
        RETURNING *
      `, [variantId, productId]);

    return NextResponse.json({
      success: true,
        message: `Удалены все характеристики варианта ${variantId}`,
        deleted_count: result.rows.length
      });

    } else {
      // Удаляем все характеристики всех вариантов продукта
      const result = await pool.query(`
        DELETE FROM product_characteristics_new
        WHERE variant_id IN (
          SELECT id FROM product_variants WHERE master_id = $1
        )
        RETURNING *
      `, [productId]);

      return NextResponse.json({
        success: true,
        message: `Удалены все характеристики всех вариантов продукта ${productId}`,
        deleted_count: result.rows.length
      });
    }

  } catch (error) {
    console.error('❌ Ошибка удаления характеристик товара (новая система):', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления характеристик товара', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}