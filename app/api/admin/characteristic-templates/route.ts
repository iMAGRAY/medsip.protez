import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';
import { guardDbOr503Fast, tablesExist } from '@/lib/api-guards'

// GET /api/admin/characteristic-templates - получить все шаблоны характеристик
export async function GET(request: NextRequest) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    const need = await tablesExist(['characteristic_templates','characteristic_groups','characteristic_units','characteristic_preset_values'])
    if (!need.characteristic_templates || !need.characteristic_groups) {
      return NextResponse.json({ success: true, data: [] })
    }

    const pool = getPool();

    const selectUnit = need.characteristic_units ? `,
        cu.code as unit_code,
        cu.name_ru as unit_name
      ` : ''
    const joinUnit = need.characteristic_units ? `
      LEFT JOIN characteristic_units cu ON cu.id = ct.unit_id
    ` : ''

    let query = `
      SELECT
        ct.id,
        ct.group_id,
        ct.name,
        ct.description,
        ct.input_type,
        ct.unit_id,
        ct.is_required,
        ct.sort_order,
        ct.validation_rules,
        ct.default_value,
        ct.placeholder_text,
        ct.is_template,
        ct.created_at,
        ct.updated_at,
        cg.name as group_name
        ${selectUnit},
        (SELECT COUNT(*) FROM characteristic_preset_values cpv WHERE cpv.template_id = ct.id) as preset_values_count
      FROM characteristic_templates ct
      JOIN characteristic_groups cg ON cg.id = ct.group_id
      ${joinUnit}
    `;

    const params: any[] = [];

    if (groupId) {
      query += ` WHERE ct.group_id = $1`;
      params.push(parseInt(groupId));
    }

    query += ` ORDER BY cg.ordering, ct.sort_order, ct.name LIMIT 200`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка получения шаблонов характеристик' },
      { status: 500 }
    );
  }
}

// POST /api/admin/characteristic-templates - создать новый шаблон характеристики
export async function POST(request: NextRequest) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    const body = await request.json();
    const {
      group_id,
      name,
      description,
      input_type = 'text',
      unit_id,
      is_required = false,
      sort_order = 0,
      validation_rules = {},
      default_value,
      placeholder_text,
      preset_values = []
    } = body;

    if (!group_id || !name) {
      return NextResponse.json(
        { success: false, error: 'Обязательные поля: group_id, name' },
        { status: 400 }
      );
    }

    const need = await tablesExist(['characteristic_templates','characteristic_preset_values'])
    if (!need.characteristic_templates) {
      return NextResponse.json({ success: false, error: 'Templates schema is not initialized' }, { status: 503 })
    }

    const pool = getPool();

    await pool.query('BEGIN');

    try {
      const templateResult = await pool.query(`
        INSERT INTO characteristic_templates (
          group_id, name, description, input_type, unit_id,
          is_required, sort_order, validation_rules, default_value, placeholder_text
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `, [
        group_id,
        name,
        description,
        input_type,
        unit_id || null,
        is_required,
        sort_order,
        JSON.stringify(validation_rules),
        default_value,
        placeholder_text
      ]);

      const template = templateResult.rows[0];

      if (preset_values && preset_values.length > 0 && need.characteristic_preset_values) {
        for (let i = 0; i < preset_values.length; i++) {
          const presetValue = preset_values[i];
          await pool.query(`
            INSERT INTO characteristic_preset_values (
              template_id, value, display_text, sort_order, is_default
            )
            VALUES ($1, $2, $3, $4, $5);
          `, [
            template.id,
            (presetValue as any).value || presetValue,
            (presetValue as any).display_text || (presetValue as any).value || presetValue,
            (presetValue as any).sort_order || i,
            (presetValue as any).is_default || false
          ]);
        }
      }

      await pool.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: template,
        message: `Шаблон характеристики "${name}" успешно создан`
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка создания шаблона характеристики' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/characteristic-templates - обновить несколько шаблонов
export async function PUT(request: NextRequest) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    const body = await request.json();
    const { templates } = body;

    if (!Array.isArray(templates)) {
      return NextResponse.json(
        { success: false, error: 'Ожидается массив шаблонов' },
        { status: 400 }
      );
    }

    const need = await tablesExist(['characteristic_templates'])
    if (!need.characteristic_templates) {
      return NextResponse.json({ success: false, error: 'Templates schema is not initialized' }, { status: 503 })
    }

    const pool = getPool();

    await pool.query('BEGIN');

    try {
      for (const template of templates) {
        const {
          id,
          name,
          description,
          input_type,
          unit_id,
          is_required,
          sort_order,
          validation_rules,
          default_value,
          placeholder_text
        } = template;

        await pool.query(`
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
          WHERE id = $1;
        `, [
          id,
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
      }

      await pool.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Обновлено ${templates.length} шаблонов характеристик`
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления шаблонов характеристик' },
      { status: 500 }
    );
  }
}