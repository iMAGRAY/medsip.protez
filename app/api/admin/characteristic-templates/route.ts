import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';
import { guardDbOr503Fast, tablesExist, columnsExist } from '@/lib/api-guards'

// GET /api/admin/characteristic-templates - получить все шаблоны характеристик
export async function GET(request: NextRequest) {
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    const need = await tablesExist(['characteristic_templates','characteristic_groups','characteristic_units','characteristic_preset_values'])
    if (!need.characteristic_templates) {
      return NextResponse.json({ success: true, data: [] })
    }

    const cols = await columnsExist('characteristic_templates', [
      'group_id','unit_id','input_type','is_required','sort_order','validation_rules','default_value','placeholder_text','is_template','description'
    ])

    const hasGroupId = !!cols.group_id
    const hasUnitId = !!cols.unit_id
    const canJoinGroups = need.characteristic_groups && hasGroupId
    const canJoinUnits = need.characteristic_units && hasUnitId

    const pool = getPool();

    const selectParts: string[] = [
      'ct.id',
      hasGroupId ? 'ct.group_id' : 'NULL as group_id',
      'ct.name',
      cols.description ? 'ct.description' : 'NULL as description',
      cols.input_type ? 'ct.input_type' : `'text'::varchar as input_type`,
      cols.is_required ? 'ct.is_required' : 'false as is_required',
      cols.sort_order ? 'ct.sort_order' : '0 as sort_order',
      cols.validation_rules ? 'ct.validation_rules' : 'NULL as validation_rules',
      cols.default_value ? 'ct.default_value' : 'NULL as default_value',
      cols.placeholder_text ? 'ct.placeholder_text' : 'NULL as placeholder_text',
      cols.is_template ? 'ct.is_template' : 'true as is_template',
      'ct.created_at',
      'ct.updated_at',
      canJoinGroups ? 'cg.name as group_name' : 'NULL as group_name'
    ]

    const presetCountSelect = need.characteristic_preset_values
      ? `(SELECT COUNT(*) FROM characteristic_preset_values cpv WHERE cpv.template_id = ct.id)`
      : `0`

    selectParts.push(`${presetCountSelect} as preset_values_count`)

    // unit join/select — только если есть колонка и таблица
    if (canJoinUnits) {
      selectParts.push('cu.code as unit_code','cu.name_ru as unit_name')
    }

    let query = `
      SELECT ${selectParts.join(',\n        ')}
      FROM characteristic_templates ct
      ${canJoinGroups ? 'JOIN characteristic_groups cg ON cg.id = ct.group_id' : ''}
      ${canJoinUnits ? 'LEFT JOIN characteristic_units cu ON cu.id = ct.unit_id' : ''}
    `;

    const params: any[] = [];

    if (groupId) {
      if (!hasGroupId) {
        // Нельзя отфильтровать без колонки — вернём пусто
        return NextResponse.json({ success: true, data: [] })
      }
      query += ` WHERE ct.group_id = $1`;
      params.push(parseInt(groupId));
    }

    const orderParts: string[] = []
    if (canJoinGroups) orderParts.push('cg.ordering')
    if (cols.sort_order) orderParts.push('ct.sort_order')
    orderParts.push('ct.name')

    query += ` ORDER BY ${orderParts.join(', ')} LIMIT 200`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения шаблонов характеристик'
    }, { status: 500 })
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

    const cols = await columnsExist('characteristic_templates', ['unit_id','validation_rules','placeholder_text','default_value','input_type','is_required','sort_order','description'])

    const pool = getPool();

    await pool.query('BEGIN');

    try {
      const insertCols: string[] = ['group_id','name']
      const insertVals: string[] = ['$1','$2']
      const insertParams: any[] = [group_id, name]
      let idx = 3
      if (cols.description) { insertCols.push('description'); insertVals.push(`$${idx++}`); insertParams.push(description ?? null) }
      if (cols.input_type) { insertCols.push('input_type'); insertVals.push(`$${idx++}`); insertParams.push(input_type) }
      if (cols.unit_id) { insertCols.push('unit_id'); insertVals.push(`$${idx++}`); insertParams.push(unit_id || null) }
      if (cols.is_required) { insertCols.push('is_required'); insertVals.push(`$${idx++}`); insertParams.push(!!is_required) }
      if (cols.sort_order) { insertCols.push('sort_order'); insertVals.push(`$${idx++}`); insertParams.push(sort_order) }
      if (cols.validation_rules) { insertCols.push('validation_rules'); insertVals.push(`$${idx++}`); insertParams.push(JSON.stringify(validation_rules)) }
      if (cols.default_value) { insertCols.push('default_value'); insertVals.push(`$${idx++}`); insertParams.push(default_value ?? null) }
      if (cols.placeholder_text) { insertCols.push('placeholder_text'); insertVals.push(`$${idx++}`); insertParams.push(placeholder_text ?? null) }

      const templateResult = await pool.query(`
        INSERT INTO characteristic_templates (
          ${insertCols.join(', ')}
        )
        VALUES (${insertVals.join(', ')})
        RETURNING *;
      `, insertParams);

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

  } catch (_error) {
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

    const cols = await columnsExist('characteristic_templates', ['unit_id','validation_rules','placeholder_text','default_value','input_type','is_required','sort_order','name','description'])

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

        const setParts: string[] = []
        const params: any[] = []
        let i = 1
        if (cols.name) { setParts.push(`name = $${++i}`); params.push(name) }
        if (cols.description) { setParts.push(`description = $${++i}`); params.push(description) }
        if (cols.input_type) { setParts.push(`input_type = $${++i}`); params.push(input_type) }
        if (cols.unit_id) { setParts.push(`unit_id = $${++i}`); params.push(unit_id || null) }
        if (cols.is_required) { setParts.push(`is_required = $${++i}`); params.push(!!is_required) }
        if (cols.sort_order) { setParts.push(`sort_order = $${++i}`); params.push(sort_order) }
        if (cols.validation_rules) { setParts.push(`validation_rules = $${++i}`); params.push(JSON.stringify(validation_rules || {})) }
        if (cols.default_value) { setParts.push(`default_value = $${++i}`); params.push(default_value ?? null) }
        if (cols.placeholder_text) { setParts.push(`placeholder_text = $${++i}`); params.push(placeholder_text ?? null) }
        setParts.push('updated_at = CURRENT_TIMESTAMP')

        await pool.query(`
          UPDATE characteristic_templates
          SET ${setParts.join(', ')}
          WHERE id = $1;
        `, [id, ...params]);
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

  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления шаблонов характеристик' },
      { status: 500 }
    );
  }
}