import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/product-variants/[id] - получить конкретный вариант товара
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;

    const result = await pool.query(`
      SELECT
        pv.*,
        p.name as product_name,
        p.description as product_description,
        pc.name as category_name,
        m.name as manufacturer_name,
        ms.name as series_name
      FROM product_variants pv
      JOIN products p ON pv.master_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      LEFT JOIN model_series ms ON p.series_id = ms.id
      WHERE pv.id = $1 AND pv.is_deleted = FALSE
    `, [variantId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Вариант товара не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Ошибка получения варианта товара:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения варианта товара' },
      { status: 500 }
    );
  }
}

// PUT /api/product-variants/[id] - обновить вариант товара
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;
    const body = await request.json();
    const { sku, price_override, stock_override, attributes_json } = body;

    // Проверяем, что вариант существует
    const existingVariant = await pool.query(
      'SELECT id FROM product_variants WHERE id = $1 AND is_deleted = FALSE',
      [variantId]
    );

    if (existingVariant.rows.length === 0) {
      return NextResponse.json(
        { error: 'Вариант товара не найден' },
        { status: 404 }
      );
    }

    // Обновляем вариант
    const result = await pool.query(`
      UPDATE product_variants
      SET
        sku = COALESCE($2, sku),
        price_override = $3,
        stock_override = $4,
        attributes_json = COALESCE($5, attributes_json),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [variantId, sku, price_override, stock_override, attributes_json]);

    return NextResponse.json(result.rows[0]);

  } catch (error) {
    console.error('Ошибка обновления варианта товара:', error);
    return NextResponse.json(
      { error: 'Ошибка обновления варианта товара' },
      { status: 500 }
    );
  }
}

// DELETE /api/product-variants/[id] - удалить вариант товара (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;

    // Проверяем, что вариант существует
    const existingVariant = await pool.query(
      'SELECT id FROM product_variants WHERE id = $1 AND is_deleted = FALSE',
      [variantId]
    );

    if (existingVariant.rows.length === 0) {
      return NextResponse.json(
        { error: 'Вариант товара не найден' },
        { status: 404 }
      );
    }

    // Мягкое удаление варианта - устанавливаем is_deleted = TRUE и is_active = FALSE
    await pool.query(`
      UPDATE product_variants
      SET is_deleted = TRUE, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [variantId]);

    return NextResponse.json({
      message: 'Вариант товара успешно удален'
    });

  } catch (error) {
    console.error('Ошибка удаления варианта товара:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления варианта товара' },
      { status: 500 }
    );
  }
}