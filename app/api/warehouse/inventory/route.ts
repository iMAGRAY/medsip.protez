import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';
import { getCacheManager } from '@/lib/dependency-injection';
import { invalidateRelated } from '@/lib/cache-manager';

// GET - получить инвентарь склада
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('section_id');
    const zoneId = searchParams.get('zone_id');
    const warehouseId = searchParams.get('warehouse_id');
    const productId = searchParams.get('product_id');
    const status = searchParams.get('status');
    const lowStock = searchParams.get('low_stock') === 'true';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Простой запрос для начала
    let query = `
      SELECT
        i.*,
        COALESCE(p.name, i.name) as product_name,
        COALESCE(p.article_number, '') as product_article,
        COALESCE(p.description, i.description) as product_description,
        COALESCE(c.name, '') as category_name,
        COALESCE(m.name, '') as manufacturer_name,
        COALESCE(s.name, '') as section_name,
        COALESCE(z.name, '') as zone_name,
        COALESCE(w.name, '') as warehouse_name,
        COALESCE(city.name, '') as city_name,
        COALESCE(r.name, '') as region_name,
        CASE
          WHEN i.quantity <= i.min_stock THEN 'low'
          WHEN i.quantity >= i.max_stock THEN 'high'
          ELSE 'normal'
        END as stock_level
      FROM warehouse_inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      LEFT JOIN warehouse_sections s ON i.section_id = s.id
      LEFT JOIN warehouse_zones z ON s.zone_id = z.id
      LEFT JOIN warehouse_warehouses w ON z.warehouse_id = w.id
      LEFT JOIN warehouse_cities city ON w.city_id = city.id
      LEFT JOIN warehouse_regions r ON city.region_id = r.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (sectionId) {
      query += ` AND i.section_id = $${paramIndex}`;
      params.push(sectionId);
      paramIndex++;
    }

    if (zoneId) {
      query += ` AND z.id = $${paramIndex}`;
      params.push(zoneId);
      paramIndex++;
    }

    if (warehouseId) {
      query += ` AND w.id = $${paramIndex}`;
      params.push(warehouseId);
      paramIndex++;
    }

    if (productId) {
      query += ` AND i.product_id = $${paramIndex}`;
      params.push(productId);
      paramIndex++;
    }

    if (status) {
      query += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (lowStock) {
      query += ` AND i.quantity <= i.min_stock`;
    }

    if (search) {
      query += ` AND (COALESCE(p.name, i.name) ILIKE $${paramIndex} OR COALESCE(p.article_number, '') ILIKE $${paramIndex} OR i.sku ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Получаем общее количество записей
    const countQuery = `SELECT COUNT(*) as total FROM warehouse_inventory i WHERE 1=1`;
    const countResult = await executeQuery(countQuery, []);
    const total = parseInt(countResult.rows[0].total) || 0;

    // Добавляем сортировку и пагинацию
    query += `
      ORDER BY i.name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await executeQuery(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows || [],
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
      error: 'Ошибка получения инвентаря'
    }, { status: 500 });
  }
}

// POST - добавить новый товар в инвентарь
export async function POST(request: NextRequest) {
    const cacheManager = getCacheManager();

    try {
        const body = await request.json();
        const {
            product_id, sku, name, description, section_id, quantity,
            min_stock, max_stock, unit_price, status, expiry_date,
            batch_number, supplier
        } = body;

        if (!sku || !name || !section_id || quantity === undefined) {
            return NextResponse.json({
                success: false,
                error: 'Обязательные поля: sku, name, section_id, quantity'
            }, { status: 400 });
        }

        const result = await executeQuery(`
            INSERT INTO warehouse_inventory (
                product_id, sku, name, description, section_id, quantity,
                min_stock, max_stock, unit_price, status, expiry_date,
                batch_number, supplier, last_counted
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            product_id, sku, name, description, section_id, quantity,
            min_stock || 0, max_stock || 100, unit_price, status || 'active',
            expiry_date, batch_number, supplier
        ]);

        // Записываем движение товара
        await executeQuery(`
            INSERT INTO warehouse_movements (
                inventory_id, movement_type, quantity, to_section_id,
                reason, user_name, notes
            )
            VALUES ($1, 'in', $2, $3, 'Добавление товара в инвентарь', 'Admin', 'Создание через интерфейс')
        `, [result.rows[0].id, quantity, section_id]);

        // Если связан с продуктом, обновляем статус товара
        if (product_id) {
            const stockStatus = quantity > 0 ? 'in_stock' : 'out_of_stock';
            await executeQuery(`
                UPDATE products
                SET stock_quantity = $2, stock_status = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [product_id, quantity, stockStatus]);
        }

        // Инвалидируем кэш после создания
        try {
            await invalidateRelated([
                'medsip:products:*',
                'products:*',
                'product:*',
                'warehouse:*',
                'inventory:*'
            ]);

            cacheManager.clear();

        } catch (cacheError) {
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка добавления товара в инвентарь'
        }, { status: 500 });
    }
}

// PUT - обновить товар в инвентаре
export async function PUT(request: NextRequest) {
    const cacheManager = getCacheManager();

    try {
        const body = await request.json();
        const {
            id, product_id, sku, name, description, section_id, quantity,
            min_stock, max_stock, unit_price, status, expiry_date,
            batch_number, supplier
        } = body;

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'ID товара обязателен'
            }, { status: 400 });
        }

        // Получаем текущие данные для отслеживания изменений
        const currentResult = await executeQuery(`
            SELECT quantity, section_id FROM warehouse_inventory WHERE id = $1
        `, [id]);

        if (currentResult.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Товар не найден'
            }, { status: 404 });
        }

        const currentData = currentResult.rows[0];

        const result = await executeQuery(`
            UPDATE warehouse_inventory
            SET product_id = $2, sku = $3, name = $4, description = $5, section_id = $6,
                quantity = $7, min_stock = $8, max_stock = $9, unit_price = $10,
                status = $11, expiry_date = $12, batch_number = $13, supplier = $14,
                last_counted = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [
            id, product_id, sku, name, description, section_id, quantity,
            min_stock, max_stock, unit_price, status, expiry_date,
            batch_number, supplier
        ]);

        if (result.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Не удалось обновить товар'
            }, { status: 404 });
        }

        // Записываем движение товара если количество изменилось
        const quantityDiff = quantity - currentData.quantity;
        if (quantityDiff !== 0) {
            await executeQuery(`
                INSERT INTO warehouse_movements (
                    inventory_id, movement_type, quantity, from_section_id, to_section_id,
                    reason, user_name, notes
                )
                VALUES ($1, $2, $3, $4, $5, 'Корректировка количества', 'Admin', 'Обновление через интерфейс')
            `, [
                id,
                quantityDiff > 0 ? 'adjustment' : 'adjustment',
                Math.abs(quantityDiff),
                quantityDiff > 0 ? null : currentData.section_id,
                quantityDiff > 0 ? section_id : null
            ]);
        }

        // Если связан с продуктом, обновляем статус товара
        if (product_id) {
            const stockStatus = quantity > 0 ? 'in_stock' : 'out_of_stock';
            await executeQuery(`
                UPDATE products
                SET stock_quantity = $2, stock_status = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [product_id, quantity, stockStatus]);
        }

        // Инвалидируем кэш после обновления
        try {
            await invalidateRelated([
                'medsip:products:*',
                'products:*',
                'product:*',
                'warehouse:*',
                'inventory:*'
            ]);

            cacheManager.clear();

        } catch (cacheError) {
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка обновления товара в инвентаре'
        }, { status: 500 });
    }
}

// DELETE - удалить товар из инвентаря
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'ID товара обязателен'
            }, { status: 400 });
        }

        // Получаем данные товара для записи движения
        const itemResult = await executeQuery(`
            SELECT quantity, section_id FROM warehouse_inventory WHERE id = $1
        `, [id]);

        if (itemResult.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Товар не найден'
            }, { status: 404 });
        }

        const itemData = itemResult.rows[0];

        // Записываем движение об удалении
        await executeQuery(`
            INSERT INTO warehouse_movements (
                inventory_id, movement_type, quantity, from_section_id,
                reason, user_name, notes
            )
            VALUES ($1, 'out', $2, $3, 'Удаление товара из инвентаря', 'System', 'Удаление через интерфейс')
        `, [id, itemData.quantity, itemData.section_id]);

        // Удаляем товар
        const result = await executeQuery(`
            DELETE FROM warehouse_inventory WHERE id = $1 RETURNING *
        `, [id]);

        return NextResponse.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка удаления товара из инвентаря'
        }, { status: 500 });
    }
}