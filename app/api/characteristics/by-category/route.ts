import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { logger } from '@/lib/logger'
import { guardDbOr503Fast, tablesExist } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

function isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const guard = guardDbOr503Fast()
    if (guard) return guard

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')
    const includeChildren = searchParams.get('include_children') === 'true'
    
    const need = await tablesExist([
      'products',
      'product_characteristics_simple',
      'characteristics_values_simple',
      'characteristics_groups_simple',
      'product_categories'
    ])
    if (!need.products || !need.product_characteristics_simple || !need.characteristics_values_simple || !need.characteristics_groups_simple) {
      return NextResponse.json({ success: false, error: 'Schema is not initialized' }, { status: 503 })
    }
    
    logger.info('Loading characteristics by category', { categoryId, includeChildren })
    
    let productQuery = ''
    const queryParams: any[] = []
    
    if (categoryId && categoryId !== 'all' && categoryId !== 'null') {
      if (includeChildren) {
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
            COALESCE(cg.parent_id, 0) as section_id,
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
          GROUP BY cg.id, cg.name, cg.parent_id, cv.id, cv.value, cv.color_hex
          ORDER BY cg.name, cv.value
        `
        queryParams.push(categoryId)
      } else {
        productQuery = `
          SELECT DISTINCT
            cg.id as group_id,
            cg.name as group_name,
            COALESCE(cg.parent_id, 0) as section_id,
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
          GROUP BY cg.id, cg.name, cg.parent_id, cv.id, cv.value, cv.color_hex
          ORDER BY cg.name, cv.value
        `
        queryParams.push(categoryId)
      }
    } else {
      productQuery = `
        SELECT DISTINCT
          cg.id as group_id,
          cg.name as group_name,
          COALESCE(cg.parent_id, 0) as section_id,
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
        GROUP BY cg.id, cg.name, cg.parent_id, cv.id, cv.value, cv.color_hex
        ORDER BY cg.name, cv.value
      `
    }
    
    const result = await pool.query(productQuery, queryParams)
    
    const sections: any = {}
    
    result.rows.forEach(row => {
      const sectionId = row.section_id || 0
      const sectionName = row.section_name || (sectionId === 0 ? 'Общие характеристики' : 'Раздел')
      
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
    
    const formattedData = {
      sections: Object.values(sections).map((section: any) => ({
        ...section,
        groups: Object.values(section.groups)
      }))
    }
    
    const duration = Date.now() - startTime
    
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