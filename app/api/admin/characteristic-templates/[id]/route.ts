import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';
import { guardDbOr503Fast, tablesExist } from '@/lib/api-guards'

// GET /api/admin/characteristic-templates/[id] - получить шаблон с предустановленными значениями
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    const templateId = parseInt(params.id);

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Неверный ID шаблона' },
        { status: 400 }
      );
    }

    const need = await tablesExist(['characteristic_templates','characteristic_groups','characteristic_units','characteristic_preset_values'])
    if (!need.characteristic_templates) {
      return NextResponse.json({ success: false, error: 'Templates schema is not initialized' }, { status: 503 })
    }

    const pool = getPool();

    const selectUnit = need.characteristic_units ? `,
        cu.code as unit_code,
        cu.name_ru as unit_name
      ` : ''
    const joinUnit = need.characteristic_units ? `
      LEFT JOIN characteristic_units cu ON cu.id = ct.unit_id
    ` : ''

    const templateResult = await pool.query(`
      SELECT
        ct.*,
        cg.name as group_name
        ${selectUnit}
      FROM characteristic_templates ct
      JOIN characteristic_groups cg ON cg.id = ct.group_id
      ${joinUnit}
      WHERE ct.id = $1;
    `, [templateId]);

    if (templateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Шаблон не найден' },
        { status: 404 }
      );
    }

    const template = templateResult.rows[0];

    if (need.characteristic_preset_values) {
      const presetValuesResult = await pool.query(`
        SELECT *
        FROM characteristic_preset_values
        WHERE template_id = $1
        ORDER BY sort_order, value;
      `, [templateId]);
      template.preset_values = presetValuesResult.rows;
    } else {
      template.preset_values = []
    }

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка получения шаблона характеристики' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/characteristic-templates/[id] - обновить шаблон
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    const templateId = parseInt(params.id);

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Неверный ID шаблона' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      input_type,
      unit_id,
      is_required,
      sort_order,
      validation_rules,
      default_value,
      placeholder_text,
      preset_values = []
    } = body;

    const need = await tablesExist(['characteristic_templates','characteristic_preset_values'])
    if (!need.characteristic_templates) {
      return NextResponse.json({ success: false, error: 'Templates schema is not initialized' }, { status: 503 })
    }

    const pool = getPool();

    await pool.query('BEGIN');

    try {
      const templateResult = await pool.query(`
        UPDATE characteristic_templates
        SET
          name = $2,
          description = $3,
          input_type = $4,
          unit_id = $5,
          is_required = $6,
          sort_order = $7,
          validation_rules = $8,
          default_value = $9,
          placeholder_text = $10,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `, [
        templateId,
        name,
        description,
        input_type,
        unit_id || null,
        is_required,
        sort_order,
        JSON.stringify(validation_rules || {}),
        default_value,
        placeholder_text
      ]);

      if (templateResult.rows.length === 0) {
        await pool.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Шаблон не найден' },
          { status: 404 }
        );
      }

      if (need.characteristic_preset_values) {
        await pool.query(`
          DELETE FROM characteristic_preset_values
          WHERE template_id = $1;
        `, [templateId]);

        if (preset_values && preset_values.length > 0) {
          for (let i = 0; i < preset_values.length; i++) {
            const presetValue = preset_values[i];
            await pool.query(`
              INSERT INTO characteristic_preset_values (
                template_id, value, display_text, sort_order, is_default
              )
              VALUES ($1, $2, $3, $4, $5);
            `, [
              templateId,
              (presetValue as any).value || presetValue,
              (presetValue as any).display_text || (presetValue as any).value || presetValue,
              (presetValue as any).sort_order || i,
              (presetValue as any).is_default || false
            ]);
          }
        }
      }

      await pool.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: templateResult.rows[0],
        message: `Шаблон характеристики "${name}" успешно обновлен`
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления шаблона характеристики' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/characteristic-templates/[id] - удалить шаблон
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    const templateId = parseInt(params.id);

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Неверный ID шаблона' },
        { status: 400 }
      );
    }

    const need = await tablesExist(['characteristic_templates','product_characteristics_simple','characteristics_values_simple'])
    if (!need.characteristic_templates) {
      return NextResponse.json({ success: false, error: 'Templates schema is not initialized' }, { status: 503 })
    }

    const pool = getPool();

    if (need.product_characteristics_simple && need.characteristics_values_simple) {
      const usageResult = await pool.query(`
        SELECT COUNT(*) as usage_count
        FROM product_characteristics_simple
        WHERE value_id IN (
          SELECT id FROM characteristics_values_simple
          WHERE group_id IN (
            SELECT group_id FROM characteristic_templates WHERE id = $1
          )
        );
      `, [templateId]);

      const usageCount = parseInt(usageResult.rows[0].usage_count);

      if (usageCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Шаблон используется в ${usageCount} характеристиках товаров. Удаление невозможно.`
          },
          { status: 400 }
        );
      }
    }

    const deleteResult = await pool.query(`
      DELETE FROM characteristic_templates
      WHERE id = $1
      RETURNING name;
    `, [templateId]);

    if (deleteResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Шаблон не найден' },
        { status: 404 }
      );
    }

    const deletedName = deleteResult.rows[0].name;

    return NextResponse.json({
      success: true,
      message: `Шаблон характеристики "${deletedName}" успешно удален`
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления шаблона характеристики' },
      { status: 500 }
    );
  }
}