const { executeQuery, pool } = require('../lib/database')
const fs = require('fs')
const path = require('path')

async function migrateCatalogMenuSettings() {
    try {
        // Читаем SQL файл миграции
        const migrationPath = path.join(__dirname, '../database/migrations/20250101_create_catalog_menu_settings.sql')
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

        // Выполняем миграцию
        await executeQuery(migrationSQL)
        // Проверяем что таблица создалась
        const checkResult = await executeQuery(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'catalog_menu_settings'
      ORDER BY ordinal_position
    `)
        checkResult.rows.forEach(row => {
        })

        // Проверяем индексы
        const indexResult = await executeQuery(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'catalog_menu_settings'
    `)
        indexResult.rows.forEach(row => {
        })

    } catch (error) {
        console.error('❌ Ошибка миграции:', error)
        throw error
    } finally {
        await pool.end()
    }
}

// Запускаем если вызван напрямую
if (require.main === module) {
    migrateCatalogMenuSettings()
        .then(() => {
            process.exit(0)
        })
        .catch(error => {
            console.error('💥 Ошибка:', error)
            process.exit(1)
        })
}

module.exports = { migrateCatalogMenuSettings }