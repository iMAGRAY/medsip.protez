// Delete legacy tables that are safe to remove
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

// Only tables that are safe to delete (from analysis)
const TABLES_TO_DELETE = [
  'characteristics_consolidated_backup',
  'eav_backup_before_cleanup',
  'product_characteristics_new_backup_final'
];

// Tables that should NOT be deleted
const PROTECTED_TABLES = [
  'form_templates', // Used in the application
  'characteristic_templates' // Referenced by variant_characteristics
];

async function deleteLegacyTables() {
  console.log('🗑️  Legacy Tables Deletion Script');
  console.log(`Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}`);
  console.log('='.repeat(60));

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('\n⚠️  WARNING: This will permanently delete the following tables:');
    TABLES_TO_DELETE.forEach(table => console.log(`   - ${table}`));
    
    console.log('\n📌 These tables will be preserved:');
    PROTECTED_TABLES.forEach(table => console.log(`   - ${table} (required by application)`));
    
    console.log('\n🔄 Starting deletion process...\n');
    
    let totalDeleted = 0;
    let totalSizeFreed = 0;
    
    for (const tableName of TABLES_TO_DELETE) {
      try {
        // Get size before deletion
        const sizeQuery = `
          SELECT 
            pg_size_pretty(pg_total_relation_size($1::regclass)) as size_pretty,
            pg_total_relation_size($1::regclass) as size_bytes
        `;
        const sizeResult = await client.query(sizeQuery, [tableName]);
        const tableSize = sizeResult.rows[0].size_pretty;
        const tableSizeBytes = parseInt(sizeResult.rows[0].size_bytes);
        
        // Drop the table
        console.log(`🗑️  Deleting ${tableName} (${tableSize})...`);
        await client.query(`DROP TABLE ${tableName} CASCADE`);
        
        console.log(`   ✅ Deleted successfully`);
        totalDeleted++;
        totalSizeFreed += tableSizeBytes;
        
      } catch (error) {
        if (error.code === '42P01') {
          console.log(`   ℹ️  Table ${tableName} does not exist (already deleted?)`);
        } else {
          console.error(`   ❌ Error deleting ${tableName}:`, error.message);
          throw error;
        }
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Deletion complete!`);
    console.log(`   Tables deleted: ${totalDeleted}`);
    console.log(`   Space freed: ${(totalSizeFreed / 1024 / 1024).toFixed(2)} MB`);
    
    // Run VACUUM to reclaim space
    console.log('\n🔧 Running VACUUM to reclaim disk space...');
    await client.query('VACUUM');
    console.log('✅ Database optimized');
    
    // Get final database size
    const dbSizeQuery = `SELECT pg_size_pretty(pg_database_size($1)) as size`;
    const dbSizeResult = await client.query(dbSizeQuery, [process.env.POSTGRESQL_DBNAME]);
    console.log(`\n📊 Current database size: ${dbSizeResult.rows[0].size}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Deletion failed:', error.message);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Confirm before execution
console.log('⚠️  This script will DELETE legacy backup tables!');
console.log('   Make sure you have backed them up first.');
console.log('   Run: node scripts/cleanup/backup-legacy-tables.js\n');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to proceed with deletion? (yes/no): ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() === 'yes') {
    deleteLegacyTables()
      .then(() => {
        console.log('\n✨ Script completed successfully');
        process.exit(0);
      })
      .catch(error => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
      });
  } else {
    console.log('\n❌ Deletion cancelled');
    process.exit(0);
  }
});