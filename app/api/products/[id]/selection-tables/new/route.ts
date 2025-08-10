import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'
import { guardDbOr503, tablesExist } from '@/lib/api-guards'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  try {
    const guard = await guardDbOr503()
    if (guard) return guard

    const productId = parseInt(params.id)

    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    logger.info('New product selection tables GET request', { productId })

    const need = await tablesExist(['selection_tables'])
    if (!need.selection_tables) {
      return NextResponse.json({ success: true, data: {} })
    }

    const query = `
      SELECT
        st.*,
        p.name as product_name
      FROM selection_tables st
      LEFT JOIN products p ON st.product_id = p.id
      WHERE st.product_id = $1
        AND st.table_type = 'new_product'
        AND (st.is_deleted = false OR st.is_deleted IS NULL)
      ORDER BY st.created_at DESC
    `

    const result = await executeQuery(query, [productId])

    const tables = result.rows.reduce((acc: any, row: any) => {
      try {
        const tableData = typeof row.table_data === 'string'
          ? JSON.parse(row.table_data)
          : row.table_data

        acc[row.table_name || 'default'] = {
          id: row.id,
          title: row.table_name,
          description: row.description,
          data: tableData,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      } catch (parseError: any) {
        logger.warn('Failed to parse table data', { tableId: row.id, error: parseError.message })
      }
      return acc
    }, {})

    const _duration = Date.now() - startTime
    logger.info('New product selection tables loaded', {
      productId,
      tablesCount: Object.keys(tables).length,
      duration
    })

    return NextResponse.json({
      success: true,
      data: tables
    })

  } catch (error) {
    const _duration = Date.now() - startTime
    logger.error('Error loading new product selection tables', error as any, 'API')

    return NextResponse.json({
      success: false,
      error: 'Failed to load new product selection tables',
      message: 'Database operation failed'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  try {
    const guard = await guardDbOr503()
    if (guard) return guard

    const productId = parseInt(params.id)

    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    let data
    try {
      data = await request.json()
    } catch (parseError) {
      logger.error('Failed to parse request body', parseError as any)
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    logger.info('New product selection tables PUT request', { productId })

    const need = await tablesExist(['selection_tables', 'products'])
    if (!need.products) {
      return NextResponse.json({ success: false, error: 'Products table not found' }, { status: 503 })
    }
    if (!need.selection_tables) {
      return NextResponse.json({ success: false, error: 'Selection tables schema not initialized' }, { status: 503 })
    }

    const productCheck = await executeQuery(
      'SELECT id FROM products WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)',
      [productId]
    )

    if (productCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    if (data.tables && typeof data.tables === 'object') {
      await executeQuery('BEGIN')

      try {
        await executeQuery(
          `UPDATE selection_tables
           SET is_deleted = true
           WHERE product_id = $1 AND table_type = 'new_product'`,
          [productId]
        )

        let tablesAdded = 0
        for (const [tableName, tableInfo] of Object.entries(data.tables)) {
          if (tableInfo && typeof tableInfo === 'object') {
            const tableData = (tableInfo as any).data || tableInfo

            await executeQuery(`
              INSERT INTO selection_tables (
                product_id, table_type, table_name, table_data,
                description, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
              productId,
              'new_product',
              tableName,
              JSON.stringify(tableData),
              (tableInfo as any).description || null,
              (tableInfo as any).isActive !== false
            ])
            tablesAdded++
          }
        }

        await executeQuery('COMMIT')

        const _duration = Date.now() - startTime
        logger.info('New product selection tables updated', {
          productId,
          tablesAdded,
          duration
        })

        return NextResponse.json({
          success: true,
          message: 'New product selection tables updated successfully',
          count: tablesAdded
        })

      } catch (innerError) {
        await executeQuery('ROLLBACK')
        throw innerError
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'No tables data provided'
      }, { status: 400 })
    }

  } catch (error) {
    const _duration = Date.now() - startTime
    logger.error('New product selection tables PUT error', error as any, 'API')

    return NextResponse.json({
      success: false,
      error: 'Failed to update new product selection tables',
      message: 'Database operation failed'
    }, { status: 500 })
  }
}