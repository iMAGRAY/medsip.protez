import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'

// GET - получить все секции склада
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const zoneId = searchParams.get('zone_id')

        let query = `
            SELECT
                s.id,
                s.name,
                s.description,
                s.capacity,
                s.row_number,
                s.shelf_number,
                s.zone_id,
                z.name as zone_name,
                z.code as zone_code,
                w.name as warehouse_name,
                w.code as warehouse_code,
                c.name as city_name,
                r.name as region_name,
                COALESCE(i.total_items, 0) as total_items,
                CASE
                    WHEN s.capacity > 0 THEN
                        ROUND((COALESCE(i.total_items, 0)::numeric / s.capacity::numeric) * 100, 1)
                    ELSE 0
                END as utilization_percentage
            FROM warehouse_sections s
            JOIN warehouse_zones z ON s.zone_id = z.id
            LEFT JOIN warehouse_warehouses w ON z.warehouse_id = w.id
            LEFT JOIN warehouse_cities c ON w.city_id = c.id
            LEFT JOIN warehouse_regions r ON c.region_id = r.id
            LEFT JOIN (
                SELECT section_id, COUNT(*) as total_items
                FROM warehouse_inventory
                WHERE status != 'discontinued'
                GROUP BY section_id
            ) i ON s.id = i.section_id
            WHERE s.is_active = true AND z.is_active = true
        `

        const params = []
        if (zoneId) {
            query += ' AND s.zone_id = $1'
            params.push(zoneId)
        }

        query += `
            ORDER BY r.name, c.name, w.name, z.name, s.row_number, s.shelf_number
        `

        const result = await executeQuery(query, params)

        return NextResponse.json({
            success: true,
            data: result.rows
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка получения секций склада: ' + (error instanceof Error ? error.message : 'Unknown error')
        }, { status: 500 })
    }
}

// POST - создать новую секцию склада
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { zone_id, name, description, capacity, row_number, shelf_number } = body

        // Валидация
        if (!zone_id || !name || !capacity || !row_number || !shelf_number) {
            return NextResponse.json({
                success: false,
                error: 'Все поля обязательны'
            }, { status: 400 })
        }

        // Проверяем, существует ли зона
        const zoneCheck = await executeQuery(`
            SELECT id FROM warehouse_zones
            WHERE id = $1 AND is_active = true
        `, [zone_id])

        if (zoneCheck.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Зона не найдена'
            }, { status: 404 })
        }

        const result = await executeQuery(`
            INSERT INTO warehouse_sections (
                zone_id, name, description, capacity, row_number, shelf_number,
                is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
            RETURNING *
        `, [zone_id, name, description || '', capacity, row_number, shelf_number])

        return NextResponse.json({
            success: true,
            data: result.rows[0]
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка создания секции склада'
        }, { status: 500 })
    }
}

// PUT - обновить секцию склада
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, zone_id, name, description, capacity, row_number, shelf_number } = body;

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'ID секции обязателен'
            }, { status: 400 });
        }

        const result = await executeQuery(`
            UPDATE warehouse_sections
            SET zone_id = $2, name = $3, description = $4, capacity = $5,
                row_number = $6, shelf_number = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_active = true
            RETURNING *
        `, [id, zone_id, name, description, capacity, row_number, shelf_number]);

        if (result.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Секция не найдена'
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка обновления секции склада'
        }, { status: 500 });
    }
}

// DELETE - удалить секцию склада
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'ID секции обязателен'
            }, { status: 400 });
        }

        // Проверяем, есть ли товары в секции
        const inventoryCheck = await executeQuery(`
            SELECT COUNT(*) as count FROM warehouse_inventory
            WHERE section_id = $1 AND status = 'active'
        `, [id]);

        if (parseInt(inventoryCheck.rows[0].count) > 0) {
            return NextResponse.json({
                success: false,
                error: 'Нельзя удалить секцию с товарами'
            }, { status: 400 });
        }

        const result = await executeQuery(`
            UPDATE warehouse_sections
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_active = true
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Секция не найдена'
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Секция успешно удалена'
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка удаления секции склада'
        }, { status: 500 });
    }
}