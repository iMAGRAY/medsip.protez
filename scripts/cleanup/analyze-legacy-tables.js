// Script to analyze legacy tables usage
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRESQL_HOST,
  port: process.env.POSTGRESQL_PORT,
  database: process.env.POSTGRESQL_DBNAME,
  user: process.env.POSTGRESQL_USER,
  password: process.env.POSTGRESQL_PASSWORD,
  ssl: false
});

const LEGACY_TABLES = [
  'characteristic_templates',
  'characteristics_consolidated_backup',
  'eav_backup_before_cleanup',
  'form_templates',
  'product_characteristics_new_backup_final'
];

async function analyzeLegacyTables() {
  console.log('🔍 Legacy Tables Analysis');
  console.log(`Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}`);
  console.log('='.repeat(60));

  const client = await pool.connect();
  
  try {
    const analysis = [];
    
    for (const tableName of LEGACY_TABLES) {
      console.log(`\n📊 Analyzing table: ${tableName}`);
      
      const tableInfo = {
        name: tableName,
        exists: false,
        rowCount: 0,
        sizeKB: 0,
        sizePretty: '0 bytes',
        lastModified: null,
        referencedBy: [],
        references: [],
        hasIndexes: false,
        hasTriggers: false,
        isReferenced: false,
        canBeDeleted: true
      };
      
      try {
        // 1. Check if table exists and get basic info
        const existsQuery = `
          SELECT 
            COUNT(*) as row_count,
            pg_size_pretty(pg_total_relation_size($1::regclass)) as size_pretty,
            pg_total_relation_size($1::regclass) / 1024 as size_kb
          FROM ${tableName}
        `;
        
        const existsResult = await client.query(existsQuery, [tableName]);
        tableInfo.exists = true;
        tableInfo.rowCount = parseInt(existsResult.rows[0].row_count);
        tableInfo.sizeKB = parseInt(existsResult.rows[0].size_kb);
        tableInfo.sizePretty = existsResult.rows[0].size_pretty;
        
        // 2. Get last modification time
        const statsQuery = `
          SELECT 
            GREATEST(
              COALESCE(last_vacuum, '1970-01-01'::timestamp),
              COALESCE(last_autovacuum, '1970-01-01'::timestamp),
              COALESCE(last_analyze, '1970-01-01'::timestamp),
              COALESCE(last_autoanalyze, '1970-01-01'::timestamp)
            ) as last_activity
          FROM pg_stat_user_tables
          WHERE schemaname = 'public' AND relname = $1
        `;
        
        const statsResult = await client.query(statsQuery, [tableName]);
        if (statsResult.rows.length > 0) {
          tableInfo.lastModified = statsResult.rows[0].last_activity;
        }
        
        // 3. Check foreign key references TO this table
        const referencedByQuery = `
          SELECT 
            tc.table_name as referencing_table,
            kcu.column_name as referencing_column,
            ccu.column_name as referenced_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND ccu.table_name = $1
        `;
        
        const referencedByResult = await client.query(referencedByQuery, [tableName]);
        tableInfo.referencedBy = referencedByResult.rows;
        tableInfo.isReferenced = referencedByResult.rows.length > 0;
        
        // 4. Check foreign key references FROM this table
        const referencesQuery = `
          SELECT 
            ccu.table_name as referenced_table,
            kcu.column_name as referencing_column,
            ccu.column_name as referenced_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = $1
        `;
        
        const referencesResult = await client.query(referencesQuery, [tableName]);
        tableInfo.references = referencesResult.rows;
        
        // 5. Check for indexes
        const indexQuery = `
          SELECT COUNT(*) as index_count
          FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = $1
        `;
        
        const indexResult = await client.query(indexQuery, [tableName]);
        tableInfo.hasIndexes = parseInt(indexResult.rows[0].index_count) > 0;
        
        // 6. Check for triggers
        const triggerQuery = `
          SELECT COUNT(*) as trigger_count
          FROM information_schema.triggers
          WHERE event_object_table = $1
        `;
        
        const triggerResult = await client.query(triggerQuery, [tableName]);
        tableInfo.hasTriggers = parseInt(triggerResult.rows[0].trigger_count) > 0;
        
        // 7. Search for table name in application code (check if used in queries)
        const codeSearchQuery = `
          SELECT 
            routine_name,
            routine_type
          FROM information_schema.routines
          WHERE routine_definition ILIKE $1
        `;
        
        const codeSearchResult = await client.query(codeSearchQuery, [`%${tableName}%`]);
        if (codeSearchResult.rows.length > 0) {
          tableInfo.canBeDeleted = false;
          console.log(`   ⚠️  Found in stored procedures/functions:`, codeSearchResult.rows);
        }
        
        // Determine if safe to delete
        tableInfo.canBeDeleted = !tableInfo.isReferenced && 
                                 !tableInfo.hasTriggers && 
                                 codeSearchResult.rows.length === 0;
        
      } catch (error) {
        if (error.code === '42P01') {
          console.log(`   ℹ️  Table does not exist`);
        } else {
          console.error(`   ❌ Error analyzing table:`, error.message);
        }
      }
      
      analysis.push(tableInfo);
    }
    
    // Display summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📋 ANALYSIS SUMMARY\n');
    
    const existingTables = analysis.filter(t => t.exists);
    const safeToDelete = existingTables.filter(t => t.canBeDeleted);
    const notSafeToDelete = existingTables.filter(t => !t.canBeDeleted);
    
    if (existingTables.length === 0) {
      console.log('✅ No legacy tables found - they may have been already deleted.');
    } else {
      console.log(`Found ${existingTables.length} legacy tables:\n`);
      
      existingTables.forEach(table => {
        console.log(`\n📦 ${table.name}`);
        console.log(`   Size: ${table.sizePretty} (${table.rowCount} rows)`);
        console.log(`   Last activity: ${table.lastModified || 'Unknown'}`);
        
        if (table.isReferenced) {
          console.log(`   ⚠️  Referenced by: ${table.referencedBy.map(r => r.referencing_table).join(', ')}`);
        }
        
        if (table.references.length > 0) {
          console.log(`   📎 References: ${table.references.map(r => r.referenced_table).join(', ')}`);
        }
        
        if (table.hasIndexes) {
          console.log(`   📑 Has indexes`);
        }
        
        if (table.hasTriggers) {
          console.log(`   ⚡ Has triggers`);
        }
        
        console.log(`   ${table.canBeDeleted ? '✅ Safe to delete' : '❌ NOT safe to delete'}`);
      });
      
      // Generate deletion script
      if (safeToDelete.length > 0) {
        console.log('\n\n' + '='.repeat(60));
        console.log('🗑️  SAFE TO DELETE:\n');
        
        console.log('Run this SQL to delete safe tables:');
        console.log('```sql');
        safeToDelete.forEach(table => {
          console.log(`DROP TABLE IF EXISTS ${table.name} CASCADE;`);
        });
        console.log('```');
        
        console.log('\nOr use the cleanup script:');
        console.log('```bash');
        console.log('node scripts/cleanup/delete-legacy-tables.js');
        console.log('```');
      }
      
      if (notSafeToDelete.length > 0) {
        console.log('\n\n⚠️  TABLES REQUIRING MANUAL REVIEW:');
        notSafeToDelete.forEach(table => {
          console.log(`\n- ${table.name}`);
          if (table.isReferenced) {
            console.log(`  Referenced by: ${table.referencedBy.map(r => `${r.referencing_table}.${r.referencing_column}`).join(', ')}`);
          }
        });
      }
    }
    
    // Search for table references in code
    console.log('\n\n' + '='.repeat(60));
    console.log('🔍 Searching for table references in codebase...\n');
    
    // Note: This would require filesystem access to search through .ts/.js files
    console.log('ℹ️  To search for table references in your code, run:');
    LEGACY_TABLES.forEach(table => {
      console.log(`   grep -r "${table}" --include="*.ts" --include="*.js" .`);
    });
    
  } catch (error) {
    console.error('\n❌ Analysis error:', error.message);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Execute analysis
analyzeLegacyTables()
  .then(() => {
    console.log('\n\n✨ Analysis completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Analysis failed:', error);
    process.exit(1);
  });