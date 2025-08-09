const fs = require('fs');
require('dotenv').config();
const { Pool } = require('pg');

async function cleanWarehouseSystem() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${process.env.POSTGRESQL_PASSWORD}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'medsip_protez'}`
    });

    try {
        // Очистка фейковых данных
        const cleanupSql = fs.readFileSync('database/migrations/20250130_warehouse_cleanup.sql', 'utf8');
        await pool.query(cleanupSql);
        // Создание чистой схемы
        const schemaSql = fs.readFileSync('database/migrations/20250130_create_warehouse_system_clean.sql', 'utf8');
        await pool.query(schemaSql);
        // Проверяем состояние таблиц
        const result = await pool.query(`
            SELECT table_name,
                   (SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_name = t.table_name AND table_schema = 'public') as columns_count
            FROM information_schema.tables t
            WHERE table_schema = 'public'
            AND table_name LIKE 'warehouse_%'
            ORDER BY table_name
        `);
        result.rows.forEach(row => {
        });

        // Проверяем что данные очищены
        const checkQueries = [
            'SELECT COUNT(*) as count FROM warehouse_regions',
            'SELECT COUNT(*) as count FROM warehouse_cities',
            'SELECT COUNT(*) as count FROM warehouse_warehouses',
            'SELECT COUNT(*) as count FROM warehouse_zones',
            'SELECT COUNT(*) as count FROM warehouse_sections',
            'SELECT COUNT(*) as count FROM warehouse_inventory',
            'SELECT COUNT(*) as count FROM warehouse_movements'
        ];

        const tables = ['regions', 'cities', 'warehouses', 'zones', 'sections', 'inventory', 'movements'];

        for (let i = 0; i < checkQueries.length; i++) {
            const checkResult = await pool.query(checkQueries[i]);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

cleanWarehouseSystem();