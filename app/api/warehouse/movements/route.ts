import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, getPool } from '@/lib/db-connection';
import { getCacheManager } from '@/lib/dependency-injection';
import { invalidateRelated } from '@/lib/cache-manager';

// GET - получить движения товаров
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const inventoryId = searchParams.get('inventory_id');
    const movementType = searchParams.get('movement_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        m.id,
        m.inventory_id,
        m.movement_type,
        m.quantity,
        m.from_section_id,
        m.to_section_id,
        m.reason,
        m.reference_number,
        m.user_name,
        m.notes,
        m.movement_date,
        m.created_at,
        i.name as inventory_name,
        i.sku as inventory_sku,
        fs.name as from_section_name,
        ts.name as to_section_name,
        p.name as product_name
      FROM warehouse_movements m
      LEFT JOIN warehouse_inventory i ON m.inventory_id = i.id
      LEFT JOIN warehouse_sections fs ON m.from_section_id = fs.id
      LEFT JOIN warehouse_sections ts ON m.to_section_id = ts.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (inventoryId) {
      query += ` AND m.inventory_id = $${paramIndex}`;
      params.push(inventoryId);
      paramIndex++;
    }

    if (movementType) {
      query += ` AND m.movement_type = $${paramIndex}`;
      params.push(movementType);
      paramIndex++;
    }

    if (dateFrom) {
      query += ` AND m.movement_date >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND m.movement_date <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    // Подсчитываем общее количество записей
    const countQuery = `SELECT COUNT(*) as total FROM warehouse_movements m WHERE 1=1`;
    const countResult = await executeQuery(countQuery, []);
    const total = parseInt(countResult.rows[0].total) || 0;

    // Добавляем сортировку и пагинацию
    query += `
      ORDER BY m.movement_date DESC, m.created_at DESC
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
      error: 'Ошибка получения движений товаров'
    }, { status: 500 });
  }
}

// POST - создать новое движение товара
export async function POST(request: NextRequest) {
    const cacheManager = getCacheManager();

    try {
        const {
            inventory_id, movement_type, quantity, from_section_id, to_section_id,
            reason, reference_number, user_name, notes
        } = await request.json();

        if (!inventory_id || !movement_type || !quantity) {
            return NextResponse.json({
                success: false,
                error: 'Обязательные поля: inventory_id, movement_type, quantity'
            }, { status: 400 });
        }

        // Проверяем существование инвентаря
        const inventoryCheck = await executeQuery(`
            SELECT id, quantity, product_id FROM warehouse_inventory WHERE id = $1
        `, [inventory_id]);

        if (inventoryCheck.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Товар в инвентаре не найден'
            }, { status: 404 });
        }

        const inventory = inventoryCheck.rows[0];
        const pool = getPool();

        await pool.query('BEGIN');

        try {
            // Создаем запись о движении товара
            const movementResult = await pool.query(`
                INSERT INTO warehouse_movements (
                    inventory_id, movement_type, quantity, from_section_id, to_section_id,
                    reason, reference_number, user_name, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                inventory_id, movement_type, quantity, from_section_id, to_section_id,
                reason, reference_number, user_name, notes
            ]);

            // Обновляем количество в инвентаре в зависимости от типа движения
            let newQuantity = inventory.quantity;
            let newSectionId = inventory.section_id;

            if (movement_type === 'in') {
                newQuantity += quantity;
                if (to_section_id) newSectionId = to_section_id;
            } else if (movement_type === 'out') {
                newQuantity -= quantity;
                if (from_section_id) newSectionId = from_section_id;
            } else if (movement_type === 'transfer') {
                if (to_section_id) newSectionId = to_section_id;
            } else if (movement_type === 'adjustment') {
                newQuantity = quantity; // Прямое обновление количества
            }

            // Обновляем количество в инвентаре
            const inventoryUpdateResult = await pool.query(`
                UPDATE warehouse_inventory
                SET quantity = $2, section_id = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [inventory_id, newQuantity, newSectionId]);

            const minStock = inventoryUpdateResult.rows[0].min_stock || 0;
            let newStatus = 'active';

            if (newQuantity === 0) {
                newStatus = 'out_of_stock';
            } else if (newQuantity <= minStock) {
                newStatus = 'low_stock';
            }

            await pool.query(`
                UPDATE warehouse_inventory
                SET quantity = $2, section_id = $3, status = $4, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [inventory_id, newQuantity, newSectionId, newStatus]);

            // Обновляем связанный товар в каталоге
            if (inventory.product_id) {
                const stockStatus = newQuantity > 0 ? 'in_stock' : 'out_of_stock';
                await pool.query(`
                    UPDATE products
                    SET stock_quantity = $2, stock_status = $3, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [inventory.product_id, newQuantity, stockStatus]);
            }

            await pool.query('COMMIT');

            // Инвалидируем кэш после движения товара
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
                data: movementResult.rows[0],
                message: 'Движение товара записано успешно'
            });

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка создания движения товара'
        }, { status: 500 });
    }
}