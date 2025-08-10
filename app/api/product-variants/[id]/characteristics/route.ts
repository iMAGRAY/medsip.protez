import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/product-variants/[id]/characteristics - получить характеристики варианта товара
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || 'ru';

    // Проверяем, что вариант существует
    const variantCheck = await pool.query(
      'SELECT id FROM product_variants WHERE id = $1 AND is_deleted = FALSE',
      [variantId]
    );

    if (variantCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Вариант товара не найден' },
        { status: 404 }
      );
    }

    // Получаем характеристики варианта с переводами
    const result = await pool.query(`
      SELECT
        pc.*,
        ct.key as template_key,
        ct.input_type,
        ct.validation_rules,
        COALESCE(ctt.label, ct.default_label, ct.key) as template_label,
        COALESCE(cgt.name, cg.name) as group_name,
        cg.id as group_id,
        cg.sort_order as group_sort_order,
        ct.sort_order as template_sort_order,
        cu.code as unit_code,
        COALESCE(cut.label, cu.default_label) as unit_label,
        cv.value as enum_display_value,
        cv.sort_order as enum_sort_order
      FROM product_characteristics_new pc
      JOIN characteristic_templates ct ON pc.template_id = ct.id
      JOIN characteristic_groups cg ON ct.group_id = cg.id
      LEFT JOIN characteristic_template_translations ctt ON ct.id = ctt.template_id AND ctt.locale = $2
      LEFT JOIN characteristic_group_translations cgt ON cg.id = cgt.group_id AND cgt.locale = $2
      LEFT JOIN characteristic_units cu ON ct.unit_id = cu.id
      LEFT JOIN characteristic_unit_translations cut ON cu.id = cut.unit_id AND cut.locale = $2
      LEFT JOIN characteristic_values cv ON pc.enum_value_id = cv.id
      WHERE pc.variant_id = $1
        AND ct.is_deleted = FALSE
        AND cg.is_deleted = FALSE
        AND (cu.is_deleted = FALSE OR cu.id IS NULL)
      ORDER BY cg.sort_order, ct.sort_order, cv.sort_order
    `, [variantId, locale]);

    // Группируем характеристики по группам
    const groupedCharacteristics = result.rows.reduce((acc: any, row: any) => {
      const groupName = row.group_name;

      if (!acc[groupName]) {
        acc[groupName] = {
          group_id: row.group_id,
          group_name: groupName,
          group_sort_order: row.group_sort_order,
          characteristics: []
        };
      }

      // Определяем отображаемое значение в зависимости от типа
      let displayValue;
      switch (row.input_type) {
        case 'enum':
          displayValue = row.enum_display_value;
          break;
        case 'boolean':
          displayValue = row.bool_value ? 'Да' : 'Нет';
          break;
        case 'number':
          displayValue = row.numeric_value;
          break;
        case 'date':
          displayValue = row.date_value;
          break;
        case 'file':
          displayValue = row.file_url;
          break;
        default:
          displayValue = row.raw_value;
      }

      acc[groupName].characteristics.push({
        template_id: row.template_id,
        template_key: row.template_key,
        template_label: row.template_label,
        input_type: row.input_type,
        validation_rules: row.validation_rules,
        sort_order: row.template_sort_order,
        unit_code: row.unit_code,
        unit_label: row.unit_label,
        value: {
          raw_value: row.raw_value,
          numeric_value: row.numeric_value,
          bool_value: row.bool_value,
          date_value: row.date_value,
          file_url: row.file_url,
          enum_value_id: row.enum_value_id,
          display_value: displayValue
        },
        created_at: row.created_at,
        updated_at: row.updated_at
      });

      return acc;
    }, {});

    // Преобразуем в массив и сортируем группы
    const _characteristics = Object.values(groupedCharacteristics)
      .sort((a: any, b: any) => a.group_sort_order - b.group_sort_order);

    return NextResponse.json({
      variant_id: parseInt(variantId),
      characteristics,
      locale
    });

  } catch (error) {
    console.error('Ошибка получения характеристик варианта:', error);
    return NextResponse.json(
      { error: 'Ошибка получения характеристик варианта' },
      { status: 500 }
    );
  }
}

// POST /api/product-variants/[id]/characteristics - добавить/обновить характеристику варианта
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;
    const body = await request.json();
    const { template_id, raw_value, numeric_value, bool_value, date_value, file_url, enum_value_id } = body;

    if (!template_id) {
      return NextResponse.json(
        { error: 'Не указан template_id' },
        { status: 400 }
      );
    }

    // Проверяем, что вариант и шаблон существуют
    const checks = await Promise.all([
      pool.query('SELECT id FROM product_variants WHERE id = $1 AND is_deleted = FALSE', [variantId]),
      pool.query('SELECT id, input_type FROM characteristic_templates WHERE id = $1 AND is_deleted = FALSE', [template_id])
    ]);

    if (checks[0].rows.length === 0) {
      return NextResponse.json(
        { error: 'Вариант товара не найден' },
        { status: 404 }
      );
    }

    if (checks[1].rows.length === 0) {
      return NextResponse.json(
        { error: 'Шаблон характеристики не найден' },
        { status: 404 }
      );
    }

    // Добавляем или обновляем характеристику (UPSERT)
    const result = await pool.query(`
      INSERT INTO product_characteristics_new (
        variant_id, template_id, raw_value, numeric_value,
        bool_value, date_value, file_url, enum_value_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
    `, [variantId, template_id, raw_value, numeric_value, bool_value, date_value, file_url, enum_value_id]);

    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (error) {
    console.error('Ошибка сохранения характеристики:', error);
    return NextResponse.json(
      { error: 'Ошибка сохранения характеристики' },
      { status: 500 }
    );
  }
}

// DELETE /api/product-variants/[id]/characteristics?template_id=X - удалить характеристику варианта
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Не указан template_id для удаления' },
        { status: 400 }
      );
    }

    // Удаляем характеристику
    const result = await pool.query(`
      DELETE FROM product_characteristics_new
      WHERE variant_id = $1 AND template_id = $2
      RETURNING *
    `, [variantId, templateId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Характеристика не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Характеристика успешно удалена',
      deleted: result.rows[0]
    });

  } catch (error) {
    console.error('Ошибка удаления характеристики:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления характеристики' },
      { status: 500 }
    );
  }
}