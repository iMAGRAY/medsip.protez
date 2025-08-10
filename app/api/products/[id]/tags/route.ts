import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { pool } from '@/lib/db'

// GET - получение тегов товара
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)
    
    // Проверяем валидность ID
    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный ID товара'
      }, { status: 400 })
    }
    
    const result = await pool.query(`
      SELECT 
        pt.id,
        pt.name,
        pt.slug,
        pt.color,
        pt.bg_color,
        pt.icon,
        pt.sort_order,
        pt.product_id
      FROM product_tags pt
      WHERE pt.is_active = true
        AND (
          -- Личные теги товара
          pt.product_id = $1
          OR
          -- Общие теги, связанные с товаром через таблицу связей
          (pt.product_id IS NULL AND EXISTS (
            SELECT 1 FROM product_tag_relations ptr 
            WHERE ptr.tag_id = pt.id AND ptr.product_id = $1
          ))
        )
      ORDER BY pt.product_id DESC NULLS LAST, pt.sort_order ASC, pt.name ASC
    `, [productId])
    
    return NextResponse.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching product tags:', {
      productId: params.id,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки тегов товара'
    }, { status: 500 })
  }
}

// POST - добавление тега к товару
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const sessionId = cookieStore.get('admin_session')?.value
    const isAdmin = !!sessionId
    
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен'
      }, { status: 403 })
    }
    
    const productId = parseInt(params.id)
    const body = await request.json()
    const { tag_id } = body
    
    if (!tag_id) {
      return NextResponse.json({
        success: false,
        error: 'ID тега обязателен'
      }, { status: 400 })
    }
    
    // Проверяем существование тега и что это не чужой личный тег
    const tagCheck = await pool.query(
      'SELECT id, product_id FROM product_tags WHERE id = $1', 
      [tag_id]
    )
    if (tagCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Тег не найден'
      }, { status: 404 })
    }
    
    // Проверяем, что это не личный тег другого товара
    const tag = tagCheck.rows[0]
    if (tag.product_id && tag.product_id !== productId) {
      return NextResponse.json({
        success: false,
        error: 'Нельзя добавить личный тег другого товара'
      }, { status: 400 })
    }
    
    // Если это личный тег этого товара, он уже привязан
    if (tag.product_id === productId) {
      return NextResponse.json({
        success: false,
        error: 'Личный тег уже привязан к товару'
      }, { status: 400 })
    }
    
    // Добавляем связь
    await pool.query(
      'INSERT INTO product_tag_relations (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [productId, tag_id]
    )
    
    // Возвращаем все теги товара
    const result = await pool.query(`
      SELECT 
        pt.id,
        pt.name,
        pt.slug,
        pt.color,
        pt.bg_color,
        pt.icon,
        pt.sort_order,
        pt.product_id
      FROM product_tags pt
      WHERE pt.is_active = true
        AND (
          -- Личные теги товара
          pt.product_id = $1
          OR
          -- Общие теги, связанные с товаром через таблицу связей
          (pt.product_id IS NULL AND EXISTS (
            SELECT 1 FROM product_tag_relations ptr 
            WHERE ptr.tag_id = pt.id AND ptr.product_id = $1
          ))
        )
      ORDER BY pt.product_id DESC NULLS LAST, pt.sort_order ASC, pt.name ASC
    `, [productId])
    
    return NextResponse.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error adding tag to product:', error)
    return NextResponse.json({
      success: false,
      error: 'Ошибка добавления тега'
    }, { status: 500 })
  }
}

// PUT - обновление тегов товара (замена всех тегов)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const sessionId = cookieStore.get('admin_session')?.value
    const isAdmin = !!sessionId
    
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен'
      }, { status: 403 })
    }
    
    const productId = parseInt(params.id)
    const body = await request.json()
    const { tag_ids } = body
    
    if (!Array.isArray(tag_ids)) {
      return NextResponse.json({
        success: false,
        error: 'tag_ids должен быть массивом'
      }, { status: 400 })
    }
    
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Удаляем существующие связи
      await client.query('DELETE FROM product_tag_relations WHERE product_id = $1', [productId])
      
      // Добавляем новые связи
      if (tag_ids.length > 0) {
        const values = tag_ids.map((_tagId, index) => `($1, $${index + 2})`).join(', ')
        const params = [productId, ...tag_ids]
        await client.query(
          `INSERT INTO product_tag_relations (product_id, tag_id) VALUES ${values}`,
          params
        )
      }
      
      await client.query('COMMIT')
      
      // Возвращаем обновленные теги
      const result = await client.query(`
        SELECT 
          pt.id,
          pt.name,
          pt.slug,
          pt.color,
          pt.bg_color,
          pt.icon,
          pt.sort_order
        FROM product_tags pt
        JOIN product_tag_relations ptr ON pt.id = ptr.tag_id
        WHERE ptr.product_id = $1 AND pt.is_active = true
        ORDER BY pt.sort_order ASC, pt.name ASC
      `, [productId])
      
      return NextResponse.json({
        success: true,
        data: result.rows
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating product tags:', error)
    return NextResponse.json({
      success: false,
      error: 'Ошибка обновления тегов'
    }, { status: 500 })
  }
}

// DELETE - удаление тега у товара
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const sessionId = cookieStore.get('admin_session')?.value
    const isAdmin = !!sessionId
    
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен'
      }, { status: 403 })
    }
    
    const productId = parseInt(params.id)
    const searchParams = request.nextUrl.searchParams
    const tagId = searchParams.get('tag_id')
    
    if (!tagId) {
      return NextResponse.json({
        success: false,
        error: 'ID тега обязателен'
      }, { status: 400 })
    }
    
    await pool.query(
      'DELETE FROM product_tag_relations WHERE product_id = $1 AND tag_id = $2',
      [productId, tagId]
    )
    
    return NextResponse.json({
      success: true,
      message: 'Тег удален'
    })
  } catch (error) {
    console.error('Error removing tag from product:', error)
    return NextResponse.json({
      success: false,
      error: 'Ошибка удаления тега'
    }, { status: 500 })
  }
}