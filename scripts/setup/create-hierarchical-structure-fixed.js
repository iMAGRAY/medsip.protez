const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
  database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
  port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

async function createHierarchicalStructureFixed() {
  try {
    const client = await pool.connect();
    try {
      // Проверяем есть ли уже созданные основные группы
      const existingMainGroups = await client.query(`
        SELECT id, name FROM spec_groups
        WHERE name IN ('ПРОТЕЗЫ', 'РАЗМЕРЫ', 'ХАРАКТЕРИСТИКИ')
      `);

      const mainGroupIds = {};
      existingMainGroups.rows.forEach(row => {
        mainGroupIds[row.name] = row.id;
      });

      console.log('📋 Найдены основные группы:', Object.keys(mainGroupIds));

      // Создаём только недостающие подгруппы размеров с уникальными именами
      const sizeSubgroupMappings = [
        {
          newName: 'Универсальные размеры (группа)',
          description: 'Стандартные системы размеров',
          parent: 'РАЗМЕРЫ',
          ordering: 210,
          children: [
            { newName: 'Размеры одежды (группа)', oldName: 'Размеры одежды' },
            { newName: 'Размеры обуви (группа)', oldName: 'Размеры обуви EU' }
          ]
        },
        {
          newName: 'Точные размеры (группа)',
          description: 'Размеры в сантиметрах',
          parent: 'РАЗМЕРЫ',
          ordering: 220,
          children: [
            { newName: 'Размеры длины (группа)', oldName: 'Размеры длины (см)' },
            { newName: 'Размеры окружности (группа)', oldName: 'Размеры окружности (см)' }
          ]
        }
      ];

      const createdSubgroups = {};

      // Получаем ID существующих групп протезов
      const existingProstheticGroups = await client.query(`
        SELECT id, name FROM spec_groups
        WHERE name LIKE '%протез%' OR name LIKE '%Протез%' OR name LIKE '%Ампутаци%' OR name LIKE '%Креплени%'
      `);

      existingProstheticGroups.rows.forEach(row => {
        // Сопоставляем старые имена с новыми группами
        if (row.name.includes('рук - Детские')) createdSubgroups['Детские протезы рук'] = row.id;
        if (row.name.includes('рук - Взрослые')) createdSubgroups['Взрослые протезы рук'] = row.id;
        if (row.name.includes('рук - Специальные')) createdSubgroups['Специальные протезы рук'] = row.id;
        if (row.name.includes('ног - Детские')) createdSubgroups['Детские протезы ног'] = row.id;
        if (row.name.includes('ног - Женские')) createdSubgroups['Женские протезы ног'] = row.id;
        if (row.name.includes('ног - Мужские')) createdSubgroups['Мужские протезы ног'] = row.id;
        if (row.name.includes('стоп - Детские')) createdSubgroups['Детские протезы стоп'] = row.id;
        if (row.name.includes('стоп - Женские')) createdSubgroups['Женские протезы стоп'] = row.id;
        if (row.name.includes('стоп - Мужские')) createdSubgroups['Мужские протезы стоп'] = row.id;
        if (row.name.includes('Верхние конечности')) createdSubgroups['Ампутации верхних конечностей'] = row.id;
        if (row.name.includes('Нижние конечности')) createdSubgroups['Ампутации нижних конечностей'] = row.id;
        if (row.name.includes('Механические')) createdSubgroups['Механические крепления'] = row.id;
        if (row.name.includes('Современные')) createdSubgroups['Современные крепления'] = row.id;
      });

      // Создаём подгруппы размеров только если их нет
      for (const mainGroup of sizeSubgroupMappings) {
        if (mainGroupIds[mainGroup.parent]) {
          // Проверяем существует ли уже такая группа
          const existingGroup = await client.query(`
            SELECT id FROM spec_groups WHERE name = $1
          `, [mainGroup.newName]);

          let parentGroupId;
          if (existingGroup.rows.length > 0) {
            parentGroupId = existingGroup.rows[0].id;
          } else {
            const parentResult = await client.query(`
              INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
              VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
              RETURNING id
            `, [mainGroup.newName, mainGroup.description, mainGroup.ordering, mainGroupIds[mainGroup.parent]]);

            parentGroupId = parentResult.rows[0].id;
          }

          // Создаём дочерние группы и перемещаем существующие
          for (const child of mainGroup.children) {
            // Проверяем существует ли дочерняя группа
            const existingChild = await client.query(`
              SELECT id FROM spec_groups WHERE name = $1
            `, [child.newName]);

            let childGroupId;
            if (existingChild.rows.length > 0) {
              childGroupId = existingChild.rows[0].id;
            } else {
              const childResult = await client.query(`
                INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
                VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
                RETURNING id
              `, [child.newName, 'Группа размеров', parentGroupId + 1, parentGroupId]);

              childGroupId = childResult.rows[0].id;
            }

            // Перемещаем существующую группу под новую дочернюю группу
            const moveResult = await client.query(`
              UPDATE spec_groups
              SET parent_id = $1, updated_at = NOW()
              WHERE name = $2
              RETURNING id
            `, [childGroupId, child.oldName]);

            if (moveResult.rows.length > 0) {
            }
          }
        }
      }

      // Создаём группу характеристик
      if (mainGroupIds['ХАРАКТЕРИСТИКИ']) {
        // Проверяем существует ли группа характеристик
        const existingCharGroup = await client.query(`
          SELECT id FROM spec_groups WHERE name = 'Общие характеристики (группа)'
        `);

        let charGroupId;
        if (existingCharGroup.rows.length > 0) {
          charGroupId = existingCharGroup.rows[0].id;
        } else {
          const characteristicGroup = await client.query(`
            INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
            VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
            RETURNING id
          `, ['Общие характеристики (группа)', 'Материалы, функции и цвета', 310, mainGroupIds['ХАРАКТЕРИСТИКИ']]);

          charGroupId = characteristicGroup.rows[0].id;
        }

        // Перемещаем характеристики
        const characteristics = ['Материалы', 'Функции', 'Цвета'];
        for (const char of characteristics) {
          await client.query(`
            UPDATE spec_groups
            SET parent_id = $1, updated_at = NOW()
            WHERE name = $2
          `, [charGroupId, char]);
        }
      }

      // Устанавливаем parent_id для основных групп протезов
      if (mainGroupIds['ПРОТЕЗЫ']) {
        // Находим и создаем основные группы протезов
        const prostheticMainGroups = [
          { name: 'Протезы рук (категория)', existingPattern: 'рук -' },
          { name: 'Протезы ног (категория)', existingPattern: 'ног -' },
          { name: 'Протезы стоп (категория)', existingPattern: 'стоп -' },
          { name: 'Ампутации (категория)', existingPattern: 'Ампутации -' },
          { name: 'Крепления (категория)', existingPattern: 'Крепления -' }
        ];

        for (const mainGroup of prostheticMainGroups) {
          // Проверяем существует ли основная группа
          const existingMain = await client.query(`
            SELECT id FROM spec_groups WHERE name = $1
          `, [mainGroup.name]);

          let mainGroupId;
          if (existingMain.rows.length > 0) {
            mainGroupId = existingMain.rows[0].id;
          } else {
            const result = await client.query(`
              INSERT INTO spec_groups (name, description, ordering, is_active, created_at, updated_at, parent_id)
              VALUES ($1, $2, $3, true, NOW(), NOW(), $4)
              RETURNING id
            `, [mainGroup.name, `Категория ${mainGroup.name.toLowerCase()}`, 110, mainGroupIds['ПРОТЕЗЫ']]);

            mainGroupId = result.rows[0].id;
          }

          // Перемещаем существующие подгруппы под основную группу
          await client.query(`
            UPDATE spec_groups
            SET parent_id = $1, updated_at = NOW()
            WHERE name LIKE $2 AND parent_id IS NULL
          `, [mainGroupId, `%${mainGroup.existingPattern}%`]);
        }
      }
      // Показываем итоговую структуру
      const hierarchyResult = await client.query(`
        WITH RECURSIVE hierarchy AS (
          SELECT id, name, description, parent_id, 0 as level, ARRAY[ordering, id] as path
          FROM spec_groups
          WHERE parent_id IS NULL

          UNION ALL

          SELECT sg.id, sg.name, sg.description, sg.parent_id, h.level + 1, h.path || ARRAY[sg.ordering, sg.id]
          FROM spec_groups sg
          JOIN hierarchy h ON sg.parent_id = h.id
        )
        SELECT id, name, description, level,
               (SELECT COUNT(*) FROM spec_enums WHERE group_id = hierarchy.id) as enum_count
        FROM hierarchy
        ORDER BY path
      `);
      hierarchyResult.rows.forEach(row => {
        const indent = '  '.repeat(row.level);
        const prefix = row.level === 0 ? '📁' : row.level === 1 ? '📂' : '📄';
        const enumInfo = row.enum_count > 0 ? ` (${row.enum_count} размеров)` : '';
      });

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

createHierarchicalStructureFixed().catch(console.error);