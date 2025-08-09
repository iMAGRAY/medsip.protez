const { Pool } = require('pg');

// Прямые параметры подключения
const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  ssl: false
});

async function createTable() {
  let client;
  try {
    client = await pool.connect();
    // Проверяем существование таблицы
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'form_templates'
      );
    `);

    if (checkResult.rows[0].exists) {
      const countResult = await client.query('SELECT COUNT(*) FROM form_templates');
      return;
    }
    // Создаем таблицу
    await client.query(`
      CREATE TABLE form_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        characteristics JSONB NOT NULL DEFAULT '[]',
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Создаем индексы
    await client.query('CREATE INDEX idx_form_templates_name ON form_templates(name);');
    await client.query('CREATE INDEX idx_form_templates_created_at ON form_templates(created_at);');
    await client.query('CREATE INDEX idx_form_templates_is_favorite ON form_templates(is_favorite);');
    // Добавляем тестовые данные
    await client.query(`
      INSERT INTO form_templates (name, description, characteristics, is_favorite) VALUES
      ('Базовый шаблон', 'Основные характеристики для протеза',
       '[{"id":1,"group_id":1,"characteristic_type":"text","label":"Материал","value_text":"Титан"}]', false),
      ('Расширенный шаблон', 'Подробные характеристики',
       '[{"id":2,"group_id":1,"characteristic_type":"numeric","label":"Вес","value_numeric":150,"unit_id":1}]', true);
    `);
    // Проверяем результат
    const countResult = await client.query('SELECT COUNT(*) FROM form_templates');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('📋 Детали:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}
createTable()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Критическая ошибка:', error.message);
    process.exit(1);
  });