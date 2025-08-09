import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  try {
    // Создание таблицы тегов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        color VARCHAR(7) DEFAULT '#6366f1',
        bg_color VARCHAR(7) DEFAULT '#e0e7ff',
        icon VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Создание таблицы связей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_tag_relations (
        id SERIAL PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(product_id, tag_id)
      )
    `)
    
    // Создание индексов
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_product_tag_relations_product_id ON product_tag_relations(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_tag_relations_tag_id ON product_tag_relations(tag_id);
      CREATE INDEX IF NOT EXISTS idx_product_tags_slug ON product_tags(slug);
      CREATE INDEX IF NOT EXISTS idx_product_tags_is_active ON product_tags(is_active);
    `)
    
    // Вставка начальных тегов
    const initialTags = [
      ['Новинка', 'new', '#10b981', '#d1fae5', 'sparkles', 10],
      ['Хит продаж', 'bestseller', '#f59e0b', '#fef3c7', 'trending-up', 20],
      ['Рекомендуем', 'recommended', '#8b5cf6', '#ede9fe', 'star', 30],
      ['Акция', 'sale', '#ef4444', '#fee2e2', 'percent', 40],
      ['Эксклюзив', 'exclusive', '#6366f1', '#e0e7ff', 'crown', 50],
      ['Премиум', 'premium', '#f59e0b', '#fef3c7', 'gem', 60],
      ['Экологичный', 'eco', '#10b981', '#d1fae5', 'leaf', 70],
      ['Гарантия 5 лет', 'warranty-5', '#3b82f6', '#dbeafe', 'shield-check', 80],
      ['Быстрая доставка', 'fast-delivery', '#06b6d4', '#cffafe', 'truck', 90],
      ['Сделано в России', 'made-in-russia', '#ef4444', '#fee2e2', 'flag', 100]
    ]
    
    for (const tag of initialTags) {
      try {
        await pool.query(
          `INSERT INTO product_tags (name, slug, color, bg_color, icon, sort_order) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          tag
        )
      } catch (insertError: any) {
        // Игнорируем ошибки дублирования (unique constraint violation)
        if (insertError.code !== '23505') {
          throw insertError
        }
      }
    }
    
    // Проверяем результат
    const result = await pool.query('SELECT COUNT(*) FROM product_tags')
    const count = result.rows[0].count
    
    return NextResponse.json({
      success: true,
      message: `Таблицы тегов созданы успешно. Всего тегов: ${count}`
    })
  } catch (error: any) {
    console.error('Error setting up tags:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}