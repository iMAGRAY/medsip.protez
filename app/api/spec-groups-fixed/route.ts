import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function GET() {
  try {
    const isDbConfigured = !!process.env.DATABASE_URL || (
      !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
    )
    if (!isDbConfigured) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    // Используем представление characteristic_groups вместо несуществующей spec_groups
    const query = `
      WITH RECURSIVE group_tree AS (
        -- Базовый случай: корневые группы
        SELECT
          cg.id,
          cg.name,
          cg.description,
          cg.parent_id,
          cg.sort_order as ordering,
          cg.is_active,
          cg.created_at,
          cg.updated_at,
          0 as level,
          ARRAY[cg.sort_order, cg.id] as path
        FROM characteristics_groups_simple cg
        WHERE cg.parent_id IS NULL AND cg.is_active = true

        UNION ALL

        -- Рекурсивный случай: дочерние группы
        SELECT
          cg.id,
          cg.name,
          cg.description,
          cg.parent_id,
          cg.sort_order as ordering,
          cg.is_active,
          cg.created_at,
          cg.updated_at,
          gt.level + 1,
          gt.path || ARRAY[cg.sort_order, cg.id]
        FROM characteristics_groups_simple cg
        INNER JOIN group_tree gt ON cg.parent_id = gt.id
        WHERE cg.is_active = true
      )
      SELECT
        gt.id,
        gt.name,
        gt.description,
        gt.parent_id,
        gt.ordering,
        gt.level,
        gt.is_active,
        (SELECT COUNT(*) FROM characteristics_groups_simple WHERE parent_id = gt.id AND is_active = true) as children_count,
        (SELECT COUNT(*) FROM characteristics_values_simple WHERE group_id = gt.id AND is_active = true) as values_count,
        gt.created_at,
        gt.updated_at
      FROM group_tree gt
      ORDER BY gt.path
    `

    const result = await pool.query(query)
    
    // Строим иерархическую структуру
    const groupsMap = new Map()
    const rootGroups: any[] = []

    result.rows.forEach(row => {
      const group = {
        id: row.id,
        name: row.name,
        description: row.description,
        parent_id: row.parent_id,
        ordering: row.ordering,
        level: row.level,
        is_active: row.is_active,
        children_count: parseInt(row.children_count),
        values_count: parseInt(row.values_count),
        created_at: row.created_at,
        updated_at: row.updated_at,
        children: []
      }

      groupsMap.set(group.id, group)

      if (!group.parent_id) {
        rootGroups.push(group)
      } else {
        const parent = groupsMap.get(group.parent_id)
        if (parent) {
          parent.children.push(group)
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: rootGroups,
      total: result.rows.length
    })

  } catch (error) {
    console.error('Error fetching characteristic groups:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch characteristic groups',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const isDbConfigured = !!process.env.DATABASE_URL || (
      !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
    )
    if (!isDbConfigured) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const body = await request.json()
    const { name, description, parent_id } = body

    if (!name) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Name is required' 
        },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `INSERT INTO characteristics_groups_simple (name, description, parent_id, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, COALESCE((SELECT MAX(sort_order) + 1 FROM characteristics_groups_simple WHERE parent_id = $3), 0), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [name, description || null, parent_id || null]
    )

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating characteristic group:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create characteristic group',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}