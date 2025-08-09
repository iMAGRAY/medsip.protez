require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'default_db',
  user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD || process.env.DB_PASSWORD,
  ssl: false
});

async function setupFormTemplatesTable() {
  try {
    // Читаем SQL файл
    const sqlFile = path.join(__dirname, '..', 'database', 'create-form-templates-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    // Выполняем SQL скрипт
    const result = await pool.query(sql);
    // Проверяем результат
    const checkResult = await pool.query('SELECT COUNT(*) FROM form_templates');
  } catch (error) {
    console.error('❌ Ошибка при создании таблицы:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupFormTemplatesTable()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Ошибка:', error);
    process.exit(1);
  });