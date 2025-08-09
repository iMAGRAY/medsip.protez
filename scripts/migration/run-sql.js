const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Используем DATABASE_URL напрямую
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://gen_user:Q1w2e3r4t5!%40@212.113.118.141:5432/default_db"

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
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