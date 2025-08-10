import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';

// GET /api/products/[id]/characteristics-templates - получить характеристики товара на основе шаблонов (simple)
export async function GET(
  _request: NextRequest,
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

    const characteristicsQuery = `
      SELECT
        pc.id,
        pc.product_id,
        cv.group_id,
        pc.value_id,
        pc.numeric_value,
        pc.additional_value,
        pc.is_primary,
        cg.name AS group_name,
        cg.sort_order AS group_ordering,
        cg.show_in_main_params,
        cg.main_params_priority,
        cv.value AS enum_value,
        cv.description AS enum_display_text,
        cv.color_hex AS value_color,
        cv.sort_order AS value_sort_order
      FROM product_characteristics_simple pc
      JOIN characteristics_values_simple cv ON cv.id = pc.value_id
      JOIN characteristics_groups_simple cg ON cg.id = cv.group_id
      WHERE pc.product_id = $1
      ORDER BY cg.sort_order, cv.sort_order, pc.id
    `;

    const sizesQuery = `
      SELECT
        ps.id,
        ps.size_name,
        ps.size_value,
        ps.weight,
        ps.price,
        ps.stock_quantity,
        ps.dimensions,
        ps.specifications
      FROM product_sizes ps
      WHERE ps.product_id = $1
      ORDER BY ps.size_name
    `;

    const [characteristicsResult, sizesResult] = await Promise.all([
      pool.query(characteristicsQuery, [productId]),
      pool.query(sizesQuery, [productId])
    ]);

    const groupedCharacteristics: any = {};

    characteristicsResult.rows.forEach((row: any) => {
      if (!groupedCharacteristics[row.group_id]) {
        groupedCharacteristics[row.group_id] = {
          group_id: row.group_id,
          group_name: row.group_name,
          group_ordering: row.group_ordering,
          show_in_main_params: row.show_in_main_params,
          main_params_priority: row.main_params_priority,
          characteristics: []
        };
      }

      const displayValue = row.enum_display_text || row.enum_value || row.additional_value || (row.numeric_value !== null ? String(row.numeric_value) : '')

      groupedCharacteristics[row.group_id].characteristics.push({
        id: row.id,
        template_id: null,
        template_name: null,
        type: 'enum',
        input_type: row.numeric_value !== null ? 'number' : 'enum',
        value_numeric: row.numeric_value,
        value_text: row.additional_value,
        value_color: row.value_color,
        value_preset_id: row.value_id,
        size_name: null,
        unit_code: null,
        unit_name: null,
        label: row.enum_display_text || row.enum_value,
        display_value: displayValue,
        is_primary: row.is_primary,
        is_required: false,
        validation_rules: {},
        source: 'simple'
      });
    });

    const formattedResult = Object.values(groupedCharacteristics);

    const sizes = sizesResult.rows.map((row: any) => ({
      id: row.id,
      size_name: row.size_name,
      size_value: row.size_value,
      weight: row.weight,
      price: row.price,
      stock_quantity: row.stock_quantity,
      dimensions: row.dimensions,
      specifications: row.specifications
    }));

    return NextResponse.json({
      success: true,
      data: {
        characteristics: formattedResult,
        sizes: sizes,
        system: 'simple'
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения характеристик товара (шаблоны):', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения характеристик товара' },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/characteristics-templates - сохранить характеристики товара на основе шаблонов
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
      // Удаляем существующие характеристики товара
      await pool.query(`
        DELETE FROM product_characteristics_simple
        WHERE product_id = $1;
      `, [productId]);

      const savedCharacteristics = [];

      for (const char of characteristics) {
        const {
          template_id,
          group_id,
          characteristic_type = 'text',
          value_text,
          value_numeric,
          value_color,
          value_preset_id,
          size_name,
          label,
          is_primary = false
        } = char;

        // Проверяем обязательные поля
        if (!template_id && !group_id) {
          console.warn('Пропускаем характеристику без template_id и group_id:', char);
          continue;
        }

        // Получаем информацию о шаблоне (если используется)
        let finalGroupId = group_id;
        let finalLabel = label;

        if (template_id) {
          const templateResult = await pool.query(`
            SELECT ct.group_id, ct.name, ct.input_type, ct.unit_id
            FROM characteristic_templates ct
            WHERE ct.id = $1;
          `, [template_id]);

          if (templateResult.rows.length > 0) {
            const template = templateResult.rows[0];
            finalGroupId = template.group_id;
            finalLabel = finalLabel || template.name;
          }
        }

        // Вставляем характеристику
        const insertResult = await pool.query(`
          INSERT INTO product_characteristics (
            product_id, template_id, group_id, characteristic_type,
            value_text, value_numeric, value_color, value_preset_id,
            size_name, label, is_primary, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
          RETURNING *;
        `, [
          productId,
          template_id || null,
          finalGroupId,
          characteristic_type,
          value_text || null,
          value_numeric || null,
          value_color || null,
          value_preset_id || null,
          size_name || null,
          finalLabel,
          is_primary
        ]);

        savedCharacteristics.push(insertResult.rows[0]);
      }

      await pool.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: savedCharacteristics,
        message: `Сохранено ${savedCharacteristics.length} характеристик`
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Ошибка сохранения характеристик товара (шаблоны):', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сохранения характеристик товара' },
      { status: 500 }
    );
  }
}