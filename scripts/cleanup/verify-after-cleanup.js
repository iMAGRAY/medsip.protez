// Script to verify database integrity after cleanup
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

async function verifyDatabase() {
  console.log('🔍 Database Integrity Check After Cleanup');
  console.log(`Database: ${process.env.POSTGRESQL_DBNAME}@${process.env.POSTGRESQL_HOST}`);
  console.log('='.repeat(60));

  const client = await pool.connect();
  
  try {
    const checks = [];
    
    // 1. Check products integrity
    const productsCheck = await client.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_deleted = true THEN 1 END) as deleted_products,
        COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as products_with_images,
        COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as products_with_category
      FROM products
    `);
    checks.push({
      name: 'Products',
      data: productsCheck.rows[0]
    });
    
    // 2. Check variants integrity
    const variantsCheck = await client.query(`
      SELECT 
        COUNT(*) as total_variants,
        COUNT(CASE WHEN master_id NOT IN (SELECT id FROM products) THEN 1 END) as orphaned_variants,
        COUNT(CASE WHEN primary_image_url IS NOT NULL THEN 1 END) as variants_with_images
      FROM product_variants
    `);
    checks.push({
      name: 'Product Variants',
      data: variantsCheck.rows[0]
    });
    
    // 3. Check characteristics integrity
    const charCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM product_characteristics_simple) as product_chars,
        (SELECT COUNT(*) FROM variant_characteristics_simple) as variant_chars,
        (SELECT COUNT(*) FROM characteristics_values_simple) as char_values,
        (SELECT COUNT(*) FROM characteristics_groups_simple) as char_groups
    `);
    checks.push({
      name: 'Characteristics System',
      data: charCheck.rows[0]
    });
    
    // 4. Check media files integrity
    const mediaCheck = await client.query(`
      SELECT 
        COUNT(*) as total_media_files,
        COUNT(DISTINCT s3_url) as unique_urls,
        pg_size_pretty(SUM(file_size)) as total_size
      FROM media_files
    `);
    checks.push({
      name: 'Media Files',
      data: mediaCheck.rows[0]
    });
    
    // 5. Check orphaned references
    const orphanedCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM product_characteristics_simple WHERE product_id NOT IN (SELECT id FROM products)) as orphaned_product_chars,
        (SELECT COUNT(*) FROM variant_characteristics_simple WHERE variant_id NOT IN (SELECT id FROM product_variants)) as orphaned_variant_chars,
        (SELECT COUNT(*) FROM product_tag_relations WHERE product_id NOT IN (SELECT id FROM products)) as orphaned_tag_relations
    `);
    checks.push({
      name: 'Orphaned References',
      data: orphanedCheck.rows[0]
    });
    
    // 6. Check unused values after cleanup
    const unusedCheck = await client.query(`
      SELECT COUNT(*) as unused_char_values
      FROM characteristics_values_simple 
      WHERE id NOT IN (
        SELECT DISTINCT value_id FROM product_characteristics_simple
        UNION
        SELECT DISTINCT value_id FROM variant_characteristics_simple
      )
    `);
    checks.push({
      name: 'Unused Values After Cleanup',
      data: unusedCheck.rows[0]
    });
    
    // 7. Database size
    const sizeCheck = await client.query(`
      SELECT 
        pg_size_pretty(pg_database_size($1)) as database_size,
        (SELECT COUNT(*) FROM pg_stat_user_tables) as total_tables
    `, [process.env.POSTGRESQL_DBNAME]);
    checks.push({
      name: 'Database Size',
      data: sizeCheck.rows[0]
    });
    
    // Display results
    console.log('\n📊 Integrity Check Results:\n');
    
    let hasIssues = false;
    
    checks.forEach(check => {
      console.log(`\n${check.name}:`);
      Object.entries(check.data).forEach(([key, value]) => {
        const isError = (
          (key.includes('orphaned') && parseInt(value) > 0) ||
          (key === 'unused_char_values' && parseInt(value) > 0)
        );
        
        if (isError) {
          hasIssues = true;
          console.log(`   ❌ ${key}: ${value}`);
        } else {
          console.log(`   ✅ ${key}: ${value}`);
        }
      });
    });
    
    // Summary
    console.log('\n' + '='.repeat(60));
    if (hasIssues) {
      console.log('\n⚠️  Some integrity issues were found!');
      console.log('   Consider running the cleanup script again.');
    } else {
      console.log('\n✅ Database integrity check passed!');
      console.log('   All references are valid and no orphaned data found.');
    }
    
    // Performance check
    console.log('\n🚀 Performance Metrics:');
    const perfQuery = await client.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 0
      ORDER BY n_dead_tup DESC
      LIMIT 5
    `);
    
    if (perfQuery.rows.length > 0) {
      console.log('\n   Tables with dead tuples:');
      perfQuery.rows.forEach(row => {
        console.log(`   - ${row.tablename}: ${row.dead_tuples} dead tuples`);
      });
    } else {
      console.log('   No tables with dead tuples found (good!)');
    }
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Execute verification
verifyDatabase()
  .then(() => {
    console.log('\n✨ Verification completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  });