const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })
// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateCharacteristicsToEnums() {
  try {
    // Получаем все уникальные текстовые значения из product_characteristics
    const characteristicsQuery = `
      SELECT DISTINCT
        group_id,
        value_text,
        sg.name as group_name
      FROM product_characteristics pc
      JOIN spec_groups sg ON pc.group_id = sg.id
      WHERE pc.value_text IS NOT NULL
        AND pc.value_text != ''
        AND pc.group_id IN (224, 253, 254, 255, 256, 257)
      ORDER BY group_id, value_text
    `;

    const characteristicsResult = await pool.query(characteristicsQuery);
    // Получаем существующие enum значения
    const existingEnumsQuery = `
      SELECT group_id, value, display_name
      FROM spec_enums
      WHERE group_id IN (224, 253, 254, 255, 256, 257)
    `;

    const existingEnumsResult = await pool.query(existingEnumsQuery);
    const existingEnums = new Set();

    existingEnumsResult.rows.forEach(row => {
      existingEnums.add(`${row.group_id}:${row.value}`);
      existingEnums.add(`${row.group_id}:${row.display_name}`);
    });
    let addedCount = 0;
    let skippedCount = 0;

    // Группируем по group_id
    const groupedCharacteristics = {};
    characteristicsResult.rows.forEach(row => {
      if (!groupedCharacteristics[row.group_id]) {
        groupedCharacteristics[row.group_id] = {
          group_name: row.group_name,
          values: []
        };
      }
      groupedCharacteristics[row.group_id].values.push(row.value_text);
    });

    // Обрабатываем каждую группу
    for (const [groupId, groupData] of Object.entries(groupedCharacteristics)) {
      // Получаем максимальный ordering для группы
      const maxOrderingResult = await pool.query(
        'SELECT COALESCE(MAX(ordering), 0) as max_ordering FROM spec_enums WHERE group_id = $1',
        [groupId]
      );
      let groupOrderIndex = maxOrderingResult.rows[0].max_ordering + 1;

      for (const valueText of groupData.values) {
        // Создаем уникальный ключ для проверки
        const normalizedValue = valueText.toLowerCase().trim();
        const enumKey = `${groupId}:${normalizedValue}`;

        // Проверяем, существует ли уже такое значение
        const exists = existingEnums.has(enumKey) ||
                      existingEnums.has(`${groupId}:${valueText}`) ||
                      Array.from(existingEnums).some(key =>
                        key.startsWith(`${groupId}:`) &&
                        key.toLowerCase().includes(normalizedValue.substring(0, 10))
                      );

        if (exists) {
          skippedCount++;
          continue;
        }

        try {
          // Создаем value из display_name (убираем спецсимволы)
          const cleanValue = normalizedValue
            .replace(/[^a-zA-Z0-9а-яё\s\-]/gi, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50); // Ограничиваем длину

          // Создаем enum значение
          const insertResult = await pool.query(`
            INSERT INTO spec_enums (
              group_id,
              value,
              display_name,
              ordering,
              is_active,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `, [
            groupId,
            cleanValue,
            valueText, // Оригинальный текст как display_name
            groupOrderIndex++,
            true
          ]);
          addedCount++;

          // Добавляем в set для избежания дублирования
          existingEnums.add(`${groupId}:${normalizedValue}`);
          existingEnums.add(`${groupId}:${valueText}`);

        } catch (error) {
        }
      }
    }
    // Проверяем финальное состояние
    const finalCountQuery = `
      SELECT
        sg.name as group_name,
        COUNT(se.id) as enum_count
      FROM spec_groups sg
      LEFT JOIN spec_enums se ON sg.id = se.group_id
      WHERE sg.id IN (224, 253, 254, 255, 256, 257)
      GROUP BY sg.id, sg.name
      ORDER BY sg.id
    `;

    const finalCountResult = await pool.query(finalCountQuery);
    finalCountResult.rows.forEach(row => {
    });
  } catch (error) {
    console.error('💥 Ошибка миграции:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем миграцию
migrateCharacteristicsToEnums();