#!/usr/bin/env node

const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

// Database configuration (same as in the project)
const config = {
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || process.env.POSTGRESQL_HOST || "localhost",
  port: Number(process.env.DB_PORT || process.env.POSTGRESQL_PORT || 5432),
  user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
  password: process.env.DB_PASSWORD || process.env.POSTGRESQL_PASSWORD || "",
  database: process.env.DB_NAME || process.env.POSTGRESQL_DBNAME || "medsip_protez",
  ssl: (process.env.PGSSL === "true" || process.env.DATABASE_SSL === "true" || process.env.DATABASE_URL?.includes("sslmode=require")) ? { rejectUnauthorized: false } : undefined,
};

async function checkDatabaseState() {
  const pool = new Pool(config);
  
  try {
    console.log('🔍 CHECKING POSTGRESQL DATABASE STATE FOR MEDSIP-PROTEZ');
    console.log('=' .repeat(60));
    
    // 1. Connection details
    console.log('\n📊 DATABASE CONNECTION DETAILS:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   User: ${config.user}`);
    console.log(`   SSL: ${config.ssl ? 'Enabled' : 'Disabled'}`);
    
    // 2. Test connection
    console.log('\n🔗 TESTING CONNECTION...');
    const connectResult = await pool.query('SELECT version(), current_database(), current_user, now()');
    const dbInfo = connectResult.rows[0];
    console.log(`   ✅ PostgreSQL Version: ${dbInfo.version.split(' ')[1]}`);
    console.log(`   ✅ Connected to database: ${dbInfo.current_database}`);
    console.log(`   ✅ Connected as user: ${dbInfo.current_user}`);
    console.log(`   ✅ Current time: ${dbInfo.now}`);
    
    // 3. Database size
    console.log('\n📏 DATABASE SIZE:');
    const sizeResult = await pool.query(`
      SELECT 
        pg_database_size(current_database()) as db_size_bytes,
        pg_size_pretty(pg_database_size(current_database())) as db_size_pretty
    `);
    console.log(`   Database size: ${sizeResult.rows[0].db_size_pretty} (${sizeResult.rows[0].db_size_bytes} bytes)`);
    
    // 4. List all tables
    console.log('\n📋 TABLES IN DATABASE:');
    const tablesResult = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        tableowner,
        hasindexes,
        hasrules,
        hastriggers
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log(`   Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.tablename} (owner: ${table.tableowner})`);
    });
    
    // 5. Row counts for main tables
    console.log('\n🔢 ROW COUNTS FOR MAIN TABLES:');
    const tableNames = tablesResult.rows.map(row => row.tablename);
    
    for (const tableName of tableNames) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = parseInt(countResult.rows[0].count);
        console.log(`   ${tableName}: ${count.toLocaleString()} rows`);
      } catch (error) {
        console.log(`   ${tableName}: Error getting count - ${error.message}`);
      }
    }
    
    // 6. Database statistics
    console.log('\n📈 DATABASE STATISTICS:');
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public') as total_columns,
        (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = 'public') as total_constraints
    `);
    const stats = statsResult.rows[0];
    console.log(`   Total tables: ${stats.total_tables}`);
    console.log(`   Total columns: ${stats.total_columns}`);
    console.log(`   Total constraints: ${stats.total_constraints}`);
    
    // 7. Most active tables (by recent activity)
    console.log('\n🔥 TABLE ACTIVITY:');
    const activityResult = await pool.query(`
      SELECT 
        schemaname,
        relname as tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del
      FROM pg_stat_user_tables 
      ORDER BY (n_tup_ins + n_tup_upd + n_tup_del) DESC
      LIMIT 10
    `);
    
    if (activityResult.rows.length > 0) {
      console.log('   Top 10 most active tables:');
      activityResult.rows.forEach((table, index) => {
        const totalActivity = parseInt(table.n_tup_ins) + parseInt(table.n_tup_upd) + parseInt(table.n_tup_del);
        console.log(`   ${index + 1}. ${table.tablename} - ${totalActivity} total operations (${table.n_tup_ins} inserts, ${table.n_tup_upd} updates, ${table.n_tup_del} deletes)`);
      });
    } else {
      console.log('   No activity statistics available');
    }
    
    // 8. Index usage
    console.log('\n🗂️  INDEX USAGE:');
    const indexResult = await pool.query(`
      SELECT 
        schemaname,
        relname as tablename,
        indexrelname as indexname,
        idx_scan
      FROM pg_stat_user_indexes 
      ORDER BY idx_scan DESC
      LIMIT 10
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('   Top 10 most used indexes:');
      indexResult.rows.forEach((idx, index) => {
        console.log(`   ${index + 1}. ${idx.indexname} on ${idx.tablename} - ${idx.idx_scan} scans`);
      });
    } else {
      console.log('   No index usage statistics available');
    }
    
    console.log('\n✅ DATABASE STATE CHECK COMPLETED');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR CHECKING DATABASE STATE:');
    console.error(`   ${error.message}`);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Details: ${error.detail}`);
    }
  } finally {
    await pool.end();
  }
}

// Run the check
checkDatabaseState().catch(console.error);