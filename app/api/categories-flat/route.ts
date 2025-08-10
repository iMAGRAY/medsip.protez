// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'

function isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

// GET /api/categories-flat - Получить плоский список всех активных категорий для форм товаров
export async function GET(request: NextRequest) {
  try {

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const exists = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema='public' AND table_name='product_categories'
      ) as exist
    `)
    if (!exists.rows[0]?.exist) {
      return NextResponse.json({ success: false, error: 'Categories schema is not initialized' }, { status: 503 })
    }

    const query = `
      SELECT
        id,
        name,
        description,
        parent_id,
        type,
        (is_deleted = false OR is_deleted IS NULL) as is_active,
        created_at,
        updated_at
      FROM product_categories
      WHERE (is_deleted = false OR is_deleted IS NULL)
      ORDER BY parent_id NULLS FIRST, name
    `

    const result = await executeQuery(query)

    const categoriesMap = new Map()
    const rootCategories = []

    result.rows.forEach(row => {
      categoriesMap.set(row.id, {
        ...row,
        children: [],
        level: 0,
        full_path: row.name,
        display_name: row.name,
        is_root: row.parent_id === null
      })
    })

    const calculateHierarchy = (categoryId, level = 0, parentPath = '') => {
      const category = categoriesMap.get(categoryId)
      if (!category) return

      category.level = level
      category.full_path = parentPath ? `${parentPath} → ${category.name}` : category.name
      category.display_name = '  '.repeat(level) + category.name

      result.rows.forEach(row => {
        if (row.parent_id === categoryId) {
          category.children.push(row.id)
          calculateHierarchy(row.id, level + 1, category.full_path)
        }
      })
    }

    result.rows.forEach(row => {
      if (row.parent_id === null) {
        rootCategories.push(row.id)
        calculateHierarchy(row.id, 0)
      }
    })

    const flattenHierarchy = (categoryIds, resultArr = []) => {
      categoryIds.forEach(id => {
        const category = categoriesMap.get(id)
        if (category) {
          resultArr.push(category)
          if (category.children.length > 0) {
            flattenHierarchy(category.children, resultArr)
          }
        }
      })
      return resultArr
    }

    const categories = flattenHierarchy(rootCategories)

    const levelCounts = {}
    categories.forEach(cat => {
      levelCounts[cat.level] = (levelCounts[cat.level] || 0) + 1
    })

    const categoriesForForm = categories.map(cat => {
      const { children, ...categoryData } = cat
      return categoryData
    })

    return NextResponse.json({
      success: true,
      data: categoriesForForm,
      total: categoriesForForm.length,
      levels: Object.keys(levelCounts).length,
      flat: true
    })

  } catch (error) {
    console.error('❌ Categories Flat API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch categories',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}