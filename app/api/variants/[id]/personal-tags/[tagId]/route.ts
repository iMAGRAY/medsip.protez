import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { pool } from '@/lib/db'

// DELETE - удаление личного тега варианта
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, tagId: string } }
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
    
    const variantId = parseInt(params.id)
    const tagId = parseInt(params.tagId)
    
    if (isNaN(variantId) || isNaN(tagId)) {
      return NextResponse.json({
        success: false,
        error: 'Неверные параметры'
      }, { status: 400 })
    }
    
    // Проверяем, что это действительно личный тег этого варианта
    const checkResult = await pool.query(
      'SELECT variant_id FROM product_tags WHERE id = $1',
      [tagId]
    )
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Тег не найден'
      }, { status: 404 })
    }
    
    const tag = checkResult.rows[0]
    
    if (tag.variant_id !== variantId) {
      return NextResponse.json({
        success: false,
        error: 'Тег не принадлежит этому варианту'
      }, { status: 403 })
    }
    
    // Удаляем личный тег полностью
    await pool.query(
      'DELETE FROM product_tags WHERE id = $1 AND variant_id = $2',
      [tagId, variantId]
    )
    
    return NextResponse.json({
      success: true,
      message: 'Личный тег варианта удален'
    })
  } catch (error) {
    console.error('Error deleting variant personal tag:', error)
    return NextResponse.json({
      success: false,
      error: 'Ошибка удаления личного тега варианта'
    }, { status: 500 })
  }
}