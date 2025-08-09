// Database cleanup script for obsolete data
// WARNING: This script will permanently delete data. Always backup first!

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

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || DRY_RUN;

console.log(`🧹 Database Cleanup Script`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : '⚠️  LIVE - DATA WILL BE DELETED'}`);
console.log(`Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}`);
console.log('='.repeat(60));

async function cleanupData() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    const cleanupTasks = [
      // 1. Clean old user sessions (older than 30 days)
      {
        name: 'Old user sessions',
        query: `DELETE FROM user_sessions WHERE last_activity < NOW() - INTERVAL '30 days'`,
        countQuery: `SELECT COUNT(*) FROM user_sessions WHERE last_activity < NOW() - INTERVAL '30 days'`
      },
      
      // 2. Clean orphaned product characteristics (no matching product)
      {
        name: 'Orphaned product characteristics',
        query: `DELETE FROM product_characteristics_simple 
                WHERE product_id NOT IN (SELECT id FROM products)`,
        countQuery: `SELECT COUNT(*) FROM product_characteristics_simple 
                     WHERE product_id NOT IN (SELECT id FROM products)`
      },
      
      // 3. Clean orphaned variant characteristics (no matching variant)
      {
        name: 'Orphaned variant characteristics',
        query: `DELETE FROM variant_characteristics_simple 
                WHERE variant_id NOT IN (SELECT id FROM product_variants)`,
        countQuery: `SELECT COUNT(*) FROM variant_characteristics_simple 
                     WHERE variant_id NOT IN (SELECT id FROM product_variants)`
      },
      
      // 4. Clean orphaned media files (not referenced anywhere)
      // Note: Currently only checking single image fields, not JSONB arrays
      {
        name: 'Orphaned media files',
        query: `DELETE FROM media_files 
                WHERE s3_url NOT IN (
                  SELECT image_url FROM products WHERE image_url IS NOT NULL
                  UNION
                  SELECT primary_image_url FROM product_variants WHERE primary_image_url IS NOT NULL
                )`,
        countQuery: `SELECT COUNT(*) FROM media_files 
                     WHERE s3_url NOT IN (
                       SELECT image_url FROM products WHERE image_url IS NOT NULL
                       UNION
                       SELECT primary_image_url FROM product_variants WHERE primary_image_url IS NOT NULL
                     )`
      },
      
      
      // 6. Clean deleted products (is_deleted = true) older than 90 days
      {
        name: 'Old deleted products',
        query: `DELETE FROM products 
                WHERE is_deleted = true 
                AND updated_at < NOW() - INTERVAL '90 days'`,
        countQuery: `SELECT COUNT(*) FROM products 
                     WHERE is_deleted = true 
                     AND updated_at < NOW() - INTERVAL '90 days'`
      },
      
      // 7. Clean orphaned product tag relations
      {
        name: 'Orphaned product tag relations',
        query: `DELETE FROM product_tag_relations 
                WHERE product_id NOT IN (SELECT id FROM products)
                OR tag_id NOT IN (SELECT id FROM product_tags)`,
        countQuery: `SELECT COUNT(*) FROM product_tag_relations 
                     WHERE product_id NOT IN (SELECT id FROM products)
                     OR tag_id NOT IN (SELECT id FROM product_tags)`
      },
      
      // 8. Clean unused characteristic values (not referenced by any product/variant)
      {
        name: 'Unused characteristic values',
        query: `DELETE FROM characteristics_values_simple 
                WHERE id NOT IN (
                  SELECT DISTINCT value_id FROM product_characteristics_simple
                  UNION
                  SELECT DISTINCT value_id FROM variant_characteristics_simple
                )`,
        countQuery: `SELECT COUNT(*) FROM characteristics_values_simple 
                     WHERE id NOT IN (
                       SELECT DISTINCT value_id FROM product_characteristics_simple
                       UNION
                       SELECT DISTINCT value_id FROM variant_characteristics_simple
                     )`
      }
    ];
    
    // Identify potential legacy/backup tables
    const legacyTablesQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND (
        tablename LIKE '%_backup%'
        OR tablename LIKE '%_old%'
        OR tablename LIKE '%_temp%'
        OR tablename LIKE '%_test%'
        OR tablename LIKE '%_copy%'
        OR tablename LIKE '%_bak%'
      )
      ORDER BY tablename;
    `;
    
    console.log('\n📋 Checking for legacy/backup tables...');
    const legacyTablesResult = await client.query(legacyTablesQuery);
    
    if (legacyTablesResult.rows.length > 0) {
      console.log('\n⚠️  Found potential legacy/backup tables:');
      legacyTablesResult.rows.forEach(row => {
        console.log(`   - ${row.tablename}`);
      });
      console.log('\n   These tables should be reviewed manually before deletion.');
    } else {
      console.log('✅ No obvious legacy/backup tables found.');
    }
    
    // Execute cleanup tasks
    console.log('\n🔍 Analyzing data to clean...\n');
    
    let totalDeleted = 0;
    
    for (const task of cleanupTasks) {
      const countResult = await client.query(task.countQuery);
      const count = parseInt(countResult.rows[0].count);
      
      if (count > 0) {
        console.log(`📌 ${task.name}: ${count} records to delete`);
        
        if (!DRY_RUN) {
          const result = await client.query(task.query);
          totalDeleted += result.rowCount;
          console.log(`   ✅ Deleted ${result.rowCount} records`);
        }
      } else {
        if (VERBOSE) {
          console.log(`✅ ${task.name}: No records to delete`);
        }
      }
    }
    
    // Analyze database size before/after
    console.log('\n📊 Database statistics:');
    
    const sizeQuery = `SELECT pg_size_pretty(pg_database_size($1)) as size`;
    const sizeResult = await client.query(sizeQuery, [process.env.POSTGRESQL_DBNAME]);
    console.log(`   Database size: ${sizeResult.rows[0].size}`);
    
    // Get table sizes
    const tableSizesQuery = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) as raw_size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10;
    `;
    
    const tableSizesResult = await client.query(tableSizesQuery);
    console.log('\n   Top 10 largest tables:');
    tableSizesResult.rows.forEach(row => {
      console.log(`   - ${row.tablename}: ${row.size}`);
    });
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN COMPLETE - No data was actually deleted');
      console.log('   Run without --dry-run flag to perform actual cleanup');
      await client.query('ROLLBACK');
    } else {
      console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} total records.`);
      
      // VACUUM ANALYZE to reclaim space and update statistics
      console.log('\n🔧 Running VACUUM ANALYZE to optimize database...');
      await client.query('COMMIT');
      
      // VACUUM must be run outside transaction
      await client.query('VACUUM ANALYZE');
      console.log('✅ Database optimized');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Execute cleanup
cleanupData()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });