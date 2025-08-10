import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"
import { getPool } from '@/lib/db-connection'
import { guardDbOr503, tablesExist } from '@/lib/api-guards'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardDbOr503()
    if (guard) return guard

    const need = await tablesExist(['size_charts','size_chart_values'])
    if (!need.size_charts) {
      return NextResponse.json({ success: true, data: [] })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = `
      SELECT DISTINCT
        sc.id,
        sc.name,
        sc.category_id,
        sc.description,
        sc.created_at,
        sc.updated_at
      FROM size_charts sc
      WHERE sc.is_active = true
    `

    const queryParams: any[] = []
    let paramIndex = 1

    if (category) {
      query += ` AND sc.category_id = $${paramIndex++}`
      queryParams.push(parseInt(category))
    }

    query += ` ORDER BY sc.category_id, sc.name`

    const result = await executeQuery(query, queryParams)
    const chartIds = result.rows.map((chart: any) => chart.id)

    if (chartIds.length > 0 && need.size_chart_values) {
      const valuesQuery = `
        SELECT
          sv.*
        FROM size_chart_values sv
        WHERE sv.size_chart_id = ANY($1)
        ORDER BY sv.size_chart_id, sv.sort_order, sv.size_value
      `

      const valuesResult = await executeQuery(valuesQuery, [chartIds])

      const valuesByChart = valuesResult.rows.reduce((acc: any, value: any) => {
        const key = value.size_chart_id
        if (!acc[key]) acc[key] = []
        acc[key].push(value)
        return acc
      }, {})

      result.rows.forEach((chart: any) => {
        chart.values = valuesByChart[chart.id] || []
      })
    }

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error("Error fetching size charts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch size charts",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// POST /api/size-charts - создать новую размерную сетку
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      name,
      description,
      categoryId,
      sizeType,
      unit,
      isActive = true,
      values = []
    } = body

    if (!name || !sizeType) {
      return NextResponse.json(
        { error: 'Name and size type are required' },
        { status: 400 }
      )
    }

    // Начинаем транзакцию
    const pool = getPool()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Создаем размерную сетку
      const insertChartQuery = `
        INSERT INTO size_charts (name, description, category_id, size_type, unit, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `

      const chartValues = [name, description, categoryId, sizeType, unit, isActive]
      const chartResult = await client.query(insertChartQuery, chartValues)
      const newChart = chartResult.rows[0]

      // Если есть значения размеров, добавляем их
      let chartValues_list = []
      if (values.length > 0) {
        for (const value of values) {
          const insertValueQuery = `
            INSERT INTO size_chart_values (
              size_chart_id, size_name, size_value, min_value, max_value,
              description, sort_order, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `

          const valueParams = [
            newChart.id,
            value.sizeName,
            value.sizeValue,
            value.minValue,
            value.maxValue,
            value.description,
            value.sortOrder || 0,
            value.isActive !== false
          ]

          const valueResult = await client.query(insertValueQuery, valueParams)
          chartValues_list.push({
            id: valueResult.rows[0].id,
            sizeName: valueResult.rows[0].size_name,
            sizeValue: valueResult.rows[0].size_value,
            minValue: valueResult.rows[0].min_value ? parseFloat(valueResult.rows[0].min_value) : null,
            maxValue: valueResult.rows[0].max_value ? parseFloat(valueResult.rows[0].max_value) : null,
            description: valueResult.rows[0].description,
            sortOrder: valueResult.rows[0].sort_order,
            isActive: valueResult.rows[0].is_active
          })
        }
      }

      await client.query('COMMIT')

      const response = {
        id: newChart.id,
        name: newChart.name,
        description: newChart.description,
        categoryId: newChart.category_id,
        sizeType: newChart.size_type,
        unit: newChart.unit,
        isActive: newChart.is_active,
        createdAt: newChart.created_at,
        updatedAt: newChart.updated_at,
        values: chartValues_list
      }

      return NextResponse.json(response, { status: 201 })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error: any) {
    console.error('Error creating size chart:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Size chart with this name already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create size chart' },
      { status: 500 }
    )
  }
}