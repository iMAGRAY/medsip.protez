// Alternative backup script using SQL exports
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

// Tables to backup before cleanup
const TABLES_TO_BACKUP = [
  { name: 'media_files', where: null },
  { name: 'characteristics_values_simple', where: null },
  { name: 'product_characteristics_simple', where: null },
  { name: 'variant_characteristics_simple', where: null },
  { name: 'product_tag_relations', where: null },
  { name: 'user_sessions', where: "last_activity < NOW() - INTERVAL '30 days'" },
  { name: 'products', where: "is_deleted = true AND updated_at < NOW() - INTERVAL '90 days'" }
];

async function createBackup() {
  console.log('🔐 SQL Export Backup Script');
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

    const backupFile = path.join(BACKUP_DIR, `cleanup-backup-${TIMESTAMP}.sql`);
    const metadataFile = path.join(BACKUP_DIR, `cleanup-backup-${TIMESTAMP}.json`);
    
    let sqlContent = `-- Backup created on ${new Date().toISOString()}\n`;
    sqlContent += `-- Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}\n\n`;
    
    const metadata = {
      timestamp: new Date().toISOString(),
      database: {
        host: process.env.POSTGRESQL_HOST,
        port: process.env.POSTGRESQL_PORT,
        name: process.env.POSTGRESQL_DBNAME,
        user: process.env.POSTGRESQL_USER
      },
      tables: {},
      totalRows: 0
    };

    console.log('\n📋 Backing up tables:');
    
    for (const table of TABLES_TO_BACKUP) {
      console.log(`\n🔄 Processing ${table.name}...`);
      
      // Get count
      let countQuery = `SELECT COUNT(*) FROM ${table.name}`;
      if (table.where) {
        countQuery += ` WHERE ${table.where}`;
      }
      
      const countResult = await client.query(countQuery);
      const rowCount = parseInt(countResult.rows[0].count);
      
      console.log(`   Found ${rowCount} rows to backup`);
      
      if (rowCount > 0) {
        // Get table structure
        const columnsQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `;
        const columnsResult = await client.query(columnsQuery, [table.name]);
        
        // Add DROP and CREATE TABLE statements
        sqlContent += `\n-- Table: ${table.name}\n`;
        sqlContent += `-- Rows: ${rowCount}\n`;
        
        // Export data as INSERT statements
        let selectQuery = `SELECT * FROM ${table.name}`;
        if (table.where) {
          selectQuery += ` WHERE ${table.where}`;
        }
        
        const dataResult = await client.query(selectQuery);
        
        if (dataResult.rows.length > 0) {
          const columns = Object.keys(dataResult.rows[0]);
          
          // Create INSERT statements in batches
          const batchSize = 100;
          for (let i = 0; i < dataResult.rows.length; i += batchSize) {
            const batch = dataResult.rows.slice(i, i + batchSize);
            
            sqlContent += `\nINSERT INTO ${table.name} (${columns.join(', ')}) VALUES\n`;
            
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
        
        metadata.tables[table.name] = {
          rowCount,
          columns: columnsResult.rows.map(c => c.column_name),
          whereClause: table.where || null
        };
        metadata.totalRows += rowCount;
      } else {
        metadata.tables[table.name] = {
          rowCount: 0,
          whereClause: table.where || null
        };
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
    console.log(`   Metadata: ${metadataFile}`);
    
    // Create restore instructions
    const restoreInstructions = `# Restore Instructions for backup ${TIMESTAMP}

## Using psql:
\`\`\`bash
psql -h ${process.env.POSTGRESQL_HOST} -p ${process.env.POSTGRESQL_PORT} -U ${process.env.POSTGRESQL_USER} -d ${process.env.POSTGRESQL_DBNAME} < ${path.basename(backupFile)}
\`\`\`

## Using Node.js script:
\`\`\`bash
node restore-backup.js ${path.basename(backupFile)}
\`\`\`

## Backup contains:
${Object.entries(metadata.tables).map(([table, info]) => `- ${table}: ${info.rowCount} rows`).join('\n')}

Total rows: ${metadata.totalRows}
`;
    
    const instructionsFile = path.join(BACKUP_DIR, `restore-instructions-${TIMESTAMP}.md`);
    fs.writeFileSync(instructionsFile, restoreInstructions);
    
    console.log(`   Instructions: ${instructionsFile}`);
    console.log('\n✨ You can now safely run the cleanup script!');
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Execute backup
createBackup()
  .then(() => {
    console.log('\n✅ Backup script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Backup script failed:', error);
    process.exit(1);
  });