const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://gen_user:Q1w2e3r4t5!%40@212.113.118.141:5432/default_db'
});

async function analyzeDatabase() {
  try {
    console.log('=== АНАЛИЗ БАЗЫ ДАННЫХ ===\n');

    // 1. Получаем список всех таблиц
    const tablesResult = await pool.query(`
      SELECT 
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name)::regclass)) as size,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY pg_total_relation_size(quote_ident(table_name)::regclass) DESC
    `);
    
    console.log('ТАБЛИЦЫ В БАЗЕ ДАННЫХ:');
    console.log('─'.repeat(80));
    
    for (const table of tablesResult.rows) {
      // Получаем количество записей
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        console.log(`${table.table_name.padEnd(40)} | Записей: ${countResult.rows[0].count.toString().padStart(8)} | Колонок: ${table.columns_count.toString().padStart(3)} | Размер: ${table.size}`);
      } catch (e) {
        console.log(`${table.table_name.padEnd(40)} | Ошибка подсчета записей`);
      }
    }
    
    console.log(`\nВсего таблиц: ${tablesResult.rows.length}\n`);

    // 2. Анализируем связи между таблицами
    console.log('\nВНЕШНИЕ КЛЮЧИ:');
    console.log('─'.repeat(80));
    
    const fkResult = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);
    
    let currentTable = '';
    for (const fk of fkResult.rows) {
      if (currentTable !== fk.table_name) {
        if (currentTable) console.log();
        console.log(`${fk.table_name}:`);
        currentTable = fk.table_name;
      }
      console.log(`  ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    }

    // 3. Анализируем представления (views)
    console.log('\n\nПРЕДСТАВЛЕНИЯ (VIEWS):');
    console.log('─'.repeat(80));
    
    const viewsResult = await pool.query(`
      SELECT table_name as view_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    for (const view of viewsResult.rows) {
      console.log(`- ${view.view_name}`);
    }
    
    console.log(`\nВсего представлений: ${viewsResult.rows.length}`);

    // 4. Анализируем индексы
    console.log('\n\nИНДЕКСЫ:');
    console.log('─'.repeat(80));
    
    const indexResult = await pool.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    
    currentTable = '';
    let indexCount = 0;
    for (const idx of indexResult.rows) {
      if (currentTable !== idx.tablename) {
        if (currentTable) console.log();
        console.log(`${idx.tablename}:`);
        currentTable = idx.tablename;
      }
      console.log(`  - ${idx.indexname}`);
      indexCount++;
    }
    
    console.log(`\nВсего индексов: ${indexCount}`);

    // 5. Анализируем триггеры
    console.log('\n\nТРИГГЕРЫ:');
    console.log('─'.repeat(80));
    
    const triggerResult = await pool.query(`
      SELECT 
        trigger_name,
        event_object_table,
        action_timing,
        event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);
    
    currentTable = '';
    for (const trigger of triggerResult.rows) {
      if (currentTable !== trigger.event_object_table) {
        if (currentTable) console.log();
        console.log(`${trigger.event_object_table}:`);
        currentTable = trigger.event_object_table;
      }
      console.log(`  - ${trigger.trigger_name} (${trigger.action_timing} ${trigger.event_manipulation})`);
    }
    
    console.log(`\nВсего триггеров: ${triggerResult.rows.length}`);

    // 6. Анализируем дубликаты и проблемные таблицы
    console.log('\n\nАНАЛИЗ ПРОБЛЕМ:');
    console.log('─'.repeat(80));
    
    // Проверяем таблицы с похожими названиями
    const similarTables = tablesResult.rows.filter(t => {
      return tablesResult.rows.some(t2 => 
        t.table_name !== t2.table_name && 
        (t.table_name.includes(t2.table_name) || t2.table_name.includes(t.table_name))
      );
    });
    
    if (similarTables.length > 0) {
      console.log('\nТаблицы с похожими названиями:');
      similarTables.forEach(t => console.log(`  - ${t.table_name}`));
    }

    // 7. Анализируем системы характеристик
    console.log('\n\nСИСТЕМЫ ХАРАКТЕРИСТИК:');
    console.log('─'.repeat(80));
    
    const charSystems = [
      { prefix: 'characteristic_', name: 'Новая система (characteristic_*)' },
      { prefix: 'characteristics_', name: 'Упрощенная система (characteristics_*_simple)' },
      { prefix: 'spec_', name: 'Старая система (spec_*)' },
      { prefix: 'product_characteristics', name: 'Характеристики продуктов' },
      { prefix: 'variant_characteristics', name: 'Характеристики вариантов' }
    ];
    
    for (const system of charSystems) {
      const tables = tablesResult.rows.filter(t => t.table_name.startsWith(system.prefix));
      if (tables.length > 0) {
        console.log(`\n${system.name}:`);
        tables.forEach(t => console.log(`  - ${t.table_name}`));
      }
    }

    // 8. Анализируем неиспользуемые таблицы
    console.log('\n\nПУСТЫЕ ТАБЛИЦЫ:');
    console.log('─'.repeat(80));
    
    for (const table of tablesResult.rows) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        if (countResult.rows[0].count === '0') {
          console.log(`  - ${table.table_name}`);
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }

  } catch (error) {
    console.error('Ошибка анализа:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeDatabase();