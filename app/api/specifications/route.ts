// @ts-nocheck
// GET /api/specifications - Get all specification groups and enums with hierarchical structure
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';
import { guardDbOr503Fast } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const fast = guardDbOr503Fast()
    if (fast) return fast

    const pool = getPool();
    const client = await pool.connect();

    const exists = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name = ANY($1)
    `, [[
      'characteristics_groups_simple',
      'characteristics_values_simple',
      'product_categories'
    ]] )
    const names = new Set(exists.rows.map((r: any) => r.table_name))
    if (!names.has('characteristics_groups_simple') || !names.has('characteristics_values_simple')) {
      client.release()
      return NextResponse.json({ success: true, data: [], hierarchical: true, total_groups: 0, characteristic_groups_count: 0, manufacturers_count: 0 })
    }

    const characteristicGroupsQuery = await client.query(`
      WITH RECURSIVE characteristic_tree AS (
        SELECT
          sg.id,
          sg.name,
          sg.description,
          sg.parent_id,
          sg.sort_order,
          sg.show_in_main_params,
          sg.main_params_priority,
          sg.is_active,
          0 as level,
          ARRAY[sg.sort_order, sg.id] as path
        FROM characteristics_groups_simple sg
        WHERE sg.parent_id IS NULL AND sg.is_active = true

        UNION ALL

        SELECT
          sg.id,
          sg.name,
          sg.description,
          sg.parent_id,
          sg.sort_order,
          sg.show_in_main_params,
          sg.main_params_priority,
          sg.is_active,
          st.level + 1,
          st.path || ARRAY[sg.sort_order, sg.id]
        FROM characteristics_groups_simple sg
        INNER JOIN characteristic_tree st ON sg.parent_id = st.id
        WHERE sg.is_active = true
      )
      SELECT
        st.id,
        st.name,
        st.description,
        st.parent_id,
        st.sort_order as ordering,
        st.show_in_main_params,
        st.main_params_priority,
        st.level,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id',         se.id,
              'value',      se.value,
              'display_name', se.description,
              'color_hex',  se.color_hex,
              'ordering',   se.sort_order
            ) ORDER BY se.sort_order
          ) FILTER (WHERE se.id IS NOT NULL),
          '[]'::json
        ) AS enum_values,
        (SELECT COUNT(*) FROM characteristics_groups_simple WHERE parent_id = st.id) as children_count
      FROM characteristic_tree st
      LEFT JOIN characteristics_values_simple se ON se.group_id = st.id
      GROUP BY st.id, st.name, st.description, st.parent_id, st.sort_order, st.show_in_main_params, st.main_params_priority, st.level, st.path
      ORDER BY st.path, st.sort_order
      LIMIT 1000
    `);

    let manufacturersQuery = { rows: [] }
    if (names.has('product_categories')) {
      manufacturersQuery = await client.query(`
        WITH RECURSIVE hierarchy AS (
          SELECT
            c.id,
            c.name,
            c.description,
            c.parent_id,
            c.sort_order,
            0 as level,
            ARRAY[c.id] as path
          FROM product_categories c
          WHERE c.parent_id IS NULL
            AND c.is_active = true

          UNION ALL

          SELECT
            c.id,
            c.name,
            c.description,
            c.parent_id,
            c.sort_order,
            h.level + 1,
            h.path || c.id
          FROM product_categories c
          JOIN hierarchy h ON c.parent_id = h.id
          WHERE c.is_active = true
        )
        SELECT
          id,
          name,
          description,
          parent_id,
          sort_order,
          level,
          (SELECT COUNT(*) FROM product_categories WHERE parent_id = hierarchy.id) as children_count
        FROM hierarchy
        ORDER BY path, sort_order
        LIMIT 2000
      `);
    }

    client.release();

    const characteristicGroupsMap = new Map();
    const rootCharacteristicGroups = [];

    characteristicGroupsQuery.rows.forEach((row: any) => {
      const group = {
        id: `char_${row.id}`,
        name: row.name,
        description: row.description,
        parent_id: row.parent_id ? `char_${row.parent_id}` : null,
        ordering: row.ordering,
        show_in_main_params: row.show_in_main_params,
        main_params_priority: row.main_params_priority,
        level: row.level,
        source_type: 'characteristic_group',
        original_id: row.id,
        enums: row.enum_values,
        children: [],
        children_count: row.children_count,
        has_children: row.children_count > 0
      };

      characteristicGroupsMap.set(`char_${row.id}`, group);

      if (row.parent_id === null) {
        rootCharacteristicGroups.push(group);
      }
    });

    characteristicGroupsQuery.rows.forEach((row: any) => {
      if (row.parent_id !== null) {
        const parent = characteristicGroupsMap.get(`char_${row.parent_id}`);
        const child = characteristicGroupsMap.get(`char_${row.id}`);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    });

    const manufacturersMap = new Map();
    const rootManufacturers = [];

    manufacturersQuery.rows.forEach((row: any) => {
      const manufacturer = {
        id: `cat_${row.id}`,
        name: row.name,
        description: row.description,
        parent_id: row.parent_id ? `cat_${row.parent_id}` : null,
        ordering: row.sort_order,
        level: row.level,
        source_type: 'category',
        original_id: row.id,
        enums: [],
        children: [],
        children_count: row.children_count,
        has_children: row.children_count > 0
      };

      manufacturersMap.set(`cat_${row.id}`, manufacturer);

      if (row.parent_id === null) {
        rootManufacturers.push(manufacturer);
      }
    });

    manufacturersQuery.rows.forEach((row: any) => {
      if (row.parent_id !== null) {
        const parent = manufacturersMap.get(`cat_${row.parent_id}`);
        const child = manufacturersMap.get(`cat_${row.id}`);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    });

    const allData = [
      ...rootCharacteristicGroups,
      ...rootManufacturers
    ];

    return NextResponse.json({
      success: true,
      data: allData,
      hierarchical: true,
      total_groups: allData.length,
      characteristic_groups_count: rootCharacteristicGroups.length,
      manufacturers_count: rootManufacturers.length
    });
  } catch (error) {
    console.error('Ошибка получения групп характеристик:', error);
    return NextResponse.json({ success: false, error: 'Ошибка получения данных' }, { status: 500 });
  }
}

// POST /api/specifications - Create new specification enum
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, data_type, unit, group_id, is_required, enum_values } = body;

    if (!name || !group_id) {
      return NextResponse.json(
        { success: false, error: 'Название и группа обязательны' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    // Создаем характеристику
    const characteristicResult = await client.query(
      `INSERT INTO characteristics (name, description, data_type, unit, group_id, is_required, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [name, description, data_type || 'text', unit, group_id, is_required || false]
    );

    const characteristic = characteristicResult.rows[0];

    // Если есть enum значения, добавляем их
    if (enum_values && Array.isArray(enum_values) && enum_values.length > 0) {
      for (let i = 0; i < enum_values.length; i++) {
        const enumValue = enum_values[i];
        await client.query(
          `INSERT INTO characteristic_enums (characteristic_id, value, display_name, color_hex, ordering, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [characteristic.id, enumValue.value, enumValue.display_name, enumValue.color_hex, i + 1]
        );
      }
    }

    client.release();

    return NextResponse.json({
      success: true,
      data: characteristic
    });
  } catch (error) {
    console.error('Ошибка создания характеристики:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка создания характеристики' },
      { status: 500 }
    );
  }
}