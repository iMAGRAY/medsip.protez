const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Настройка подключения к БД из .env.local
const pool = new Pool({
    host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
    user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
    database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
    ssl: false
})

async function runMigration() {
    try {
        // Тестируем подключение
        await pool.query('SELECT NOW()')
        // Читаем SQL файл
        const migrationPath = path.join(__dirname, '../database/migrations/20250101_create_catalog_menu_settings.sql')
        const sql = fs.readFileSync(migrationPath, 'utf8')

        // Выполняем SQL
        await pool.query(sql)
        // Проверяем что таблица создалась
        const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'catalog_menu_settings'
      ORDER BY ordinal_position
    `)
        result.rows.forEach(row => {
        })

        // Проверяем индексы
        const indexResult = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'catalog_menu_settings'
    `)
        indexResult.rows.forEach(row => {
        })

    } catch (error) {
        if (error.message.includes('already exists')) {
            // Проверяем структуру существующей таблицы
            const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'catalog_menu_settings'
        ORDER BY ordinal_position
      `)
            result.rows.forEach(row => {
            })
        } else {
            console.error('❌ Ошибка миграции:', error.message)
            throw error
        }
    } finally {
        await pool.end()
    }
}

runMigration()
    .then(() => {
        process.exit(0)
    })
    .catch(error => {
        console.error('💥 Ошибка:', error)
        process.exit(1)
    })