/**
 * Migration Validator Utility
 * 
 * Utility для pre-migration анализа и post-migration валидации
 * Enhanced migration script для medsip.protez
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: 'database.env' });

class MigrationValidator {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 
        `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async validateDatabaseState() {
    console.log('🔍 Validating database state for migration...\n');

    const client = await this.pool.connect();
    try {
      const results = {
        tables: await this.checkTables(client),
        dataQuality: await this.checkDataQuality(client),
        constraints: await this.checkConstraints(client),
        indexes: await this.checkIndexes(client),
        conflicts: await this.checkPotentialConflicts(client)
      };

      this.printValidationReport(results);
      return results;

    } finally {
      client.release();
    }
  }

  async checkTables(client) {
    console.log('📋 Checking table structure...');

    const tableInfo = await client.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_name IN ('product_sizes', 'product_variants', 'products')
    `);

    const tables = {};
    for (const table of tableInfo.rows) {
      tables[table.table_name] = {
        exists: true,
        columnCount: parseInt(table.column_count)
      };

      // Get column details
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table.table_name]);

      tables[table.table_name].columns = columns.rows;
    }

    return tables;
  }

  async checkDataQuality(client) {
    console.log('🔍 Checking data quality...');

    const checks = {};

    // Check product_sizes data
    if (await this.tableExists(client, 'product_sizes')) {
      const sizesData = await client.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT product_id) as unique_products,
          COUNT(CASE WHEN sku IS NOT NULL AND sku != '' THEN 1 END) as records_with_sku,
          COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) as records_without_name,
          COUNT(CASE WHEN size_name IS NULL OR size_name = '' THEN 1 END) as records_without_size_name,
          COUNT(CASE WHEN price IS NULL THEN 1 END) as records_without_price
        FROM product_sizes
      `);

      checks.product_sizes = sizesData.rows[0];

      // Check for duplicate SKUs
      const duplicateSkus = await client.query(`
        SELECT sku, COUNT(*) as count
        FROM product_sizes 
        WHERE sku IS NOT NULL AND sku != ''
        GROUP BY sku 
        HAVING COUNT(*) > 1
      `);

      checks.product_sizes.duplicate_skus = duplicateSkus.rows.length;
    }

    // Check product_variants data
    if (await this.tableExists(client, 'product_variants')) {
      const variantsData = await client.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT master_id) as unique_products,
          COUNT(CASE WHEN sku IS NOT NULL AND sku != '' THEN 1 END) as records_with_sku,
          COUNT(CASE WHEN size_name IS NOT NULL THEN 1 END) as records_with_size_name,
          COUNT(CASE WHEN size_value IS NOT NULL THEN 1 END) as records_with_size_value,
          COUNT(CASE WHEN dimensions IS NOT NULL THEN 1 END) as records_with_dimensions
        FROM product_variants
      `);

      checks.product_variants = variantsData.rows[0];
    }

    return checks;
  }

  async checkConstraints(client) {
    console.log('🔗 Checking foreign key constraints...');

    const constraints = {};

    // Check orphaned product_sizes
    if (await this.tableExists(client, 'product_sizes')) {
      const orphanedSizes = await client.query(`
        SELECT COUNT(*) as count
        FROM product_sizes ps
        LEFT JOIN products p ON ps.product_id = p.id
        WHERE p.id IS NULL
      `);

      constraints.orphaned_sizes = parseInt(orphanedSizes.rows[0].count);
    }

    // Check orphaned product_variants
    if (await this.tableExists(client, 'product_variants')) {
      const orphanedVariants = await client.query(`
        SELECT COUNT(*) as count
        FROM product_variants pv
        LEFT JOIN products p ON pv.master_id = p.id
        WHERE p.id IS NULL
      `);

      constraints.orphaned_variants = parseInt(orphanedVariants.rows[0].count);
    }

    return constraints;
  }

  async checkIndexes(client) {
    console.log('📊 Checking database indexes...');

    const indexes = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('product_sizes', 'product_variants', 'products')
      ORDER BY tablename, indexname
    `);

    const indexesByTable = {};
    for (const index of indexes.rows) {
      if (!indexesByTable[index.tablename]) {
        indexesByTable[index.tablename] = [];
      }
      indexesByTable[index.tablename].push({
        name: index.indexname,
        definition: index.indexdef
      });
    }

    return indexesByTable;
  }

  async checkPotentialConflicts(client) {
    console.log('⚠️  Checking potential migration conflicts...');

    const conflicts = {};

    if (await this.tableExists(client, 'product_sizes') && 
        await this.tableExists(client, 'product_variants')) {
      
      // Check for SKU conflicts
      const skuConflicts = await client.query(`
        SELECT 
          ps.id as size_id,
          ps.sku,
          ps.product_id,
          pv.id as variant_id,
          pv.sku as variant_sku,
          pv.master_id
        FROM product_sizes ps
        INNER JOIN product_variants pv ON ps.product_id = pv.master_id
        WHERE ps.sku IS NOT NULL 
        AND ps.sku != '' 
        AND ps.sku = pv.sku
      `);

      conflicts.sku_conflicts = skuConflicts.rows;

      // Check for name conflicts
      const nameConflicts = await client.query(`
        SELECT 
          ps.id as size_id,
          ps.name as size_name,
          ps.product_id,
          pv.id as variant_id,
          pv.name as variant_name,
          pv.master_id
        FROM product_sizes ps
        INNER JOIN product_variants pv ON ps.product_id = pv.master_id
        WHERE ps.name IS NOT NULL 
        AND ps.name != '' 
        AND ps.name = pv.name
      `);

      conflicts.name_conflicts = nameConflicts.rows;
    }

    return conflicts;
  }

  async tableExists(client, tableName) {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);

    return result.rows[0].exists;
  }

  printValidationReport(results) {
    console.log('\n📊 VALIDATION REPORT:');
    console.log('='.repeat(50));

    // Tables
    console.log('\n📋 TABLES:');
    for (const [tableName, info] of Object.entries(results.tables)) {
      console.log(`  ✓ ${tableName}: ${info.columnCount} columns`);
    }

    // Data Quality
    console.log('\n🔍 DATA QUALITY:');
    if (results.dataQuality.product_sizes) {
      const sizes = results.dataQuality.product_sizes;
      console.log(`  📦 product_sizes:`);
      console.log(`     - Total records: ${sizes.total_records}`);
      console.log(`     - Unique products: ${sizes.unique_products}`);
      console.log(`     - Records with SKU: ${sizes.records_with_sku}`);
      console.log(`     - Records without name: ${sizes.records_without_name}`);
      console.log(`     - Records without size_name: ${sizes.records_without_size_name}`);
      console.log(`     - Duplicate SKUs: ${sizes.duplicate_skus}`);
    }

    if (results.dataQuality.product_variants) {
      const variants = results.dataQuality.product_variants;
      console.log(`  📦 product_variants:`);
      console.log(`     - Total records: ${variants.total_records}`);
      console.log(`     - Unique products: ${variants.unique_products}`);
      console.log(`     - Records with SKU: ${variants.records_with_sku}`);
      console.log(`     - Records with size_name: ${variants.records_with_size_name}`);
      console.log(`     - Records with size_value: ${variants.records_with_size_value}`);
    }

    // Constraints
    console.log('\n🔗 CONSTRAINTS:');
    console.log(`  - Orphaned sizes: ${results.constraints.orphaned_sizes || 0}`);
    console.log(`  - Orphaned variants: ${results.constraints.orphaned_variants || 0}`);

    // Conflicts
    console.log('\n⚠️  POTENTIAL CONFLICTS:');
    const skuConflicts = results.conflicts.sku_conflicts?.length || 0;
    const nameConflicts = results.conflicts.name_conflicts?.length || 0;
    console.log(`  - SKU conflicts: ${skuConflicts}`);
    console.log(`  - Name conflicts: ${nameConflicts}`);

    if (skuConflicts > 0 || nameConflicts > 0) {
      console.log('\n🚨 WARNING: Conflicts detected! Review these before migration.');
    }

    // Indexes
    console.log('\n📊 INDEXES:');
    for (const [tableName, indexes] of Object.entries(results.indexes)) {
      console.log(`  ${tableName}: ${indexes.length} indexes`);
    }

    console.log('\n' + '='.repeat(50));
  }

  async generateValidationReport() {
    const results = await this.validateDatabaseState();
    
    const reportFile = path.join(__dirname, '../../database/migration-backups', 
      `validation-report-${Date.now()}.json`);
    
    try {
      await fs.mkdir(path.dirname(reportFile), { recursive: true });
      await fs.writeFile(reportFile, JSON.stringify(results, null, 2), 'utf8');
      console.log(`\n📄 Validation report saved: ${reportFile}`);
    } catch (error) {
      console.error('Failed to save validation report:', error.message);
    }

    return results;
  }

  async close() {
    await this.pool.end();
  }
}

// CLI interface
async function runValidation() {
  const validator = new MigrationValidator();
  
  try {
    await validator.generateValidationReport();
  } catch (error) {
    console.error('Validation failed:', error.message);
    process.exit(1);
  } finally {
    await validator.close();
  }
}

module.exports = {
  MigrationValidator
};

// Direct execution
if (require.main === module) {
  runValidation();
}