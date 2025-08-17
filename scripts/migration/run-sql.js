const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function runSQL(filename) {
    try {
        console.log(`🔄 Выполнение SQL файла: ${filename}`)
        
        // Читаем SQL файл
        const sql = fs.readFileSync(filename, 'utf8')
        
        // Выполняем SQL
        await pool.query(sql)
        
        console.log('✅ SQL выполнен успешно!')
    } catch (error) {
        console.error('❌ Ошибка выполнения SQL:', error)
        process.exit(1)
    } finally {
        await pool.end()
    }
}

// Получаем имя файла из аргументов
const sqlFile = process.argv[2]
if (!sqlFile) {
    console.error('❌ Укажите SQL файл для выполнения')
    process.exit(1)
}

runSQL(sqlFile)