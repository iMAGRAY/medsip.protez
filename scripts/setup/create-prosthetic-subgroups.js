const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

async function createProstheticSubgroups() {
  try {
    const client = await pool.connect();
    try {
      // Сначала удаляем старые группы протезов
      await client.query(`DELETE FROM spec_enums WHERE group_id IN (34, 35, 36, 37, 38)`);
      await client.query(`DELETE FROM spec_groups WHERE id IN (34, 35, 36, 37, 38)`);

      // Создаём новую иерархическую структуру
      const prostheticSubgroups = [
        // ПРОТЕЗЫ РУК
        {
          name: 'Протезы рук - Детские',
          description: 'Размеры протезов рук для детей и подростков',
          ordering: 10,
          sizes: [
            { value: 'рука детский 0-3', display: 'Детский 0-3 года (8-12 см)' },
            { value: 'рука детский 4-7', display: 'Детский 4-7 лет (12-16 см)' },
            { value: 'рука детский 8-12', display: 'Детский 8-12 лет (16-20 см)' },
            { value: 'рука подростковый 13-17', display: 'Подростковый 13-17 лет (20-24 см)' }
          ]
        },
        {
          name: 'Протезы рук - Взрослые',
          description: 'Размеры протезов рук для взрослых',
          ordering: 11,
          sizes: [
            { value: 'рука взрослый XS', display: 'Взрослый XS (18-20 см)' },
            { value: 'рука взрослый S', display: 'Взрослый S (20-22 см)' },
            { value: 'рука взрослый M', display: 'Взрослый M (22-24 см)' },
            { value: 'рука взрослый L', display: 'Взрослый L (24-26 см)' },
            { value: 'рука взрослый XL', display: 'Взрослый XL (26-28 см)' },
            { value: 'рука взрослый XXL', display: 'Взрослый XXL (28+ см)' }
          ]
        },
        {
          name: 'Протезы рук - Специальные',
          description: 'Специализированные протезы рук',
          ordering: 12,
          sizes: [
            { value: 'миоэлектрический детский', display: 'Миоэлектрический детский' },
            { value: 'миоэлектрический взрослый', display: 'Миоэлектрический взрослый' },
            { value: 'биомеханический детский', display: 'Биомеханический детский' },
            { value: 'биомеханический взрослый', display: 'Биомеханический взрослый' },
            { value: 'космический протез', display: 'Космический протез (активность)' }
          ]
        },

        // ПРОТЕЗЫ НОГ
        {
          name: 'Протезы ног - Детские',
          description: 'Размеры протезов ног для детей',
          ordering: 13,
          sizes: [
            { value: 'нога детский 1', display: 'Детский 1 (20-30 см)' },
            { value: 'нога детский 2', display: 'Детский 2 (30-40 см)' },
            { value: 'нога детский 3', display: 'Детский 3 (40-50 см)' },
            { value: 'нога подростковый', display: 'Подростковый (50-60 см)' }
          ]
        },
        {
          name: 'Протезы ног - Женские',
          description: 'Размеры протезов ног для женщин',
          ordering: 14,
          sizes: [
            { value: 'нога женский XS', display: 'Женский XS (50-55 см)' },
            { value: 'нога женский S', display: 'Женский S (55-65 см)' },
            { value: 'нога женский M', display: 'Женский M (60-70 см)' },
            { value: 'нога женский L', display: 'Женский L (65-75 см)' }
          ]
        },
        {
          name: 'Протезы ног - Мужские',
          description: 'Размеры протезов ног для мужчин',
          ordering: 15,
          sizes: [
            { value: 'нога мужской S', display: 'Мужской S (60-70 см)' },
            { value: 'нога мужской M', display: 'Мужской M (65-75 см)' },
            { value: 'нога мужской L', display: 'Мужской L (70-80 см)' },
            { value: 'нога мужской XL', display: 'Мужской XL (75-85 см)' },
            { value: 'нога мужской XXL', display: 'Мужской XXL (80+ см)' }
          ]
        },

        // ПРОТЕЗЫ СТОП
        {
          name: 'Протезы стоп - Детские',
          description: 'Детские размеры протезов стоп',
          ordering: 16,
          sizes: [
            { value: 'стопа детский 20', display: 'Детский 20 EU (12.5 см)' },
            { value: 'стопа детский 22', display: 'Детский 22 EU (13.5 см)' },
            { value: 'стопа детский 24', display: 'Детский 24 EU (14.5 см)' },
            { value: 'стопа детский 26', display: 'Детский 26 EU (16 см)' },
            { value: 'стопа детский 28', display: 'Детский 28 EU (17 см)' },
            { value: 'стопа детский 30', display: 'Детский 30 EU (18.5 см)' },
            { value: 'стопа детский 32', display: 'Детский 32 EU (20 см)' },
            { value: 'стопа детский 34', display: 'Детский 34 EU (21.5 см)' }
          ]
        },
        {
          name: 'Протезы стоп - Женские',
          description: 'Женские размеры протезов стоп',
          ordering: 17,
          sizes: [
            { value: 'стопа женский 35', display: 'Женский 35 EU (22.5 см)' },
            { value: 'стопа женский 36', display: 'Женский 36 EU (23 см)' },
            { value: 'стопа женский 37', display: 'Женский 37 EU (23.5 см)' },
            { value: 'стопа женский 38', display: 'Женский 38 EU (24.5 см)' },
            { value: 'стопа женский 39', display: 'Женский 39 EU (25 см)' },
            { value: 'стопа женский 40', display: 'Женский 40 EU (26 см)' },
            { value: 'стопа женский 41', display: 'Женский 41 EU (26.5 см)' }
          ]
        },
        {
          name: 'Протезы стоп - Мужские',
          description: 'Мужские размеры протезов стоп',
          ordering: 18,
          sizes: [
            { value: 'стопа мужской 39', display: 'Мужской 39 EU (25 см)' },
            { value: 'стопа мужской 40', display: 'Мужской 40 EU (26 см)' },
            { value: 'стопа мужской 41', display: 'Мужской 41 EU (26.5 см)' },
            { value: 'стопа мужской 42', display: 'Мужской 42 EU (27.5 см)' },
            { value: 'стопа мужской 43', display: 'Мужской 43 EU (28 см)' },
            { value: 'стопа мужской 44', display: 'Мужской 44 EU (29 см)' },
            { value: 'стопа мужской 45', display: 'Мужской 45 EU (29.5 см)' },
            { value: 'стопа мужской 46', display: 'Мужской 46 EU (30.5 см)' }
          ]
        },

        // УРОВНИ АМПУТАЦИИ
        {
          name: 'Ампутации - Верхние конечности',
          description: 'Уровни ампутации рук и кистей',
          ordering: 19,
          sizes: [
            { value: 'ампутация пальца руки', display: 'Ампутация пальца руки' },
            { value: 'частичная ампутация кисти', display: 'Частичная ампутация кисти' },
            { value: 'ампутация кисти', display: 'Ампутация кисти' },
            { value: 'ампутация предплечья нижняя', display: 'Ампутация предплечья нижняя' },
            { value: 'ампутация предплечья средняя', display: 'Ампутация предплечья средняя' },
            { value: 'ампутация предплечья верхняя', display: 'Ампутация предплечья верхняя' },
            { value: 'ампутация плеча', display: 'Ампутация плеча' }
          ]
        },
        {
          name: 'Ампутации - Нижние конечности',
          description: 'Уровни ампутации ног и стоп',
          ordering: 20,
          sizes: [
            { value: 'ампутация пальца ноги', display: 'Ампутация пальца ноги' },
            { value: 'частичная ампутация стопы', display: 'Частичная ампутация стопы' },
            { value: 'ампутация стопы', display: 'Ампутация стопы' },
            { value: 'ампутация голени нижняя', display: 'Ампутация голени нижняя' },
            { value: 'ампутация голени средняя', display: 'Ампутация голени средняя' },
            { value: 'ампутация голени верхняя', display: 'Ампутация голени верхняя' },
            { value: 'вычленение коленного сустава', display: 'Вычленение в коленном суставе' },
            { value: 'ампутация бедра нижняя', display: 'Ампутация бедра нижняя' },
            { value: 'ампутация бедра средняя', display: 'Ампутация бедра средняя' },
            { value: 'ампутация бедра верхняя', display: 'Ампутация бедра верхняя' },
            { value: 'вычленение тазобедренного сустава', display: 'Вычленение в тазобедренном суставе' }
          ]
        },

        // ТИПЫ КРЕПЛЕНИЙ
        {
          name: 'Крепления - Механические',
          description: 'Механические способы крепления протезов',
          ordering: 21,
          sizes: [
            { value: 'гильзовое крепление', display: 'Гильзовое крепление' },
            { value: 'замковое крепление', display: 'Замковое крепление' },
            { value: 'ременное крепление', display: 'Ременное крепление' },
            { value: 'фрикционное крепление', display: 'Фрикционное крепление' }
          ]
        },
        {
          name: 'Крепления - Современные',
          description: 'Современные способы крепления протезов',
          ordering: 22,
          sizes: [
            { value: 'вакуумное крепление', display: 'Вакуумное крепление' },
            { value: 'магнитное крепление', display: 'Магнитное крепление' },
            { value: 'остеоинтеграция', display: 'Остеоинтеграция' },
            { value: 'силиконовое крепление', display: 'Силиконовое крепление' }
          ]
        }
      ];

      // Создаём каждую подгруппу
      for (const group of prostheticSubgroups) {
        // Создаём группу размеров
        const groupResult = await client.query(
          `INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING id`,
          [group.name, group.description, group.ordering]
        );

        const groupId = groupResult.rows[0].id;
        // Добавляем размеры в группу
        for (let i = 0; i < group.sizes.length; i++) {
          const size = group.sizes[i];
          await client.query(
            `INSERT INTO spec_enums (group_id, value, display_name, ordering, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            [groupId, size.value, size.display, i]
          );
        }
      }
    } catch (error) {
      console.error('❌ Ошибка выполнения:', error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Ошибка подключения:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем скрипт
createProstheticSubgroups().catch(console.error);