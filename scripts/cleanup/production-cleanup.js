const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Конфигурация для очистки
const CLEANUP_CONFIG = {
  // Таблицы для удаления (пустые и неиспользуемые)
  tablesToDrop: [
    'product_images',           // Пустая, заменена на media_files
    'product_selection_tables', // Пустая, не используется
    'warehouse_movements',      // Пустая, функционал не реализован
    'product_media_links',      // Пустая, не используется
    'product_view_stats',       // Пустая, не используется
    'suppliers',                // Пустая, не используется
    'price_logs',               // Пустая, не используется
    'product_suppliers',        // Пустая, не используется
    'product_certificates',     // Пустая, не используется
  ],
  
  // Backup таблицы для удаления
  backupTablesToDrop: [
    'characteristics_consolidated_backup',
    'product_characteristics_new_backup_final',
    'eav_backup_before_cleanup'
  ],
  
  // Legacy таблицы для архивации
  legacyTables: [
    'characteristic_values_legacy',
    'characteristic_groups_legacy'
  ],
  
  // Индексы для проверки и оптимизации
  indexesToReview: [
    'idx_characteristic_groups_is_active',
    'idx_characteristic_groups_is_section',
    'idx_characteristic_values_is_active'
  ]
};

async function createBackup() {
  console.log('📦 Создание резервной копии структуры БД...');
  
  try {
    // Получаем структуру всех таблиц
    const tablesResult = await pool.query(`
      SELECT 
        table_name,
        pg_get_ddl('CREATE TABLE'::regclass, (quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass) as ddl
      FROM information_schema.tables
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, `backup-${timestamp}`);
    await fs.mkdir(backupDir, { recursive: true });
    
    // Сохраняем DDL каждой таблицы
    for (const table of tablesResult.rows) {
      const filePath = path.join(backupDir, `${table.table_name}.sql`);
      await fs.writeFile(filePath, table.ddl);
    }
    
    console.log(`✅ Резервная копия создана в: ${backupDir}`);
    return backupDir;
  } catch (error) {
    console.error('❌ Ошибка создания резервной копии:', error.message);
    throw error;
  }
}

async function dropUnusedTables() {
  console.log('\n🗑️  Удаление неиспользуемых таблиц...');
  
  for (const table of CLEANUP_CONFIG.tablesToDrop) {
    try {
      // Проверяем, что таблица действительно пустая
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(countResult.rows[0].count);
      
      if (count === 0) {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Удалена таблица: ${table}`);
      } else {
        console.log(`⚠️  Пропущена таблица ${table} - содержит ${count} записей`);
      }
    } catch (error) {
      console.error(`❌ Ошибка при удалении ${table}:`, error.message);
    }
  }
}

async function dropBackupTables() {
  console.log('\n🗑️  Удаление backup таблиц...');
  
  for (const table of CLEANUP_CONFIG.backupTablesToDrop) {
    try {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`✅ Удалена backup таблица: ${table}`);
    } catch (error) {
      console.error(`❌ Ошибка при удалении ${table}:`, error.message);
    }
  }
}

