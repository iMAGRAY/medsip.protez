const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

async function createHierarchicalStructure() {
  try {
    const client = await pool.connect();
    try {
      // 1. Добавляем поле parent_id для иерархии
      try {
        await client.query(`
          ALTER TABLE spec_groups
          ADD COLUMN parent_id INTEGER REFERENCES spec_groups(id) ON DELETE CASCADE
        `);
      } catch (error) {
        if (error.message.includes('already exists')) {
        } else {
          throw error;
        }
      }

      // 2. Создаём основные родительские группы
      const mainGroups = [
        {
          name: 'ПРОТЕЗЫ',
          description: 'Все виды протезов и их характеристики',
          ordering: 100
        },
        {
          name: 'РАЗМЕРЫ',
          description: 'Универсальные системы размеров',
          ordering: 200
        },
        {
          name: 'ХАРАКТЕРИСТИКИ',
          description: 'Материалы, функции и другие характеристики',
          ordering: 300
        }
      ];

      const createdMainGroups = {};

      for (const group of mainGroups) {
        const result = await client.query(`
          INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
          VALUES ($1, $2, $3, true, NOW(), NOW(), NULL)
          RETURNING id
        `, [group.name, group.description, group.ordering]);

        createdMainGroups[group.name] = result.rows[0].id;
      }

      // 3. Создаём подгруппы протезов
      const prostheticSubgroups = [
        {
          name: 'Протезы рук',
          description: 'Протезы верхних конечностей',
          parent: 'ПРОТЕЗЫ',
          ordering: 110,
          children: [
            { name: 'Детские протезы рук', description: 'Размеры для детей и подростков', ordering: 111 },
            { name: 'Взрослые протезы рук', description: 'Размеры для взрослых', ordering: 112 },
            { name: 'Специальные протезы рук', description: 'Миоэлектрические и биомеханические', ordering: 113 }
          ]
        },
        {
          name: 'Протезы ног',
          description: 'Протезы нижних конечностей',
          parent: 'ПРОТЕЗЫ',
          ordering: 120,
          children: [
            { name: 'Детские протезы ног', description: 'Размеры для детей', ordering: 121 },
            { name: 'Женские протезы ног', description: 'Размеры для женщин', ordering: 122 },
            { name: 'Мужские протезы ног', description: 'Размеры для мужчин', ordering: 123 }
          ]
        },
        {
          name: 'Протезы стоп',
          description: 'Протезы стоп с размерами обуви',
          parent: 'ПРОТЕЗЫ',
          ordering: 130,
          children: [
            { name: 'Детские протезы стоп', description: 'Детские размеры стоп', ordering: 131 },
            { name: 'Женские протезы стоп', description: 'Женские размеры стоп', ordering: 132 },
            { name: 'Мужские протезы стоп', description: 'Мужские размеры стоп', ordering: 133 }
          ]
        },
        {
          name: 'Ампутации',
          description: 'Уровни и типы ампутаций',
          parent: 'ПРОТЕЗЫ',
          ordering: 140,
          children: [
            { name: 'Ампутации верхних конечностей', description: 'Уровни ампутации рук', ordering: 141 },
            { name: 'Ампутации нижних конечностей', description: 'Уровни ампутации ног', ordering: 142 }
          ]
        },
        {
          name: 'Крепления',
          description: 'Способы крепления протезов',
          parent: 'ПРОТЕЗЫ',
          ordering: 150,
          children: [
            { name: 'Механические крепления', description: 'Традиционные способы крепления', ordering: 151 },
            { name: 'Современные крепления', description: 'Инновационные способы крепления', ordering: 152 }
          ]
        }
      ];

      const createdSubgroups = {};

      for (const mainGroup of prostheticSubgroups) {
        // Создаём родительскую подгруппу
        const parentResult = await client.query(`
          INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
          VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
          RETURNING id
        `, [mainGroup.name, mainGroup.description, mainGroup.ordering, createdMainGroups[mainGroup.parent]]);

        const parentGroupId = parentResult.rows[0].id;
        createdSubgroups[mainGroup.name] = parentGroupId;
        // Создаём дочерние группы
        for (const child of mainGroup.children) {
          const childResult = await client.query(`
            INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
            VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
            RETURNING id
          `, [child.name, child.description, child.ordering, parentGroupId]);

          createdSubgroups[child.name] = childResult.rows[0].id;
        }
      }

      // 4. Создаём подгруппы размеров
      const sizeSubgroups = [
        {
          name: 'Универсальные размеры',
          description: 'Стандартные системы размеров',
          parent: 'РАЗМЕРЫ',
          ordering: 210,
          children: [
            { name: 'Размеры одежды', description: 'Международные размеры одежды', ordering: 211 },
            { name: 'Размеры обуви', description: 'Европейские размеры обуви', ordering: 212 }
          ]
        },
        {
          name: 'Точные размеры',
          description: 'Размеры в сантиметрах',
          parent: 'РАЗМЕРЫ',
          ordering: 220,
          children: [
            { name: 'Размеры длины', description: 'Размеры длины в см', ordering: 221 },
            { name: 'Размеры окружности', description: 'Размеры окружности в см', ordering: 222 }
          ]
        }
      ];

      for (const mainGroup of sizeSubgroups) {
        // Создаём родительскую подгруппу
        const parentResult = await client.query(`
          INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
          VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
          RETURNING id
        `, [mainGroup.name, mainGroup.description, mainGroup.ordering, createdMainGroups[mainGroup.parent]]);

        const parentGroupId = parentResult.rows[0].id;
        // Создаём дочерние группы
        for (const child of mainGroup.children) {
          const childResult = await client.query(`
            INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
            VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
            RETURNING id
          `, [child.name, child.description, child.ordering, parentGroupId]);

          createdSubgroups[child.name] = childResult.rows[0].id;
        }
      }

      // 5. Создаём группу характеристик
      const characteristicGroup = await client.query(`
        INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
        VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
        RETURNING id
      `, ['Общие характеристики', 'Материалы, функции и цвета', 310, createdMainGroups['ХАРАКТЕРИСТИКИ']]);

      createdSubgroups['Общие характеристики'] = characteristicGroup.rows[0].id;
      // 6. Перемещаем существующие группы в иерархию
      const groupMappings = [
        // Протезы рук
        { oldName: 'Протезы рук - Детские', newParent: 'Детские протезы рук' },
        { oldName: 'Протезы рук - Взрослые', newParent: 'Взрослые протезы рук' },
        { oldName: 'Протезы рук - Специальные', newParent: 'Специальные протезы рук' },

        // Протезы ног
        { oldName: 'Протезы ног - Детские', newParent: 'Детские протезы ног' },
        { oldName: 'Протезы ног - Женские', newParent: 'Женские протезы ног' },
        { oldName: 'Протезы ног - Мужские', newParent: 'Мужские протезы ног' },

        // Протезы стоп
        { oldName: 'Протезы стоп - Детские', newParent: 'Детские протезы стоп' },
        { oldName: 'Протезы стоп - Женские', newParent: 'Женские протезы стоп' },
        { oldName: 'Протезы стоп - Мужские', newParent: 'Мужские протезы стоп' },

        // Ампутации
        { oldName: 'Ампутации - Верхние конечности', newParent: 'Ампутации верхних конечностей' },
        { oldName: 'Ампутации - Нижние конечности', newParent: 'Ампутации нижних конечностей' },

        // Крепления
        { oldName: 'Крепления - Механические', newParent: 'Механические крепления' },
        { oldName: 'Крепления - Современные', newParent: 'Современные крепления' },

        // Размеры
        { oldName: 'Размеры одежды', newParent: 'Размеры одежды' },
        { oldName: 'Размеры обуви EU', newParent: 'Размеры обуви' },
        { oldName: 'Размеры длины (см)', newParent: 'Размеры длины' },
        { oldName: 'Размеры окружности (см)', newParent: 'Размеры окружности' },

        // Характеристики
        { oldName: 'Материалы', newParent: 'Общие характеристики' },
        { oldName: 'Функции', newParent: 'Общие характеристики' },
        { oldName: 'Цвета', newParent: 'Общие характеристики' }
      ];

      for (const mapping of groupMappings) {
        if (createdSubgroups[mapping.newParent]) {
          await client.query(`
            UPDATE spec_groups
            SET parent_id = $1, updated_at = NOW()
            WHERE name = $2
          `, [createdSubgroups[mapping.newParent], mapping.oldName]);
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

createHierarchicalStructure().catch(console.error);