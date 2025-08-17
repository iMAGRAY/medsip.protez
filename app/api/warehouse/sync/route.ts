import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-connection';
import { getCacheManager } from '@/lib/dependency-injection';
import { invalidateRelated } from '@/lib/cache-manager';

// POST - синхронизировать данные о товарах между складом и каталогом
export async function POST(_request: NextRequest) {
    const cacheManager = getCacheManager();

    try {

        // Получаем данные из склада
        const inventoryResult = await executeQuery(`
            SELECT
                wi.product_id,
                SUM(wi.quantity) as total_quantity,
                CASE
                    WHEN SUM(wi.quantity) > 0 THEN 'in_stock'
                    ELSE 'out_of_stock'
                END as calculated_status
            FROM warehouse_inventory wi
            WHERE wi.product_id IS NOT NULL
            GROUP BY wi.product_id
        `);

        let updatedProducts = 0;

        // Обновляем данные в каталоге
        // Важно: stock_status обновляется только для информации, доступность контролирует только in_stock
        for (const row of inventoryResult.rows) {
            const { product_id, total_quantity, calculated_status } = row;

            await executeQuery(`
                UPDATE products
                SET
                    stock_quantity = $2,
                    stock_status = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                product_id,
                total_quantity,
                calculated_status
            ]);

            updatedProducts++;
        }

        // Инвалидируем весь кэш продуктов
        try {
            await invalidateRelated([
                'medsip:products:*',
                'products:*',
                'product:*'
            ]);

            cacheManager.clear();

        } catch (cacheError) {
        }

        return NextResponse.json({
            success: true,
            message: `Синхронизация завершена. Обновлено товаров: ${updatedProducts}`,
            data: {
                updatedProducts,
                totalInventoryItems: inventoryResult.rows.length
            }
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Ошибка синхронизации данных о товарах'
        }, { status: 500 });
    }
}