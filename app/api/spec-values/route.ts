import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db-connection'

// GET - Получить все значения характеристик для товара/варианта из новой EAV системы
export async function GET(request: NextRequest) {
try {
    const pool = getPool()
    const client = await pool.connect()
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    const variantId = searchParams.get('variant_id')
    const groupId = searchParams.get('group_id')
    const templateId = searchParams.get('template_id')

    // Основной запрос к новой EAV системе
    let query = `
      SELECT
        pc.product_id,
        pc.template_id,
        pc.value_text as raw_value,
        pc.value_numeric as numeric_value,
        CASE WHEN pc.value_text = 'true' THEN true ELSE false END as bool_value,
        pc.value_text as date_value,
        pc.value_text as file_url,
        pc.value_preset_id as enum_value_id,
        pc.created_at,
        pc.updated_at,
        -- Информация о шаблоне
        ct.key as template_key,
        ct.name as template_name,
        ct.input_type,
        ct.validation_rules,
        ct.default_value,
        ct.placeholder_text,
        ct.sort_order as template_sort_order,
        -- Информация о группе
        cg.id as group_id,
        cg.name as group_name,
        cg.ordering as group_ordering,
        cg.show_in_main_params,
        cg.main_params_priority,
        -- Единица измерения
        cu.code as unit_code,
        cu.name_ru as unit_name,
        -- Enum значения
        cv.value as enum_value,
        cv.display_name as enum_display_name,
        cv.color_hex as enum_color,
        cv.sort_order as enum_sort_order,
        -- Информация о продукте
        null as variant_sku,
        pc.product_id as product_id,
        p.name as product_name
      FROM product_characteristics_simple pc
      JOIN characteristics_values_simple cv ON cv.id = pc.value_id
      JOIN characteristics_groups_simple cg ON cg.id = cv.group_id
      JOIN products p ON p.id = pc.product_id
      WHERE cg.is_active = true
    `

    const params = []
    let paramIndex = 1

    // Фильтрация по продукту
    if (productId) {
      query += ` AND pc.product_id = $${paramIndex}`
      params.push(productId)
      paramIndex++
    }

    // Фильтрация по конкретному варианту (пропускаем, так как работаем с продуктами)
    if (variantId) {
      // В новой структуре нет вариантов, пропускаем

    }

    // Фильтрация по группе характеристик
    if (groupId) {
      query += ` AND cg.id = $${paramIndex}`
      params.push(groupId)
      paramIndex++
    }

    // Фильтрация по шаблону (в новой структуре нет шаблонов)
    if (templateId) {

    }

    query += ` ORDER BY cg.sort_order ASC, cv.sort_order ASC, pc.value_id ASC`

    const result = await client.query(query, params)
    client.release()

    // Обогащаем данные обработанными значениями
    const enrichedData = result.rows.map((row: any) => {
      // Определяем отображаемое значение
      let displayValue = '';
      let formattedValue: any = null;

      switch (row.input_type) {
        case 'enum':
          displayValue = row.enum_display_name || row.enum_value || 'Не указано';
          formattedValue = {
            type: 'enum',
            enum_value_id: row.enum_value_id,
            value: row.enum_value,
            display: row.enum_display_name,
            color: row.enum_color
          };
          break;
        case 'boolean':
          displayValue = row.bool_value ? 'Да' : 'Нет';
          formattedValue = {
            type: 'boolean',
            value: row.bool_value
          };
          break;
        case 'number':
          displayValue = row.numeric_value ?
            `${row.numeric_value}${row.unit_code ? ' ' + row.unit_code : ''}` :
            'Не указано';
          formattedValue = {
            type: 'number',
            value: row.numeric_value,
            unit: row.unit_code,
            unit_name: row.unit_name
          };
          break;
        case 'date':
          displayValue = row.date_value ?
            new Date(row.date_value).toLocaleDateString() :
            'Не указано';
          formattedValue = {
            type: 'date',
            value: row.date_value
          };
          break;
        case 'file':
          displayValue = row.file_url ? 'Файл прикреплен' : 'Файл не прикреплен';
          formattedValue = {
            type: 'file',
            url: row.file_url
          };
          break;
        default: // text и другие типы
          displayValue = row.raw_value || 'Не указано';
          formattedValue = {
            type: 'text',
            value: row.raw_value
          };
      }

      return {
        // Основные поля
        variant_id: row.variant_id,
        template_id: row.template_id,
        group_id: row.group_id,

        // Информация о шаблоне
        template_key: row.template_key,
        template_name: row.template_name,
        input_type: row.input_type,
        template_sort_order: row.template_sort_order,

        // Информация о группе
        group_name: row.group_name,
        group_ordering: row.group_ordering,
        show_in_main_params: row.show_in_main_params,
        main_params_priority: row.main_params_priority,

        // Единицы измерения
        unit_code: row.unit_code,
        unit_name: row.unit_name,

        // Обработанные значения
        display_value: displayValue,
        formatted_value: formattedValue,

        // Сырые значения для совместимости
        raw_value: row.raw_value,
        numeric_value: row.numeric_value,
        bool_value: row.bool_value,
        date_value: row.date_value,
        file_url: row.file_url,
        enum_value_id: row.enum_value_id,

        // Информация о продукте и варианте
        product_id: row.product_id,
        product_name: row.product_name,
        variant_name: row.variant_sku || `Вариант ${row.variant_id}`,
        variant_sku: row.variant_sku,

        // Метаданные
        created_at: row.created_at,
        updated_at: row.updated_at,
        source: 'eav_system'
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedData,
      total: enrichedData.length,
      system: 'eav_unified',
      filters_applied: {
        product_id: productId,
        variant_id: variantId,
        group_id: groupId,
        template_id: templateId
      }
    })
  } catch (error) {
    console.error('Ошибка получения значений характеристик (новая EAV система):', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка получения данных из новой EAV системы', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Создать новое значение характеристики в новой EAV системе
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      variant_id,
      template_id,
      raw_value,
      numeric_value,
      bool_value,
      date_value,
      file_url,
      enum_value_id
    } = body

    if (!variant_id || !template_id) {
      return NextResponse.json(
        { success: false, error: 'variant_id и template_id обязательны для новой EAV системы' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const client = await pool.connect()

    // Проверяем существование варианта и шаблона
    const validationQuery = `
      SELECT
        pv.id as variant_id,
        pv.master_id as product_id,
        ct.id as template_id,
        ct.input_type,
        ct.name as template_name,
        cg.name as group_name
      FROM product_variants pv
      CROSS JOIN characteristic_templates ct
              LEFT JOIN characteristics_groups_simple cg ON cg.id = ct.group_id
      WHERE pv.id = $1
        AND ct.id = $2
        AND ct.is_deleted = FALSE
        AND cg.is_deleted = FALSE
    `

    const validationResult = await client.query(validationQuery, [variant_id, template_id])

    if (validationResult.rows.length === 0) {
      client.release()
      return NextResponse.json(
        { success: false, error: 'Вариант или шаблон не найдены' },
        { status: 404 }
      )
    }

    const validation = validationResult.rows[0]

    // Проверяем корректность данных для типа шаблона
    let validationError = null
    switch (validation.input_type) {
      case 'enum':
        if (!enum_value_id) {
          validationError = 'enum_value_id обязателен для enum типа'
        }
        break
      case 'number':
        if (numeric_value === null || numeric_value === undefined) {
          validationError = 'numeric_value обязательно для number типа'
        }
        break
      case 'boolean':
        if (bool_value === null || bool_value === undefined) {
          validationError = 'bool_value обязательно для boolean типа'
        }
        break
      case 'date':
        if (!date_value) {
          validationError = 'date_value обязательно для date типа'
        }
        break
      case 'file':
        if (!file_url) {
          validationError = 'file_url обязателен для file типа'
        }
        break
      default: // text
        if (!raw_value) {
          validationError = 'raw_value обязательно для text типа'
        }
    }

    if (validationError) {
      client.release()
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      )
    }

    // Используем UPSERT для предотвращения дублей
    const result = await client.query(`
      INSERT INTO product_characteristics_new (
        variant_id, template_id, raw_value, numeric_value,
        bool_value, date_value, file_url, enum_value_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (variant_id, template_id, COALESCE(enum_value_id, -1))
      DO UPDATE SET
        raw_value = EXCLUDED.raw_value,
        numeric_value = EXCLUDED.numeric_value,
        bool_value = EXCLUDED.bool_value,
        date_value = EXCLUDED.date_value,
        file_url = EXCLUDED.file_url,
        enum_value_id = EXCLUDED.enum_value_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      variant_id,
      template_id,
      raw_value || null,
      numeric_value || null,
      bool_value || null,
      date_value || null,
      file_url || null,
      enum_value_id || null
    ])

    client.release()

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Характеристика успешно сохранена в новой EAV системе',
      system: 'eav_unified'
    })
  } catch (error) {
    console.error('Ошибка создания значения характеристики (новая EAV система):', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка создания значения характеристики в новой EAV системе', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Обновить значение характеристики в новой EAV системе
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const variantId = searchParams.get('variant_id')
    const templateId = searchParams.get('template_id')

    if (!variantId || !templateId) {
      return NextResponse.json(
        { success: false, error: 'variant_id и template_id обязательны' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { raw_value, numeric_value, bool_value, date_value, file_url, enum_value_id } = body

    const pool = getPool()
    const client = await pool.connect()

    const result = await client.query(`
      UPDATE product_characteristics_new
      SET raw_value = $3,
          numeric_value = $4,
          bool_value = $5,
          date_value = $6,
          file_url = $7,
          enum_value_id = $8,
          updated_at = CURRENT_TIMESTAMP
      WHERE variant_id = $1 AND template_id = $2
      RETURNING *
    `, [
      variantId,
      templateId,
      raw_value || null,
      numeric_value || null,
      bool_value || null,
      date_value || null,
      file_url || null,
      enum_value_id || null
    ])

    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Значение характеристики не найдено' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Характеристика обновлена в новой EAV системе',
      system: 'eav_unified'
    })
  } catch (error) {
    console.error('Ошибка обновления значения характеристики (новая EAV система):', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления значения характеристики в новой EAV системе', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Удалить значение характеристики из новой EAV системы
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const variantId = searchParams.get('variant_id')
    const templateId = searchParams.get('template_id')

    if (!variantId || !templateId) {
      return NextResponse.json(
        { success: false, error: 'variant_id и template_id обязательны' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const client = await pool.connect()
    const result = await client.query(
      'DELETE FROM product_characteristics_new WHERE variant_id = $1 AND template_id = $2 RETURNING *',
      [variantId, templateId]
    )
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Значение характеристики не найдено' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Значение характеристики удалено из новой EAV системы',
      deleted_data: result.rows[0],
      system: 'eav_unified'
    })
  } catch (error) {
    console.error('Ошибка удаления значения характеристики (новая EAV система):', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления значения характеристики из новой EAV системы', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}