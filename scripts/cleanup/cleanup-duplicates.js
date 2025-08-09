const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
    host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
    database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
    password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
    port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
    ssl: { rejectUnauthorized: false }
});

async function cleanupDuplicates() {
    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Удаляем дублирующиеся "Универсальные размеры" (пустая группа без детей)
            const duplicateResult = await client.query(`
        DELETE FROM spec_groups
        WHERE name = 'Универсальные размеры'
        AND parent_id = 53
        AND NOT EXISTS (SELECT 1 FROM spec_groups WHERE parent_id = spec_groups.id)
        AND NOT EXISTS (SELECT 1 FROM spec_enums WHERE group_id = spec_groups.id)
        RETURNING id, name
      `);

            if (duplicateResult.rows.length > 0) {
            } else {
            }

            await client.query('COMMIT');
            // 2. Показываем финальную очищенную структуру размеров
            const finalStructure = await client.query(`
        WITH RECURSIVE hierarchy AS (
          SELECT id, name, parent_id, 0 as level,
                 ARRAY[ordering, id] as path
          FROM spec_groups
          WHERE id = 53  -- РАЗМЕРЫ

          UNION ALL

          SELECT sg.id, sg.name, sg.parent_id, h.level + 1,
                 h.path || sg.ordering || sg.id
          FROM spec_groups sg
          JOIN hierarchy h ON sg.parent_id = h.id
        )
        SELECT level,
               REPEAT('  ', level) || name as indented_name,
               id,
               (SELECT COUNT(*) FROM spec_enums WHERE group_id = hierarchy.id) as enum_count
        FROM hierarchy
        ORDER BY path;
      `);

            let totalGroups = 0;
            let totalEnums = 0;

            finalStructure.rows.forEach(row => {
                totalGroups++;
                totalEnums += parseInt(row.enum_count);
                const enumInfo = row.enum_count > 0 ? ` (${row.enum_count} размеров)` : '';
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Ошибка:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    cleanupDuplicates()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Ошибка:', error);
            process.exit(1);
        });
}

module.exports = { cleanupDuplicates };