async function archiveLegacyTables() {
  console.log('\n📁 Архивация legacy таблиц...');
  
  const archiveSchema = 'archive';
  
  // Создаем схему для архива если не существует
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${archiveSchema}`);
  
  for (const table of CLEANUP_CONFIG.legacyTables) {
    try {
      // Перемещаем таблицу в архивную схему
      await pool.query(`ALTER TABLE ${table} SET SCHEMA ${archiveSchema}`);
      console.log(`✅ Таблица ${table} перемещена в схему ${archiveSchema}`);
    } catch (error) {
      console.error(`❌ Ошибка при архивации ${table}:`, error.message);
    }
  }
}

async function optimizeIndexes() {
  console.log('\n🔧 Оптимизация индексов...');
  
  // Анализ использования индексов
  const indexUsageResult = await pool.query(`
    SELECT 
      schemaname,
      tablename,
      indexname,
      idx_scan,
      idx_tup_read,
      idx_tup_fetch,
      pg_size_pretty(pg_relation_size(indexrelid)) as index_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    AND idx_scan = 0
    ORDER BY pg_relation_size(indexrelid) DESC
  `);
  
  console.log(`\n📊 Найдено ${indexUsageResult.rows.length} неиспользуемых индексов:`);
  
  for (const idx of indexUsageResult.rows) {
    console.log(`   - ${idx.indexname} на ${idx.tablename} (размер: ${idx.index_size})`);
  }
  
  // VACUUM и ANALYZE для оптимизации
  console.log('\n🧹 Выполнение VACUUM ANALYZE...');
  await pool.query('VACUUM ANALYZE');
  console.log('✅ VACUUM ANALYZE выполнен');
}

async function consolidateCharacteristics() {
  console.log('\n🔄 Консолидация системы характеристик...');
  
  // Проверяем использование разных систем
  const usageStats = await pool.query(`
    SELECT 
      'characteristics_simple' as system,
      COUNT(*) as usage_count
    FROM product_characteristics_simple
    UNION ALL
    SELECT 
      'characteristic_templates' as system,
      COUNT(*) as usage_count
    FROM characteristic_templates
  `);
  
  console.log('\n📊 Статистика использования систем характеристик:');
  usageStats.rows.forEach(row => {
    console.log(`   - ${row.system}: ${row.usage_count} записей`);
  });
  
  // Рекомендация по миграции
  console.log('\n💡 Рекомендация: использовать упрощенную систему (characteristics_*_simple) как основную');
}

async function generateReport() {
  console.log('\n📄 Генерация отчета...');
  
  const report = {
    timestamp: new Date().toISOString(),
    database: {
      tables: 0,
      totalSize: '',
      indexes: 0,
      views: 0
    },
    cleanup: {
      tablesDropped: [],
      backupTablesDropped: [],
      tablesArchived: [],
      unusedIndexes: []
    },
    recommendations: []
  };
  
  // Собираем статистику
  const statsResult = await pool.query(`
    SELECT 
      COUNT(DISTINCT table_name) as table_count,
      pg_size_pretty(pg_database_size(current_database())) as db_size,
      COUNT(DISTINCT indexname) as index_count
    FROM information_schema.tables t
    LEFT JOIN pg_indexes i ON t.table_name = i.tablename
    WHERE t.table_schema = 'public'
  `);
  
  const viewsResult = await pool.query(`
    SELECT COUNT(*) as view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
  `);
  
  report.database.tables = statsResult.rows[0].table_count;
  report.database.totalSize = statsResult.rows[0].db_size;
  report.database.indexes = statsResult.rows[0].index_count;
  report.database.views = viewsResult.rows[0].view_count;
  
  // Сохраняем отчет
  const reportPath = path.join(__dirname, `cleanup-report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`✅ Отчет сохранен: ${reportPath}`);
  return report;
}

async function main() {
  console.log('🚀 Начало процесса очистки и оптимизации БД для продакшена\n');
  
  try {
    // 1. Создаем резервную копию
    await createBackup();
    
    // 2. Удаляем неиспользуемые таблицы
    await dropUnusedTables();
    
    // 3. Удаляем backup таблицы
    await dropBackupTables();
    
    // 4. Архивируем legacy таблицы
    await archiveLegacyTables();
    
    // 5. Оптимизируем индексы
    await optimizeIndexes();
    
    // 6. Анализируем систему характеристик
    await consolidateCharacteristics();
    
    // 7. Генерируем отчет
    const report = await generateReport();
    
    console.log('\n✅ Процесс очистки завершен успешно!');
    console.log(`📊 Размер БД: ${report.database.totalSize}`);
    console.log(`📊 Таблиц: ${report.database.tables}`);
    console.log(`📊 Индексов: ${report.database.indexes}`);
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем только если скрипт вызван напрямую
if (require.main === module) {
  main();
}

module.exports = { CLEANUP_CONFIG, createBackup };