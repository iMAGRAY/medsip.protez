const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://gen_user:Q1w2e3r4t5!%40@212.113.118.141:5432/default_db'
});

async function analyzeAPIConsistency() {
  console.log('🔍 АНАЛИЗ КОНСИСТЕНТНОСТИ API И БАЗЫ ДАННЫХ\n');
  
  const issues = {
    duplicateSystems: [],
    legacyUsage: [],
    inconsistentAPIs: [],
    emptyTables: [],
    recommendations: []
  };
  
  try {
    // 1. Анализ дублирующихся систем
    console.log('1️⃣ Проверка дублирующихся систем...');
    
    // Система вариантов
    const variantSystems = await pool.query(`
      SELECT 
        'product_sizes' as table_name,
        COUNT(*) as record_count,
        pg_size_pretty(pg_relation_size('product_sizes')) as table_size
      FROM product_sizes
      UNION ALL
      SELECT 
        'product_variants' as table_name,
        COUNT(*) as record_count,
        pg_size_pretty(pg_relation_size('product_variants')) as table_size
      FROM product_variants
    `);
    
    console.log('\n📊 Системы вариантов товаров:');
    variantSystems.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.record_count} записей (${row.table_size})`);
      if (row.record_count > 0) {
        issues.duplicateSystems.push({
          system: 'variants',
          table: row.table_name,
          records: row.record_count
        });
      }
    });
    
    // Системы характеристик
    const characteristicSystems = await pool.query(`
      SELECT 
        system,
        COUNT(*) as table_count,
        SUM(record_count) as total_records
      FROM (
        SELECT 'legacy' as system, COUNT(*) as record_count FROM characteristic_groups_legacy
        UNION ALL
        SELECT 'legacy' as system, COUNT(*) as record_count FROM characteristic_values_legacy
        UNION ALL
        SELECT 'simple' as system, COUNT(*) as record_count FROM characteristics_groups_simple
        UNION ALL
        SELECT 'simple' as system, COUNT(*) as record_count FROM characteristics_values_simple
        UNION ALL
        SELECT 'spec' as system, COUNT(*) as record_count FROM spec_groups
        UNION ALL
        SELECT 'spec' as system, COUNT(*) as record_count FROM spec_enums
      ) t
      GROUP BY system
    `);
    
    console.log('\n📊 Системы характеристик:');
    characteristicSystems.rows.forEach(row => {
      console.log(`   ${row.system}: ${row.total_records} записей в ${row.table_count} таблицах`);
    });
    
    // 2. Проверка использования legacy таблиц
    console.log('\n2️⃣ Проверка использования legacy таблиц...');
    
    const legacyTables = [
      'characteristic_groups_legacy',
      'characteristic_values_legacy',
      'spec_groups',
      'spec_enums'
    ];
    
    for (const table of legacyTables) {
      const usage = await pool.query(`
        SELECT COUNT(*) as count FROM ${table}
      `);
      
      if (usage.rows[0].count > 0) {
        issues.legacyUsage.push({
          table: table,
          records: usage.rows[0].count
        });
      }
    }
    
    // 3. Анализ API endpoints
    console.log('\n3️⃣ Анализ API endpoints...');
    
    const apiDir = path.join(__dirname, '..', 'app', 'api');
    const apiAnalysis = await analyzeAPIDirectory(apiDir);
    
    console.log('\n📊 Статистика API:');
    console.log(`   Всего endpoints: ${apiAnalysis.totalEndpoints}`);
    console.log(`   Используют product_sizes: ${apiAnalysis.usingProductSizes}`);
    console.log(`   Используют product_variants: ${apiAnalysis.usingProductVariants}`);
    console.log(`   Используют spec_groups/enums: ${apiAnalysis.usingSpecTables}`);
    console.log(`   Используют legacy характеристики: ${apiAnalysis.usingLegacyChars}`);
    
    // 4. Пустые таблицы
    console.log('\n4️⃣ Проверка пустых таблиц...');
    
    const emptyTablesCheck = await pool.query(`
      SELECT 
        table_name,
        pg_size_pretty(pg_relation_size(table_name::regclass)) as size
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN (
        'product_images', 'product_selection_tables', 'warehouse_movements',
        'variant_characteristics_simple', 'product_media_links', 'product_view_stats',
        'suppliers', 'price_logs', 'product_suppliers', 'product_certificates'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables t2
        WHERE t2.table_name = information_schema.tables.table_name || '_pkey'
      )
    `);
    
    // 5. Формирование рекомендаций
    console.log('\n💡 РЕКОМЕНДАЦИИ:\n');
    
    if (issues.duplicateSystems.some(s => s.system === 'variants')) {
      console.log('🔸 ВАРИАНТЫ ТОВАРОВ:');
      console.log('   - Мигрировать данные из product_sizes в product_variants');
      console.log('   - Обновить все API для использования product_variants');
      console.log('   - Удалить таблицу product_sizes после миграции');
      issues.recommendations.push('migrate_variants');
    }
    
    if (issues.legacyUsage.length > 0) {
      console.log('\n🔸 ХАРАКТЕРИСТИКИ:');
      console.log('   - Мигрировать с legacy таблиц на simplified систему');
      console.log('   - Обновить API endpoints для использования characteristics_*_simple');
      console.log('   - Архивировать или удалить legacy таблицы');
      issues.recommendations.push('migrate_characteristics');
    }
    
    console.log('\n🔸 ОБЩИЕ РЕКОМЕНДАЦИИ:');
    console.log('   - Создать единый API v3 с консистентной структурой');
    console.log('   - Внедрить строгую типизацию для всех endpoints');
    console.log('   - Добавить валидацию данных на уровне API');
    console.log('   - Настроить автоматические тесты для API');
    
    // Сохранение отчета
    const report = {
      timestamp: new Date().toISOString(),
      issues: issues,
      apiAnalysis: apiAnalysis,
      recommendations: generateDetailedRecommendations(issues)
    };
    
    const reportPath = path.join(__dirname, `api-consistency-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Отчет сохранен: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Ошибка анализа:', error);
  } finally {
    await pool.end();
  }
}

