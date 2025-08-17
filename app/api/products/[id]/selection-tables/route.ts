import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'
import { requireAuth, hasPermission } from '@/lib/database-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    logger.info('Selection tables GET request', { productId })

    // Загружаем таблицы подбора для продукта из правильной таблицы
    const query = `
      SELECT
        pst.id,
        pst.product_id,
        pst.sku,
        pst.table_type,
        pst.title,
        pst.headers,
        pst.rows,
        pst.is_active,
        pst.created_at,
        pst.updated_at,
        p.name as product_name
      FROM product_selection_tables pst
      LEFT JOIN products p ON pst.product_id = p.id
      WHERE pst.product_id = $1 AND (pst.is_active = true OR pst.is_active IS NULL)
      ORDER BY pst.table_type, pst.created_at
    `

    const result = await executeQuery(query, [productId])

    // Преобразуем данные в формат, ожидаемый клиентом
    const tablesData: Record<string, any> = {}

    result.rows.forEach(row => {
      const tableKey = row.table_type || 'default'

      tablesData[tableKey] = {
        title: row.title,
        headers: Array.isArray(row.headers) ? row.headers : JSON.parse(row.headers || '[]'),
        rows: Array.isArray(row.rows) ? row.rows : JSON.parse(row.rows || '[]')
      }
    })

    const _duration = Date.now() - startTime
    logger.info('Selection tables loaded', { productId, count: result.rows.length, duration: _duration })

    return NextResponse.json({
      success: true,
      data: tablesData,
      count: result.rows.length
    })

  } catch (error) {
    const _duration = Date.now() - startTime
    logger.error('Error loading selection tables', error, 'API')

    return NextResponse.json({
      success: false,
      error: 'Failed to load selection tables',
      message: error instanceof Error ? error.message : 'Database operation failed'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.update') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const { id } = await params
    const productId = parseInt(id)

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
      logger.error('Failed to parse request body', parseError)
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    logger.info('Selection tables PUT request', { productId, tablesData: data.tables })

// Проверяем существование продукта
    const productCheck = await executeQuery(
      'SELECT id, sku FROM products WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)',
      [productId]
    )

    if (productCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    const product = productCheck.rows[0]

    // Если переданы таблицы, обновляем/создаем их
    if (data.tables && typeof data.tables === 'object') {
      // Начинаем транзакцию
      await executeQuery('BEGIN')

      try {
        // Проверяем, есть ли таблицы для сохранения
        const tablesToSave = Object.entries(data.tables).filter(([_, tableData]) => {
          if (!tableData || typeof tableData !== 'object') return false
          const table = tableData as any
          return 'title' in table &&
                 'headers' in table &&
                 'rows' in table &&
                 typeof table.title === 'string' &&
                 Array.isArray(table.headers) &&
                 Array.isArray(table.rows)
        })

        let tablesCount = 0

        if (tablesToSave.length === 0) {
          // Если нет таблиц для сохранения, полностью удаляем все таблицы продукта

          await executeQuery(
            'DELETE FROM product_selection_tables WHERE product_id = $1',
            [productId]
          )
          logger.info('All selection tables deleted for product', { productId })
        } else {
          // Удаляем существующие таблицы для этого продукта
          await executeQuery(
            'DELETE FROM product_selection_tables WHERE product_id = $1',
            [productId]
          )

          // Добавляем новые таблицы
          for (const [tableType, tableData] of tablesToSave) {
            const table = tableData as any
            await executeQuery(`
              INSERT INTO product_selection_tables (
                product_id, sku, table_type, title, headers, rows,
                is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (product_id, table_type)
              DO UPDATE SET
                title = EXCLUDED.title,
                headers = EXCLUDED.headers,
                rows = EXCLUDED.rows,
                is_active = EXCLUDED.is_active,
                updated_at = CURRENT_TIMESTAMP
            `, [
              productId,
              product.sku,
              tableType,
              table.title,
              JSON.stringify(table.headers),
              JSON.stringify(table.rows),
              true
            ])
            tablesCount++
          }
        }

        await executeQuery('COMMIT')

        const _duration = Date.now() - startTime
        logger.info('Selection tables updated', { productId, tablesCount, duration: _duration })

        return NextResponse.json({
          success: true,
          message: 'Selection tables updated successfully',
          count: tablesCount
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
    logger.error('Selection tables PUT error', error, 'API')

    return NextResponse.json({
      success: false,
      error: 'Failed to update selection tables',
      message: error instanceof Error ? error.message : 'Database operation failed'
    }, { status: 500 })
  }
}