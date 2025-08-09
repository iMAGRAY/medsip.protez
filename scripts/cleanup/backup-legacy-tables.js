// Backup legacy tables before deletion
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRESQL_HOST,
  port: process.env.POSTGRESQL_PORT,
  database: process.env.POSTGRESQL_DBNAME,
  user: process.env.POSTGRESQL_USER,
  password: process.env.POSTGRESQL_PASSWORD,
  ssl: false
});

const BACKUP_DIR = path.join(__dirname, '../../backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

// Tables that are safe to delete (from analysis)
const TABLES_TO_DELETE = [
  'characteristics_consolidated_backup',
  'eav_backup_before_cleanup',
  'product_characteristics_new_backup_final'
  // NOT including form_templates - it's used in the code
  // NOT including characteristic_templates - it's referenced by other tables
];

async function backupLegacyTables() {
  console.log('🔐 Legacy Tables Backup Script');
  console.log(`Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}`);
  console.log(`Backup timestamp: ${TIMESTAMP}`);
  console.log('='.repeat(60));

  const client = await pool.connect();
  
  try {
    // Create backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
    }

    const backupFile = path.join(BACKUP_DIR, `legacy-tables-backup-${TIMESTAMP}.sql`);
    const metadataFile = path.join(BACKUP_DIR, `legacy-tables-backup-${TIMESTAMP}.json`);
    
    let sqlContent = `-- Legacy tables backup created on ${new Date().toISOString()}\n`;
    sqlContent += `-- Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}\n`;
    sqlContent += `-- This backup contains legacy/backup tables that are safe to delete\n\n`;
    
    const metadata = {
      timestamp: new Date().toISOString(),
      database: {
        host: process.env.POSTGRESQL_HOST,
        port: process.env.POSTGRESQL_PORT,
        name: process.env.POSTGRESQL_DBNAME,
        user: process.env.POSTGRESQL_USER
      },
      tables: {},
      totalRows: 0,
      totalSizeKB: 0
    };

    console.log('\n📋 Backing up legacy tables:');
    
    for (const tableName of TABLES_TO_DELETE) {
      console.log(`\n🔄 Processing ${tableName}...`);
      
      try {
        // Get table info
        const infoQuery = `
          SELECT 
            COUNT(*) as row_count,
            pg_size_pretty(pg_total_relation_size($1::regclass)) as size_pretty,
            pg_total_relation_size($1::regclass) / 1024 as size_kb
          FROM ${tableName}
        `;
        const infoResult = await client.query(infoQuery, [tableName]);
        const rowCount = parseInt(infoResult.rows[0].row_count);
        const sizeKB = parseInt(infoResult.rows[0].size_kb);
        
        console.log(`   Found ${rowCount} rows (${infoResult.rows[0].size_pretty})`);
        
        // Get table structure
        const structureQuery = `
          SELECT 
            'CREATE TABLE ' || $1 || ' (' ||
            string_agg(
              column_name || ' ' || 
              data_type || 
              CASE 
                WHEN character_maximum_length IS NOT NULL 
                THEN '(' || character_maximum_length || ')'
                ELSE ''
              END ||
              CASE 
                WHEN is_nullable = 'NO' THEN ' NOT NULL'
                ELSE ''
              END ||
              CASE 
                WHEN column_default IS NOT NULL 
                THEN ' DEFAULT ' || column_default
                ELSE ''
              END,
              ', '
              ORDER BY ordinal_position
            ) || ');' as create_statement
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
        `;
        const structureResult = await client.query(structureQuery, [tableName]);
        
        sqlContent += `\n-- Table: ${tableName}\n`;
        sqlContent += `-- Rows: ${rowCount}, Size: ${infoResult.rows[0].size_pretty}\n`;
        sqlContent += `DROP TABLE IF EXISTS ${tableName} CASCADE;\n`;
        sqlContent += structureResult.rows[0].create_statement + '\n';
        
        // Export data if any
        if (rowCount > 0) {
          const dataResult = await client.query(`SELECT * FROM ${tableName}`);
          const columns = Object.keys(dataResult.rows[0]);
          
          sqlContent += `\n-- Data for ${tableName}\n`;
          
          // Create INSERT statements in batches
          const batchSize = 50;
          for (let i = 0; i < dataResult.rows.length; i += batchSize) {
            const batch = dataResult.rows.slice(i, i + batchSize);
            
            sqlContent += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`;
            
            const values = batch.map((row, idx) => {
              const vals = columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'boolean') return val.toString();
                if (typeof val === 'number') return val.toString();
                if (val instanceof Date) return `'${val.toISOString()}'`;
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                return `'${val.toString().replace(/'/g, "''")}'`;
              });
              return `(${vals.join(', ')})`;
            });
            
            sqlContent += values.join(',\n') + ';\n';
          }
        }
        
        // Get indexes
        const indexQuery = `
          SELECT indexdef 
          FROM pg_indexes 
          WHERE schemaname = 'public' AND tablename = $1
        `;
        const indexResult = await client.query(indexQuery, [tableName]);
        
        if (indexResult.rows.length > 0) {
          sqlContent += `\n-- Indexes for ${tableName}\n`;
          indexResult.rows.forEach(row => {
            sqlContent += row.indexdef + ';\n';
          });
        }
        
        metadata.tables[tableName] = {
          rowCount,
          sizeKB,
          sizePretty: infoResult.rows[0].size_pretty
        };
        metadata.totalRows += rowCount;
        metadata.totalSizeKB += sizeKB;
        
      } catch (error) {
        console.error(`   ❌ Error backing up ${tableName}:`, error.message);
      }
    }
    
    // Write backup file
    fs.writeFileSync(backupFile, sqlContent);
    
    // Check file size
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    // Write metadata
    metadata.backupFile = path.basename(backupFile);
    metadata.fileSize = stats.size;
    metadata.fileSizeMB = parseFloat(fileSizeMB);
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    
    console.log(`\n✅ Backup created successfully!`);
    console.log(`   File: ${backupFile}`);
    console.log(`   Size: ${fileSizeMB} MB`);
    console.log(`   Total rows: ${metadata.totalRows}`);
    console.log(`   Total table size: ${Math.round(metadata.totalSizeKB / 1024)} MB`);
    console.log(`   Metadata: ${metadataFile}`);
    
    console.log('\n📌 Tables backed up:');
    Object.entries(metadata.tables).forEach(([table, info]) => {
      console.log(`   - ${table}: ${info.rowCount} rows (${info.sizePretty})`);
    });
    
    console.log('\n✨ You can now safely delete these legacy tables!');
    console.log('   Run: node scripts/cleanup/delete-legacy-tables.js');
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Execute backup
backupLegacyTables()
  .then(() => {
    console.log('\n✅ Backup script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Backup script failed:', error);
    process.exit(1);
  });