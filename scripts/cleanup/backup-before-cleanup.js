// Backup script to run before cleanup
// Creates a SQL dump of specified tables

require('dotenv').config({ path: '.env.local' });
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

// Tables to backup before cleanup
const TABLES_TO_BACKUP = [
  'user_sessions',
  'product_characteristics_simple',
  'variant_characteristics_simple',
  'media_files',
  'products',
  'product_tag_relations',
  'characteristics_values_simple'
];

async function createBackup() {
  console.log('🔐 Database Backup Script');
  console.log(`Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}`);
  console.log(`Backup timestamp: ${TIMESTAMP}`);
  console.log('='.repeat(60));

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
  }

  const backupFile = path.join(BACKUP_DIR, `cleanup-backup-${TIMESTAMP}.sql`);
  
  // Build pg_dump command
  const pgDumpCmd = [
    'pg_dump',
    `-h ${process.env.POSTGRESQL_HOST}`,
    `-p ${process.env.POSTGRESQL_PORT}`,
    `-U ${process.env.POSTGRESQL_USER}`,
    `-d ${process.env.POSTGRESQL_DBNAME}`,
    '--no-password',
    '--verbose',
    '--no-owner',
    '--no-acl',
    ...TABLES_TO_BACKUP.map(table => `-t ${table}`),
    `> "${backupFile}"`
  ].join(' ');

  console.log('\n📋 Backing up tables:');
  TABLES_TO_BACKUP.forEach(table => console.log(`   - ${table}`));
  
  console.log('\n🔄 Creating backup...');
  
  try {
    // Set PGPASSWORD environment variable for pg_dump
    const env = { ...process.env, PGPASSWORD: process.env.POSTGRESQL_PASSWORD };
    
    await execAsync(pgDumpCmd, { env, shell: true });
    
    // Check file size
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`\n✅ Backup created successfully!`);
    console.log(`   File: ${backupFile}`);
    console.log(`   Size: ${fileSizeMB} MB`);
    
    // Create a metadata file
    const metadataFile = path.join(BACKUP_DIR, `cleanup-backup-${TIMESTAMP}.json`);
    const metadata = {
      timestamp: new Date().toISOString(),
      database: {
        host: process.env.POSTGRESQL_HOST,
        port: process.env.POSTGRESQL_PORT,
        name: process.env.POSTGRESQL_DBNAME,
        user: process.env.POSTGRESQL_USER
      },
      tables: TABLES_TO_BACKUP,
      backupFile: path.basename(backupFile),
      fileSize: stats.size,
      fileSizeMB: parseFloat(fileSizeMB)
    };
    
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`   Metadata: ${metadataFile}`);
    
    // Create restore script
    const restoreScript = `#!/bin/bash
# Restore script for backup ${TIMESTAMP}
# Usage: bash restore-backup-${TIMESTAMP}.sh

echo "⚠️  WARNING: This will restore data from backup!"
echo "Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}"
echo "Backup file: ${path.basename(backupFile)}"
echo ""
read -p "Are you sure you want to proceed? (yes/no) " -n 3 -r
echo ""

if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]
then
    PGPASSWORD="${process.env.POSTGRESQL_PASSWORD}" psql \\
        -h ${process.env.POSTGRESQL_HOST} \\
        -p ${process.env.POSTGRESQL_PORT} \\
        -U ${process.env.POSTGRESQL_USER} \\
        -d ${process.env.POSTGRESQL_DBNAME} \\
        < "${path.basename(backupFile)}"
    
    echo "✅ Restore completed"
else
    echo "❌ Restore cancelled"
fi
`;
    
    const restoreScriptFile = path.join(BACKUP_DIR, `restore-backup-${TIMESTAMP}.sh`);
    fs.writeFileSync(restoreScriptFile, restoreScript);
    console.log(`   Restore script: ${restoreScriptFile}`);
    
    console.log('\n📌 Backup Summary:');
    console.log(`   - ${TABLES_TO_BACKUP.length} tables backed up`);
    console.log(`   - Backup size: ${fileSizeMB} MB`);
    console.log(`   - Location: ${BACKUP_DIR}`);
    console.log('\n✨ You can now safely run the cleanup script!');
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure PostgreSQL client tools are installed');
    console.error('   2. Check database connection settings in .env.local');
    console.error('   3. Ensure you have permissions to create backups');
    throw error;
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