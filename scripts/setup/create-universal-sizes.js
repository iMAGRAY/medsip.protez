const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

async function createUniversalSizes() {
  const client = await pool.connect();

  try {
    // 1. Удаляем все старые размеры
    await client.query(`DELETE FROM spec_enums WHERE group_id IN (SELECT id FROM spec_groups WHERE name LIKE '%размер%' OR name LIKE '%Размер%')`);
    await client.query(`DELETE FROM spec_groups WHERE name LIKE '%размер%' OR name LIKE '%Размер%'`);

    // 2. Создаём универсальные группы размеров
    const sizeGroups = [
      {
        name: 'Размеры одежды',
        description: 'Универсальные размеры одежды и аксессуаров',
        sizes: [
          { value: 'XXS', display: 'XXS (очень маленький)', description: 'Детский 0-2 года' },
          { value: 'XS', display: 'XS (маленький)', description: 'Детский 3-6 лет' },
          { value: 'S', display: 'S (малый)', description: 'Детский/подростковый 7-12 лет' },
          { value: 'M', display: 'M (средний)', description: 'Подростковый/взрослый' },
          { value: 'L', display: 'L (большой)', description: 'Взрослый стандартный' },
          { value: 'XL', display: 'XL (очень большой)', description: 'Взрослый крупный' },
          { value: 'XXL', display: 'XXL (максимальный)', description: 'Взрослый очень крупный' }
        ]
      },
      {
        name: 'Размеры обуви EU',
        description: 'Европейские размеры обуви',
        sizes: [
          // Детские размеры
          { value: '20', display: '20 EU (12.5 см)', description: 'Детский 1-2 года' },
          { value: '22', display: '22 EU (13.5 см)', description: 'Детский 2-3 года' },
          { value: '24', display: '24 EU (14.5 см)', description: 'Детский 3-4 года' },
          { value: '26', display: '26 EU (16 см)', description: 'Детский 4-5 лет' },
          { value: '28', display: '28 EU (17 см)', description: 'Детский 5-6 лет' },
          { value: '30', display: '30 EU (18.5 см)', description: 'Детский 7-8 лет' },
          { value: '32', display: '32 EU (20 см)', description: 'Детский 9-10 лет' },
          { value: '34', display: '34 EU (21.5 см)', description: 'Подростковый 11-12 лет' },
          // Взрослые размеры
          { value: '35', display: '35 EU (22.5 см)', description: 'Женский маленький' },
          { value: '36', display: '36 EU (23 см)', description: 'Женский стандартный' },
          { value: '37', display: '37 EU (23.5 см)', description: 'Женский средний' },
          { value: '38', display: '38 EU (24.5 см)', description: 'Женский/мужской малый' },
          { value: '39', display: '39 EU (25 см)', description: 'Женский большой/мужской малый' },
          { value: '40', display: '40 EU (26 см)', description: 'Мужской маленький' },
          { value: '41', display: '41 EU (26.5 см)', description: 'Мужской стандартный' },
          { value: '42', display: '42 EU (27.5 см)', description: 'Мужской средний' },
          { value: '43', display: '43 EU (28 см)', description: 'Мужской большой' },
          { value: '44', display: '44 EU (29 см)', description: 'Мужской очень большой' },
          { value: '45', display: '45 EU (29.5 см)', description: 'Мужской крупный' },
          { value: '46', display: '46 EU (30.5 см)', description: 'Мужской максимальный' }
        ]
      },
      {
        name: 'Размеры длины (см)',
        description: 'Размеры в сантиметрах для точной подгонки',
        sizes: [
          { value: '10-15', display: '10-15 см', description: 'Очень короткий' },
          { value: '15-20', display: '15-20 см', description: 'Короткий' },
          { value: '20-25', display: '20-25 см', description: 'Малый' },
          { value: '25-30', display: '25-30 см', description: 'Средний короткий' },
          { value: '30-35', display: '30-35 см', description: 'Средний' },
          { value: '35-40', display: '35-40 см', description: 'Средний длинный' },
          { value: '40-45', display: '40-45 см', description: 'Длинный' },
          { value: '45-50', display: '45-50 см', description: 'Очень длинный' },
          { value: '50+', display: '50+ см', description: 'Максимальный' }
        ]
      },
      {
        name: 'Размеры окружности (см)',
        description: 'Размеры окружности для точной подгонки',
        sizes: [
          { value: '12-16', display: '12-16 см', description: 'Очень тонкий' },
          { value: '16-20', display: '16-20 см', description: 'Тонкий' },
          { value: '20-24', display: '20-24 см', description: 'Малый' },
          { value: '24-28', display: '24-28 см', description: 'Средний малый' },
          { value: '28-32', display: '28-32 см', description: 'Средний' },
          { value: '32-36', display: '32-36 см', description: 'Средний большой' },
          { value: '36-40', display: '36-40 см', description: 'Большой' },
          { value: '40-44', display: '40-44 см', description: 'Очень большой' },
          { value: '44+', display: '44+ см', description: 'Максимальный' }
        ]
      }
    ];

    // 3. Создаём группы и размеры
    for (const group of sizeGroups) {
      // Создаём spec_group
      const groupResult = await client.query(
        `INSERT INTO spec_groups (name, description, ordering, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [group.name, group.description, 0]
      );

      const groupId = groupResult.rows[0].id;
      // Добавляем размеры
      for (let i = 0; i < group.sizes.length; i++) {
        const size = group.sizes[i];
        await client.query(
          `INSERT INTO spec_enums (group_id, value, display_name, ordering, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [groupId, size.value, size.display, i]
        );
      }
    }
    const groupsCount = await client.query('SELECT COUNT(*) FROM spec_groups WHERE name LIKE \'Размеры%\'');
    const sizesCount = await client.query('SELECT COUNT(*) FROM spec_enums WHERE group_id IN (SELECT id FROM spec_groups WHERE name LIKE \'Размеры%\')');
  } catch (error) {
    console.error('❌ Ошибка при создании универсальной системы размеров:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запуск, если файл вызван напрямую
if (require.main === module) {
  createUniversalSizes();
}

module.exports = { createUniversalSizes };