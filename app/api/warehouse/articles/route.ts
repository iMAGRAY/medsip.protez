import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';

// GET - получить все товары с возможностью присвоения артикулов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const manufacturer = searchParams.get('manufacturer');
    const search = searchParams.get('search');
    const withInventory = searchParams.get('with_inventory') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category_id,
        p.manufacturer_id,
        p.series_id,
        p.article_number,
        p.price,
        p.created_at,
        p.updated_at,
        p.stock_quantity,
        c.name as category_name,
        m.name as manufacturer_name,
        ml.name as model_line_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      LEFT JOIN model_series ml ON p.series_id = ml.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND c.name = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (manufacturer) {
      query += ` AND m.name = $${paramIndex}`;
      params.push(manufacturer);
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR p.article_number ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (withInventory) {
      query += ` AND EXISTS (SELECT 1 FROM warehouse_inventory wi WHERE wi.product_id = p.id)`;
    }

    let countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE 1=1
    `;

    const countParams: any[] = [];
    let countParamIndex = 1;

    if (category) {
      countQuery += ` AND c.name = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }
    if (manufacturer) {
      countQuery += ` AND m.name = $${countParamIndex}`;
      countParams.push(manufacturer);
      countParamIndex++;
    }
    if (search) {
      countQuery += ` AND (p.name ILIKE $${countParamIndex} OR p.description ILIKE $${countParamIndex} OR p.article_number ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    if (withInventory) {
      countQuery += ` AND EXISTS (SELECT 1 FROM warehouse_inventory wi WHERE wi.product_id = p.id)`;
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    query += `
      ORDER BY p.name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await executeQuery(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения товаров для артикулов'
    }, { status: 500 });
  }
}

// POST - создать складской артикул для существующего товара
export async function POST(request: NextRequest) {
  try {
    const {
      product_id, sku, section_id, quantity, min_stock, max_stock,
      unit_price, supplier, batch_number, expiry_date
    } = await request.json();

    if (!product_id || !sku || !section_id || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Обязательные поля: product_id, sku, section_id, quantity'
      }, { status: 400 });
    }

    // Проверяем, что товар существует
    const productCheck = await executeQuery(`
      SELECT id, name FROM products WHERE id = $1
    `, [product_id]);

    if (productCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Товар не найден или неактивен'
      }, { status: 404 });
    }

    // Проверяем, что секция существует
    const sectionCheck = await executeQuery(`
      SELECT id FROM warehouse_sections WHERE id = $1
    `, [section_id]);

    if (sectionCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Секция склада не найдена'
      }, { status: 404 });
    }

    // Создаем запись в инвентаре
    const result = await executeQuery(`
      INSERT INTO warehouse_inventory (
        product_id, sku, section_id, quantity, min_stock, max_stock,
        unit_price, supplier, batch_number, expiry_date, status, last_counted
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      product_id, sku, section_id, quantity, min_stock || 0, max_stock || 100,
      unit_price, supplier, batch_number, expiry_date
    ]);

    // Записываем движение товара
    await executeQuery(`
      INSERT INTO warehouse_movements (
        inventory_id, movement_type, quantity, to_section_id,
        reason, user_name, notes
      )
      VALUES ($1, 'in', $2, $3, 'Добавление товара в инвентарь', 'System', 'Создание складского артикула')
    `, [result.rows[0].id, quantity, section_id]);

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка создания складского артикула'
    }, { status: 500 });
  }
}

// PUT - обновить складской артикул
export async function PUT(request: NextRequest) {
  try {
    const {
      id, sku, section_id, quantity, min_stock, max_stock,
      unit_price, supplier, batch_number, expiry_date, status
    } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID складского артикула обязателен'
      }, { status: 400 });
    }

    // Получаем текущие данные для отслеживания изменений
    const currentResult = await executeQuery(`
      SELECT quantity, section_id FROM warehouse_inventory WHERE id = $1
    `, [id]);

    if (currentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Складской артикул не найден'
      }, { status: 404 });
    }

    const currentQuantity = currentResult.rows[0].quantity;
    const currentSectionId = currentResult.rows[0].section_id;

    const result = await executeQuery(`
      UPDATE warehouse_inventory
      SET sku = $2, section_id = $3, quantity = $4, min_stock = $5,
          max_stock = $6, unit_price = $7, supplier = $8,
          batch_number = $9, expiry_date = $10, status = $11,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      id, sku, section_id, quantity, min_stock, max_stock,
      unit_price, supplier, batch_number, expiry_date, status || 'active'
    ]);

    // Записываем движение если изменилось количество или секция
    if (quantity !== currentQuantity) {
      const movementType = quantity > currentQuantity ? 'in' : 'out';
      const movementQuantity = Math.abs(quantity - currentQuantity);

      await executeQuery(`
        INSERT INTO warehouse_movements (
          inventory_id, movement_type, quantity,
          ${movementType === 'in' ? 'to_section_id' : 'from_section_id'},
          reason, user_name, notes
        )
        VALUES ($1, $2, $3, $4, 'Корректировка количества', 'System', 'Обновление складского артикула')
      `, [id, movementType, movementQuantity, section_id]);
    }

    if (section_id !== currentSectionId) {
      await executeQuery(`
        INSERT INTO warehouse_movements (
          inventory_id, movement_type, quantity, from_section_id, to_section_id,
          reason, user_name, notes
        )
        VALUES ($1, 'transfer', $2, $3, $4, 'Перемещение между секциями', 'System', 'Обновление складского артикула')
      `, [id, quantity, currentSectionId, section_id]);
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка обновления складского артикула'
    }, { status: 500 });
  }
}

// DELETE - удалить складской артикул
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID складского артикула обязателен'
      }, { status: 400 });
    }

    // Получаем данные перед удалением
    const currentResult = await executeQuery(`
      SELECT quantity, section_id FROM warehouse_inventory WHERE id = $1
    `, [id]);

    if (currentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Складской артикул не найден'
      }, { status: 404 });
    }

    const { quantity, section_id } = currentResult.rows[0];

    // Записываем движение на списание
    await executeQuery(`
      INSERT INTO warehouse_movements (
        inventory_id, movement_type, quantity, from_section_id,
        reason, user_name, notes
      )
      VALUES ($1, 'out', $2, $3, 'Удаление артикула', 'System', 'Полное списание товара')
    `, [id, quantity, section_id]);

    // Удаляем запись
    await executeQuery(`DELETE FROM warehouse_inventory WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      message: 'Складской артикул удален'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Ошибка удаления складского артикула'
    }, { status: 500 });
  }
}