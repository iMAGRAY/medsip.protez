// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'

// GET /api/categories-flat - Получить плоский список всех активных категорий для форм товаров
export async function GET(request: NextRequest) {
  try {

    // Сначала получаем просто все активные категории
    const query = `
      SELECT
        id,
        name,
        description,
        parent_id,
        type,
        is_active,
        created_at,
        updated_at
      FROM product_categories
      WHERE is_active = true
      ORDER BY parent_id NULLS FIRST, name
    `

    const result = await executeQuery(query)

    // Строим иерархию вручную
    const categoriesMap = new Map()
    const rootCategories = []

    // Сначала создаем мапу всех категорий
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

    // Теперь строим иерархию и вычисляем уровни
    const calculateHierarchy = (categoryId, level = 0, parentPath = '') => {
      const category = categoriesMap.get(categoryId)
      if (!category) return

      category.level = level
      category.full_path = parentPath ? `${parentPath} → ${category.name}` : category.name
      category.display_name = '  '.repeat(level) + category.name

      // Найдем всех детей
      result.rows.forEach(row => {
        if (row.parent_id === categoryId) {
          category.children.push(row.id)
          calculateHierarchy(row.id, level + 1, category.full_path)
        }
      })
    }

    // Начинаем с корневых категорий
    result.rows.forEach(row => {
      if (row.parent_id === null) {
        rootCategories.push(row.id)
        calculateHierarchy(row.id, 0)
      }
    })

    // Преобразуем обратно в массив с правильным порядком
    const flattenHierarchy = (categoryIds, result = []) => {
      categoryIds.forEach(id => {
        const category = categoriesMap.get(id)
        if (category) {
          result.push(category)
          if (category.children.length > 0) {
            flattenHierarchy(category.children, result)
          }
        }
      })
      return result
    }

    const categories = flattenHierarchy(rootCategories)

    const levelCounts = {}
    categories.forEach(cat => {
      levelCounts[cat.level] = (levelCounts[cat.level] || 0) + 1
    })
    Object.entries(levelCounts).forEach(([level, count]) => {

    })

    // Убираем children из финального результата (не нужны в форме)
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