const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения из файла
const envFile = path.join(__dirname, '..', 'database.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const envLines = envContent.split('\n');

  envLines.forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createFormTemplatesTable() {
  try {
    // Проверяем, существует ли уже таблица
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'form_templates'
      );
    `;

    const checkResult = await pool.query(checkTableQuery);

    if (checkResult.rows[0].exists) {
      // Проверяем количество записей
      const countResult = await pool.query('SELECT COUNT(*) FROM form_templates');
      return;
    }

    // Создаем таблицу
    const createTableQuery = `
      CREATE TABLE form_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        characteristics JSONB NOT NULL DEFAULT '[]',
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableQuery);
    // Создаем индексы для оптимизации
    const createIndexQueries = [
      'CREATE INDEX idx_form_templates_name ON form_templates(name);',
      'CREATE INDEX idx_form_templates_created_at ON form_templates(created_at);',
      'CREATE INDEX idx_form_templates_is_favorite ON form_templates(is_favorite);'
    ];

    for (const query of createIndexQueries) {
      await pool.query(query);
    }
    // Создаем тестовые данные
    const insertTestData = `
      INSERT INTO form_templates (name, description, characteristics, is_favorite) VALUES
      ('Базовый шаблон', 'Основные характеристики для протеза',
       '[{"id":1,"group_id":1,"characteristic_type":"text","label":"Материал","value_text":"Титан"}]', false),
      ('Расширенный шаблон', 'Подробные характеристики',
       '[{"id":2,"group_id":1,"characteristic_type":"numeric","label":"Вес","value_numeric":150,"unit_id":1}]', true);
    `;

    await pool.query(insertTestData);
    // Проверяем результат
    const countResult = await pool.query('SELECT COUNT(*) FROM form_templates');
  } catch (error) {
    console.error('❌ Ошибка при создании таблицы:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createFormTemplatesTable()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Ошибка:', error);
    process.exit(1);
  });