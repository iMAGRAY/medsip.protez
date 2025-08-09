const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
    host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
    database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
    password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
    port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
    ssl: { rejectUnauthorized: false }
});

async function cleanProstheticDuplicates() {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Найдем все пустые подгруппы в разделе ПРОТЕЗЫ
            const emptySubgroups = await client.query(`
        SELECT
          sg.id,
          sg.name,
          sg.parent_id,
          (SELECT name FROM spec_groups WHERE id = sg.parent_id) as parent_name,
          COUNT(se.id) as enum_count
        FROM spec_groups sg
        LEFT JOIN spec_enums se ON sg.id = se.group_id
        WHERE sg.parent_id IN (55, 59, 63, 67, 70)  -- подгруппы протезов
        GROUP BY sg.id, sg.name, sg.parent_id
        HAVING COUNT(se.id) = 0  -- только пустые группы
        ORDER BY sg.parent_id, sg.name
      `);
            emptySubgroups.rows.forEach(group => {
            });

            if (emptySubgroups.rows.length === 0) {
                await client.query('ROLLBACK');
                return;
            }

            // 2. Удаляем пустые подгруппы
            const idsToDelete = emptySubgroups.rows.map(row => row.id);
            const deleteResult = await client.query(`
        DELETE FROM spec_groups
        WHERE id = ANY($1::integer[])
        RETURNING id, name
      `, [idsToDelete]);
            deleteResult.rows.forEach(group => {
            });

            await client.query('COMMIT');
            // 3. Показываем финальную структуру ПРОТЕЗЫ
            const finalStructure = await client.query(`
        WITH RECURSIVE hierarchy AS (
          SELECT id, name, parent_id, 0 as level,
                 ARRAY[ordering, id] as path
          FROM spec_groups
          WHERE id = 52  -- ПРОТЕЗЫ

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

            finalStructure.rows.forEach(row => {
                const enumInfo = row.enum_count > 0 ? ` (${row.enum_count} элементов)` : '';
            });

            // 4. Проверяем что размеры остались в РАЗМЕРЫ
            const sizesCheck = await client.query(`
        SELECT
          COUNT(DISTINCT sg.id) as groups_count,
          SUM(CASE WHEN se.id IS NOT NULL THEN 1 ELSE 0 END) as total_enums
        FROM spec_groups sg
        LEFT JOIN spec_enums se ON sg.id = se.group_id
        WHERE sg.parent_id = 92  -- "Протезы - Размеры"
           OR sg.id IN (
             SELECT id FROM spec_groups WHERE parent_id IN (
               SELECT id FROM spec_groups WHERE parent_id = 92
             )
           )
      `);

            const sizesStats = sizesCheck.rows[0];
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

// Запускаем очистку
if (require.main === module) {
    cleanProstheticDuplicates()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { cleanProstheticDuplicates };