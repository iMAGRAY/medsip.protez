require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

async function createWarehouseSystem() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${process.env.POSTGRESQL_PASSWORD}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'medsip_protez'}`
    });

    try {
        // Читаем SQL файл
        const sql = fs.readFileSync('database/migrations/20250130_create_warehouse_system.sql', 'utf8');
        await pool.query(sql);
        // Проверяем созданные таблицы
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE 'warehouse%'
            ORDER BY table_name
        `);

        console.log('📋 Созданные таблицы склада:', result.rows.map(r => r.table_name));

        // Проверяем данные в зонах
        const zones = await pool.query('SELECT id, name, location, capacity FROM warehouse_zones ORDER BY id');
        // Проверяем секции
        const sections = await pool.query(`
            SELECT s.id, s.name, z.name as zone_name, s.capacity
            FROM warehouse_sections s
            JOIN warehouse_zones z ON s.zone_id = z.id
            ORDER BY s.id LIMIT 10
        `);
        console.log('📦 Секции склада (первые 10):', sections.rows);

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

createWarehouseSystem();