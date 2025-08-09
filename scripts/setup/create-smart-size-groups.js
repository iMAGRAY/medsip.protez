const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

async function createSmartSizeGroups() {
  const client = await pool.connect();

  try {
    // 1. Удаляем старую группу "Размеры" и все её размеры
    await client.query(`DELETE FROM spec_enums WHERE group_id IN (SELECT id FROM spec_groups WHERE name = 'Размеры')`);
    await client.query(`DELETE FROM spec_groups WHERE name = 'Размеры'`);

    // 2. Создаём новые группы размеров
    const sizeGroups = [
      {
        name: 'Размеры верхних протезов',
        description: 'Размеры протезов рук, кистей и плеч',
        subgroups: [
          {
            name: 'Кисти',
            sizes: [
              { value: 'кисть_детская_мини', display: 'Детская мини (13-15 см)', age: '0-2 года' },
              { value: 'кисть_детская_малая', display: 'Детская малая (15-17 см)', age: '3-5 лет' },
              { value: 'кисть_детская_средняя', display: 'Детская средняя (17-19 см)', age: '6-9 лет' },
              { value: 'кисть_подростковая', display: 'Подростковая (19-21 см)', age: '10-14 лет' },
              { value: 'кисть_женская_малая', display: 'Женская малая (18-20 см)', age: 'Взрослая' },
              { value: 'кисть_женская_средняя', display: 'Женская средняя (20-22 см)', age: 'Взрослая' },
              { value: 'кисть_мужская_средняя', display: 'Мужская средняя (21-23 см)', age: 'Взрослая' },
              { value: 'кисть_мужская_большая', display: 'Мужская большая (23-25 см)', age: 'Взрослая' }
            ]
          },
          {
            name: 'Предплечья',
            sizes: [
              { value: 'предплечье_детское_короткое', display: 'Детское короткое (12-18 см)', age: '0-4 года' },
              { value: 'предплечье_детское_среднее', display: 'Детское среднее (18-24 см)', age: '5-9 лет' },
              { value: 'предплечье_подростковое', display: 'Подростковое (24-28 см)', age: '10-15 лет' },
              { value: 'предплечье_женское', display: 'Женское (26-30 см)', age: 'Взрослая' },
              { value: 'предплечье_мужское_среднее', display: 'Мужское среднее (30-34 см)', age: 'Взрослая' },
              { value: 'предплечье_мужское_длинное', display: 'Мужское длинное (34-38 см)', age: 'Взрослая' }
            ]
          },
          {
            name: 'Плечи',
            sizes: [
              { value: 'плечо_детское', display: 'Детское (15-22 см)', age: '0-8 лет' },
              { value: 'плечо_подростковое', display: 'Подростковое (22-28 см)', age: '9-15 лет' },
              { value: 'плечо_женское', display: 'Женское (26-32 см)', age: 'Взрослая' },
              { value: 'плечо_мужское_среднее', display: 'Мужское среднее (32-38 см)', age: 'Взрослая' },
              { value: 'плечо_мужское_крупное', display: 'Мужское крупное (38-44 см)', age: 'Взрослая' }
            ]
          }
        ]
      },
      {
        name: 'Размеры нижних протезов',
        description: 'Размеры протезов ног, стоп и бёдер',
        subgroups: [
          {
            name: 'Стопы детские',
            sizes: [
              { value: 'стопа_малыш_20', display: 'Малыш 20 см (размер 20-22)', age: '1-2 года' },
              { value: 'стопа_малыш_22', display: 'Малыш 22 см (размер 22-24)', age: '2-3 года' },
              { value: 'стопа_ребёнок_24', display: 'Ребёнок 24 см (размер 24-26)', age: '4-5 лет' },
              { value: 'стопа_ребёнок_26', display: 'Ребёнок 26 см (размер 26-28)', age: '6-7 лет' },
              { value: 'стопа_школьник_28', display: 'Школьник 28 см (размер 28-30)', age: '8-9 лет' },
              { value: 'стопа_подросток_30', display: 'Подросток 30 см (размер 30-32)', age: '10-12 лет' }
            ]
          },
          {
            name: 'Стопы женские',
            sizes: [
              { value: 'стопа_женская_35', display: 'Женская 22.5 см (35 размер)', age: 'Взрослая' },
              { value: 'стопа_женская_36', display: 'Женская 23 см (36 размер)', age: 'Взрослая' },
              { value: 'стопа_женская_37', display: 'Женская 23.5 см (37 размер)', age: 'Взрослая' },
              { value: 'стопа_женская_38', display: 'Женская 24.5 см (38 размер)', age: 'Взрослая' },
              { value: 'стопа_женская_39', display: 'Женская 25 см (39 размер)', age: 'Взрослая' },
              { value: 'стопа_женская_40', display: 'Женская 26 см (40 размер)', age: 'Взрослая' }
            ]
          },
          {
            name: 'Стопы мужские',
            sizes: [
              { value: 'стопа_мужская_39', display: 'Мужская 25 см (39 размер)', age: 'Взрослая' },
              { value: 'стопа_мужская_40', display: 'Мужская 26 см (40 размер)', age: 'Взрослая' },
              { value: 'стопа_мужская_41', display: 'Мужская 26.5 см (41 размер)', age: 'Взрослая' },
              { value: 'стопа_мужская_42', display: 'Мужская 27.5 см (42 размер)', age: 'Взрослая' },
              { value: 'стопа_мужская_43', display: 'Мужская 28 см (43 размер)', age: 'Взрослая' },
              { value: 'стопа_мужская_44', display: 'Мужская 29 см (44 размер)', age: 'Взрослая' },
              { value: 'стопа_мужская_45', display: 'Мужская 29.5 см (45 размер)', age: 'Взрослая' },
              { value: 'стопа_мужская_46', display: 'Мужская 30.5 см (46 размер)', age: 'Взрослая' }
            ]
          },
          {
            name: 'Голени',
            sizes: [
              { value: 'голень_детская_короткая', display: 'Детская короткая (20-26 см)', age: '0-5 лет' },
              { value: 'голень_детская_средняя', display: 'Детская средняя (26-32 см)', age: '6-10 лет' },
              { value: 'голень_подростковая', display: 'Подростковая (32-38 см)', age: '11-16 лет' },
              { value: 'голень_женская', display: 'Женская (36-42 см)', age: 'Взрослая' },
              { value: 'голень_мужская_средняя', display: 'Мужская средняя (42-46 см)', age: 'Взрослая' },
              { value: 'голень_мужская_длинная', display: 'Мужская длинная (46-50 см)', age: 'Взрослая' }
            ]
          },
          {
            name: 'Бёдра',
            sizes: [
              { value: 'бедро_детское', display: 'Детское (25-32 см)', age: '0-8 лет' },
              { value: 'бедро_подростковое', display: 'Подростковое (32-40 см)', age: '9-16 лет' },
              { value: 'бедро_женское', display: 'Женское (38-44 см)', age: 'Взрослая' },
              { value: 'бедро_мужское_среднее', display: 'Мужское среднее (44-48 см)', age: 'Взрослая' },
              { value: 'бедро_мужское_крупное', display: 'Мужское крупное (48-54 см)', age: 'Взрослая' }
            ]
          }
        ]
      }
    ];

    // 3. Создаём группы и подгруппы
    for (const group of sizeGroups) {
      for (const subgroup of group.subgroups) {
        // Создаём spec_group для каждой подгруппы
        const groupResult = await client.query(
          `INSERT INTO spec_groups (name, description, ordering, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            `${group.name} - ${subgroup.name}`,
            `${group.description}. Подгруппа: ${subgroup.name}`,
            0
          ]
        );

        const groupId = groupResult.rows[0].id;
        // Добавляем размеры в подгруппу
        for (let i = 0; i < subgroup.sizes.length; i++) {
          const size = subgroup.sizes[i];
          await client.query(
            `INSERT INTO spec_enums (group_id, value, display_name, ordering, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [groupId, size.value, size.display, i]
          );
        }
      }
    }
    const groupsCount = await client.query('SELECT COUNT(*) FROM spec_groups WHERE name LIKE \'%протезов%\'');
    const sizesCount = await client.query('SELECT COUNT(*) FROM spec_enums WHERE group_id IN (SELECT id FROM spec_groups WHERE name LIKE \'%протезов%\')');
  } catch (error) {
    console.error('❌ Ошибка при создании системы размеров:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запуск, если файл вызван напрямую
if (require.main === module) {
  createSmartSizeGroups();
}

module.exports = { createSmartSizeGroups };