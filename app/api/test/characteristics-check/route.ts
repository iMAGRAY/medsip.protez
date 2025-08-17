import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(_request: NextRequest) {
  try {
    // 1. Проверяем есть ли вообще характеристики
    const checkCharacteristics = await pool.query(`
      SELECT 
        COUNT(*) as total_characteristics,
        COUNT(DISTINCT product_id) as products_with_characteristics
      FROM product_characteristics_simple
    `)
    
    // 2. Проверяем товары по категориям
    const productsByCategory = await pool.query(`
      SELECT 
        pc.id as category_id,
        pc.name as category_name,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT pcs.product_id) as products_with_characteristics
      FROM product_categories pc
      LEFT JOIN products p ON p.category_id = pc.id AND p.is_deleted = false
      LEFT JOIN product_characteristics_simple pcs ON pcs.product_id = p.id
      GROUP BY pc.id, pc.name
      ORDER BY pc.name
    `)
    
    // 3. Проверяем структуру характеристик
    const characteristicGroups = await pool.query(`
      SELECT 
        cg.id,
        cg.name as group_name,
        COUNT(DISTINCT cv.id) as values_count
      FROM characteristics_groups_simple cg
      LEFT JOIN characteristics_values_simple cv ON cv.group_id = cg.id
      GROUP BY cg.id, cg.name
      ORDER BY cg.name
    `)
    
    // 4. Пример товара с характеристиками
    const sampleProduct = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.category_id,
        pc.name as category_name,
        COUNT(pcs.id) as characteristics_count
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN product_characteristics_simple pcs ON pcs.product_id = p.id
      WHERE p.is_deleted = false
      GROUP BY p.id, p.name, p.category_id, pc.name
      HAVING COUNT(pcs.id) > 0
      LIMIT 1
    `)
    
    // 5. Если есть товар с характеристиками, показываем его характеристики
    let productCharacteristics = []
    if (sampleProduct.rows.length > 0) {
      const productId = sampleProduct.rows[0].id
      const characteristics = await pool.query(`
        SELECT 
          cg.name as group_name,
          cv.value,
          pcs.additional_value
        FROM product_characteristics_simple pcs
        JOIN characteristics_values_simple cv ON pcs.value_id = cv.id
        JOIN characteristics_groups_simple cg ON cv.group_id = cg.id
        WHERE pcs.product_id = $1
      `, [productId])
      productCharacteristics = characteristics.rows
    }
    
    return NextResponse.json({
      success: true,
      data: {
        summary: checkCharacteristics.rows[0],
        productsByCategory: productsByCategory.rows,
        characteristicGroups: characteristicGroups.rows,
        sampleProduct: sampleProduct.rows[0] || null,
        productCharacteristics
      }
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}