async function analyzeAPIDirectory(dir) {
  const stats = {
    totalEndpoints: 0,
    usingProductSizes: 0,
    usingProductVariants: 0,
    usingSpecTables: 0,
    usingLegacyChars: 0,
    endpoints: []
  };
  
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        const subStats = await analyzeAPIDirectory(fullPath);
        stats.totalEndpoints += subStats.totalEndpoints;
        stats.usingProductSizes += subStats.usingProductSizes;
        stats.usingProductVariants += subStats.usingProductVariants;
        stats.usingSpecTables += subStats.usingSpecTables;
        stats.usingLegacyChars += subStats.usingLegacyChars;
        stats.endpoints.push(...subStats.endpoints);
      } else if (file.name === 'route.ts' || file.name === 'route.js') {
        stats.totalEndpoints++;
        
        const content = await fs.readFile(fullPath, 'utf8');
        const endpoint = {
          path: fullPath.replace(/.*\/app\/api/, '/api').replace(/\/route\.(ts|js)$/, ''),
          uses: []
        };
        
        if (content.includes('product_sizes')) {
          stats.usingProductSizes++;
          endpoint.uses.push('product_sizes');
        }
        if (content.includes('product_variants')) {
          stats.usingProductVariants++;
          endpoint.uses.push('product_variants');
        }
        if (content.includes('spec_groups') || content.includes('spec_enums')) {
          stats.usingSpecTables++;
          endpoint.uses.push('spec_tables');
        }
        if (content.includes('characteristic_groups_legacy') || content.includes('characteristic_values_legacy')) {
          stats.usingLegacyChars++;
          endpoint.uses.push('legacy_characteristics');
        }
        
        if (endpoint.uses.length > 0) {
          stats.endpoints.push(endpoint);
        }
      }
    }
  } catch (error) {
    console.error('Ошибка анализа директории:', dir, error.message);
  }
  
  return stats;
}

function generateDetailedRecommendations(issues) {
  const recommendations = [];
  
  if (issues.duplicateSystems.some(s => s.system === 'variants')) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Варианты товаров',
      actions: [
        'Запустить скрипт migrate-sizes-to-variants.js',
        'Обновить все API endpoints для использования product_variants',
        'Обновить фронтенд компоненты',
        'Удалить таблицу product_sizes'
      ]
    });
  }
  
  if (issues.legacyUsage.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Система характеристик',
      actions: [
        'Мигрировать данные из spec_groups/spec_enums в characteristics_*_simple',
        'Обновить API /api/spec-groups на использование новых таблиц',
        'Обновить API /api/specifications',
        'Архивировать legacy таблицы'
      ]
    });
  }
  
  recommendations.push({
    priority: 'MEDIUM',
    category: 'API консистентность',
    actions: [
      'Создать API v3 с единой структурой',
      'Использовать типы из lib/api/types.ts',
      'Добавить middleware для валидации',
      'Внедрить единую обработку ошибок'
    ]
  });
  
  recommendations.push({
    priority: 'LOW',
    category: 'Очистка БД',
    actions: [
      'Удалить пустые таблицы',
      'Оптимизировать индексы',
      'Настроить автоматическую очистку логов',
      'Внедрить партиционирование для больших таблиц'
    ]
  });
  
  return recommendations;
}

// Запуск анализа
if (require.main === module) {
  analyzeAPIConsistency();
}