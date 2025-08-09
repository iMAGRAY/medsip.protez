require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || process.env.POSTGRESQL_USER || "postgres",
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || process.env.POSTGRESQL_HOST || "localhost",
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'default_db',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRESQL_PASSWORD || "",
  port: process.env.POSTGRESQL_PORT || process.env.PGPORT || 5432,
  ssl: { rejectUnauthorized: false }
});

async function seedTestSpecifications() {
  const client = await pool.connect();

  try {
    // Добавляем группы характеристик
    const groups = [
      { name: 'Размеры', description: 'Размерные характеристики протеза' },
      { name: 'Материалы', description: 'Материалы изготовления' },
      { name: 'Функции', description: 'Функциональные особенности' },
      { name: 'Цвета', description: 'Доступные цвета' }
    ];

    for (let i = 0; i < groups.length; i++) {
      const { name, description } = groups[i];

      // Проверяем, существует ли группа
      const existingGroup = await client.query(
        `SELECT id FROM spec_groups WHERE name = $1`,
        [name]
      );

      let groupId;
      if (existingGroup.rows.length === 0) {
        const result = await client.query(
          `INSERT INTO spec_groups (name, description, ordering, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [name, description, i]
        );
        groupId = result.rows[0].id;
      } else {
        groupId = existingGroup.rows[0].id;
      }

      // Добавляем enum-значения для каждой группы
      let enums = [];

      switch (name) {
        case 'Размеры':
          enums = [
            { value: 'XS', display_name: 'Очень маленький' },
            { value: 'S', display_name: 'Маленький' },
            { value: 'M', display_name: 'Средний' },
            { value: 'L', display_name: 'Большой' },
            { value: 'XL', display_name: 'Очень большой' }
          ];
          break;

        case 'Материалы':
          enums = [
            { value: 'titanium', display_name: 'Титан' },
            { value: 'carbon', display_name: 'Карбон' },
            { value: 'steel', display_name: 'Сталь' },
            { value: 'plastic', display_name: 'Пластик' }
          ];
          break;

        case 'Функции':
          enums = [
            { value: 'waterproof', display_name: 'Водонепроницаемый' },
            { value: 'lightweight', display_name: 'Лёгкий' },
            { value: 'durable', display_name: 'Прочный' },
            { value: 'flexible', display_name: 'Гибкий' }
          ];
          break;

        case 'Цвета':
          enums = [
            { value: 'black', display_name: 'Чёрный', color_hex: '#000000' },
            { value: 'white', display_name: 'Белый', color_hex: '#FFFFFF' },
            { value: 'beige', display_name: 'Бежевый', color_hex: '#F5F5DC' },
            { value: 'brown', display_name: 'Коричневый', color_hex: '#8B4513' }
          ];
          break;
      }

      // Вставляем enum-значения
      for (let j = 0; j < enums.length; j++) {
        const enumData = enums[j];

        // Проверяем, существует ли уже такое значение
        const existing = await client.query(
          `SELECT id FROM spec_enums WHERE group_id = $1 AND value = $2`,
          [groupId, enumData.value]
        );

        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO spec_enums (group_id, value, display_name, color_hex, ordering, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [groupId, enumData.value, enumData.display_name, enumData.color_hex || null, j]
          );
        } else {
        }
      }
    }
  } catch (error) {
    console.error('❌ Ошибка при создании тестовых характеристик:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запуск, если файл вызван напрямую
if (require.main === module) {
  seedTestSpecifications();
}

module.exports = { seedTestSpecifications };