import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')
    const includeChildren = searchParams.get('include_children') === 'true'
    
    console.log('🎯 API /characteristics/by-category вызван:', { categoryId, includeChildren })
    logger.info('Loading characteristics by category', { categoryId, includeChildren })
    
    let productQuery = ''
    const queryParams: any[] = []
    
    if (categoryId && categoryId !== 'all' && categoryId !== 'null') {
      if (includeChildren) {
        // Получаем все дочерние категории рекурсивно
        productQuery = `
          WITH RECURSIVE category_tree AS (
            SELECT id FROM product_categories WHERE id = $1
            UNION ALL
            SELECT pc.id 
            FROM product_categories pc
            INNER JOIN category_tree ct ON pc.parent_id = ct.id
          )
          SELECT DISTINCT
            cg.id as group_id,
            cg.name as group_name,
            0 as section_id,
            NULL as section_name,
            cv.id as value_id,
            cv.value,
            cv.color_hex,
            COUNT(DISTINCT p.id) as product_count
          FROM products p
          INNER JOIN category_tree ct ON p.category_id = ct.id
          INNER JOIN product_characteristics_simple pcs ON p.id = pcs.product_id
          INNER JOIN characteristics_values_simple cv ON pcs.value_id = cv.id
          INNER JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
          WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
          GROUP BY cg.id, cg.name, cv.id, cv.value, cv.color_hex
          ORDER BY cg.name, cv.value
        `
        queryParams.push(categoryId)
      } else {
        // Только товары из указанной категории
        productQuery = `
          SELECT DISTINCT
            cg.id as group_id,
            cg.name as group_name,
            cg.section_id,
            NULL as section_name,
            cv.id as value_id,
            cv.value,
            cv.color_hex,
            COUNT(DISTINCT p.id) as product_count
          FROM products p
          INNER JOIN product_characteristics_simple pcs ON p.id = pcs.product_id
          INNER JOIN characteristics_values_simple cv ON pcs.value_id = cv.id
          INNER JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
          WHERE p.category_id = $1 AND (p.is_deleted = false OR p.is_deleted IS NULL)
          GROUP BY cg.id, cg.name, cg.section_id, cv.id, cv.value, cv.color_hex
          ORDER BY cg.name, cv.value
        `
        queryParams.push(categoryId)
      }
    } else {
      // Все характеристики для всех товаров
      productQuery = `
        SELECT DISTINCT
          cg.id as group_id,
          cg.name as group_name,
          cg.section_id,
          NULL as section_name,
          cv.id as value_id,
          cv.value,
          cv.color_hex,
          COUNT(DISTINCT p.id) as product_count
        FROM products p
        INNER JOIN product_characteristics_simple pcs ON p.id = pcs.product_id
        INNER JOIN characteristics_values_simple cv ON pcs.value_id = cv.id
        INNER JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
        WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
        GROUP BY cg.id, cg.name, cg.section_id, cv.id, cv.value, cv.color_hex
        ORDER BY cg.name, cv.value
      `
    }
    
    const result = await pool.query(productQuery, queryParams)
    
    // Группируем результаты по секциям и группам
    const sections: any = {}
    
    result.rows.forEach(row => {
      const sectionName = row.section_name || 'Общие характеристики'
      const sectionId = row.section_id || 0
      
      if (!sections[sectionId]) {
        sections[sectionId] = {
          section_id: sectionId,
          section_name: sectionName,
          groups: {}
        }
      }
      
      if (!sections[sectionId].groups[row.group_id]) {
        sections[sectionId].groups[row.group_id] = {
          group_id: row.group_id,
          group_name: row.group_name,
          values: []
        }
      }
      
      sections[sectionId].groups[row.group_id].values.push({
        value_id: row.value_id,
        value: row.value,
        color_hex: row.color_hex,
        product_count: parseInt(row.product_count)
      })
    })
    
    // Преобразуем в массивы
    const formattedData = {
      sections: Object.values(sections).map((section: any) => ({
        ...section,
        groups: Object.values(section.groups)
      }))
    }
    
    const duration = Date.now() - startTime
    
    console.log('✅ API результат:', {
      categoryId,
      sectionsCount: formattedData.sections.length,
      totalRows: result.rows.length,
      firstRows: result.rows.slice(0, 3)
    })
    
    logger.info('Characteristics loaded by category', { 
      categoryId, 
      sectionsCount: formattedData.sections.length,
      duration 
    })
    
    return NextResponse.json({
      success: true,
      data: formattedData,
      duration
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Error loading characteristics by category', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to load characteristics',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration
      },
      { status: 500 }
    )
  }
}