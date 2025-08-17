/**
 * Migration Status Checker
 * 
 * Utility для проверки статуса миграции и сравнения данных
 * между product_sizes и product_variants
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: 'database.env' });

class MigrationStatusChecker {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 
        `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async checkMigrationStatus() {
    console.log('🔍 Checking migration status...\n');

    const client = await this.pool.connect();
    try {
      const status = {
        tablesExist: await this.checkTablesExistence(client),
        schemaDifferences: await this.checkSchemaDifferences(client),
        dataCounts: await this.checkDataCounts(client),
        migrationProgress: await this.checkMigrationProgress(client),
        dataIntegrity: await this.checkDataIntegrity(client),
        recommendations: []
      };

      this.generateRecommendations(status);
      this.printStatusReport(status);
      
      return status;

    } finally {
      client.release();
    }
  }

  async checkTablesExistence(client) {
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('product_sizes', 'product_variants')
    `);

    const existing = tables.rows.map(row => row.table_name);
    
    return {
      product_sizes: existing.includes('product_sizes'),
      product_variants: existing.includes('product_variants'),
      both_exist: existing.includes('product_sizes') && existing.includes('product_variants')
    };
  }

  async checkSchemaDifferences(client) {
    const differences = {};

    // Check if product_variants has enhanced columns
    const variantColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'product_variants'
      AND column_name IN ('size_name', 'size_value', 'dimensions', 'specifications')
    `);

    differences.enhanced_columns = variantColumns.rows.map(row => row.column_name);
    differences.has_all_enhanced = differences.enhanced_columns.length === 4;

    // Check for migration-specific indexes
    const indexes = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'product_variants'
      AND indexname LIKE '%size%' OR indexname LIKE '%dimensions%' OR indexname LIKE '%specifications%'
    `);

    differences.migration_indexes = indexes.rows.map(row => row.indexname);

    return differences;
  }

  async checkDataCounts(client) {
    const counts = {};

    // Count product_sizes if exists
    try {
      const sizesCount = await client.query('SELECT COUNT(*) FROM product_sizes');
      counts.product_sizes = parseInt(sizesCount.rows[0].count);
    } catch (error) {
      counts.product_sizes = 0;
    }

    // Count product_variants
    try {
      const variantsCount = await client.query('SELECT COUNT(*) FROM product_variants');
      counts.product_variants_total = parseInt(variantsCount.rows[0].count);

      // Count migrated variants (those with size_name or size_value)
      const migratedCount = await client.query(`
        SELECT COUNT(*) FROM product_variants 
        WHERE size_name IS NOT NULL OR size_value IS NOT NULL
      `);
      counts.product_variants_migrated = parseInt(migratedCount.rows[0].count);
      
      // Count original variants (without size fields)
      counts.product_variants_original = counts.product_variants_total - counts.product_variants_migrated;

    } catch (error) {
      counts.product_variants_total = 0;
      counts.product_variants_migrated = 0;
      counts.product_variants_original = 0;
    }

    return counts;
  }

  async checkMigrationProgress(client) {
    const progress = {};

    try {
      // Check if any sizes remain unmigrated
      const unmigrated = await client.query(`
        SELECT COUNT(*) as unmigrated_count
        FROM product_sizes ps
        WHERE NOT EXISTS (
          SELECT 1 FROM product_variants pv 
          WHERE pv.master_id = ps.product_id 
          AND (
            (ps.sku IS NOT NULL AND pv.sku = ps.sku) OR
            (ps.sku IS NULL AND pv.name = COALESCE(ps.name, ps.size_name, 'Без названия'))
          )
        )
      `);

      progress.unmigrated_sizes = parseInt(unmigrated.rows[0].unmigrated_count);

      // Check migration completion percentage
      if (progress.unmigrated_sizes === 0) {
        progress.completion_percentage = 100;
        progress.status = 'COMPLETED';
      } else {
        const totalSizes = await client.query('SELECT COUNT(*) FROM product_sizes');
        const total = parseInt(totalSizes.rows[0].count);
        progress.completion_percentage = total > 0 ? 
          Math.round(((total - progress.unmigrated_sizes) / total) * 100) : 0;
        progress.status = 'PARTIAL';
      }

      // Check for potential issues
      const duplicateSkus = await client.query(`
        SELECT COUNT(*) as dup_count FROM (
          SELECT sku FROM product_variants 
          WHERE sku IS NOT NULL AND sku != ''
          GROUP BY sku HAVING COUNT(*) > 1
        ) dups
      `);

      progress.duplicate_skus = parseInt(duplicateSkus.rows[0].dup_count);

    } catch (error) {
      progress.status = 'ERROR';
      progress.error = error.message;
    }

    return progress;
  }

  async checkDataIntegrity(client) {
    const integrity = {};

    try {
      // Check for orphaned variants
      const orphanedVariants = await client.query(`
        SELECT COUNT(*) as count
        FROM product_variants pv
        LEFT JOIN products p ON pv.master_id = p.id
        WHERE p.id IS NULL
      `);

      integrity.orphaned_variants = parseInt(orphanedVariants.rows[0].count);

      // Check for missing characteristics
      const variantsWithoutChars = await client.query(`
        SELECT COUNT(*) as count
        FROM product_variants pv
        WHERE pv.size_name IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM variant_characteristics_simple vcs 
          WHERE vcs.variant_id = pv.id
        )
      `);

      integrity.variants_without_characteristics = parseInt(variantsWithoutChars.rows[0].count);

      // Check for data consistency
      const inconsistentData = await client.query(`
        SELECT COUNT(*) as count
        FROM product_variants 
        WHERE (size_name IS NOT NULL OR size_value IS NOT NULL)
        AND (name IS NULL OR name = '')
      `);

      integrity.inconsistent_data = parseInt(inconsistentData.rows[0].count);

      integrity.overall_status = 
        (integrity.orphaned_variants === 0 && 
         integrity.inconsistent_data === 0) ? 'GOOD' : 'ISSUES_FOUND';

    } catch (error) {
      integrity.overall_status = 'ERROR';
      integrity.error = error.message;
    }

    return integrity;
  }

  generateRecommendations(status) {
    const recommendations = [];

    // Table existence recommendations
    if (!status.tablesExist.product_variants) {
      recommendations.push({
        priority: 'CRITICAL',
        message: 'product_variants table does not exist. Create it before migration.'
      });
    }

    if (!status.tablesExist.product_sizes) {
      recommendations.push({
        priority: 'INFO',
        message: 'product_sizes table does not exist. Migration may already be completed.'
      });
    }

    // Schema recommendations
    if (!status.schemaDifferences.has_all_enhanced) {
      recommendations.push({
        priority: 'HIGH',
        message: 'Enhanced columns missing. Run schema enhancement before migration.'
      });
    }

    // Migration progress recommendations
    if (status.migrationProgress.status === 'PARTIAL') {
      recommendations.push({
        priority: 'MEDIUM',
        message: `Migration is ${status.migrationProgress.completion_percentage}% complete. ${status.migrationProgress.unmigrated_sizes} sizes remaining.`
      });
    }

    if (status.migrationProgress.duplicate_skus > 0) {
      recommendations.push({
        priority: 'HIGH',
        message: `${status.migrationProgress.duplicate_skus} duplicate SKUs found. Review and clean up.`
      });
    }

    // Data integrity recommendations
    if (status.dataIntegrity.orphaned_variants > 0) {
      recommendations.push({
        priority: 'HIGH',
        message: `${status.dataIntegrity.orphaned_variants} orphaned variants found. Clean up foreign key violations.`
      });
    }

    if (status.dataIntegrity.inconsistent_data > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        message: `${status.dataIntegrity.inconsistent_data} variants have inconsistent data. Review and fix.`
      });
    }

    // Post-migration recommendations
    if (status.migrationProgress.status === 'COMPLETED' && status.tablesExist.product_sizes) {
      recommendations.push({
        priority: 'LOW',
        message: 'Migration completed. Consider dropping product_sizes table after testing.'
      });
    }

    status.recommendations = recommendations;
  }

  printStatusReport(status) {
    console.log('📊 MIGRATION STATUS REPORT');
    console.log('='.repeat(50));

    // Tables existence
    console.log('\n📋 TABLES:');
    console.log(`  product_sizes: ${status.tablesExist.product_sizes ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  product_variants: ${status.tablesExist.product_variants ? '✅ EXISTS' : '❌ MISSING'}`);

    // Schema enhancements
    console.log('\n🔧 SCHEMA ENHANCEMENTS:');
    console.log(`  Enhanced columns: ${status.schemaDifferences.enhanced_columns.length}/4`);
    console.log(`  Columns: [${status.schemaDifferences.enhanced_columns.join(', ')}]`);
    console.log(`  Migration indexes: ${status.schemaDifferences.migration_indexes.length}`);

    // Data counts
    console.log('\n📊 DATA COUNTS:');
    console.log(`  product_sizes: ${status.dataCounts.product_sizes.toLocaleString()}`);
    console.log(`  product_variants (total): ${status.dataCounts.product_variants_total.toLocaleString()}`);
    console.log(`  product_variants (migrated): ${status.dataCounts.product_variants_migrated.toLocaleString()}`);
    console.log(`  product_variants (original): ${status.dataCounts.product_variants_original.toLocaleString()}`);

    // Migration progress
    console.log('\n🚀 MIGRATION PROGRESS:');
    console.log(`  Status: ${status.migrationProgress.status}`);
    if (status.migrationProgress.completion_percentage !== undefined) {
      console.log(`  Completion: ${status.migrationProgress.completion_percentage}%`);
    }
    if (status.migrationProgress.unmigrated_sizes > 0) {
      console.log(`  Unmigrated sizes: ${status.migrationProgress.unmigrated_sizes}`);
    }
    if (status.migrationProgress.duplicate_skus > 0) {
      console.log(`  Duplicate SKUs: ${status.migrationProgress.duplicate_skus}`);
    }

    // Data integrity
    console.log('\n🔍 DATA INTEGRITY:');
    console.log(`  Overall status: ${status.dataIntegrity.overall_status}`);
    console.log(`  Orphaned variants: ${status.dataIntegrity.orphaned_variants}`);
    console.log(`  Variants without characteristics: ${status.dataIntegrity.variants_without_characteristics}`);
    console.log(`  Inconsistent data: ${status.dataIntegrity.inconsistent_data}`);

    // Recommendations
    if (status.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      status.recommendations.forEach((rec, index) => {
        const icon = rec.priority === 'CRITICAL' ? '🚨' : 
                    rec.priority === 'HIGH' ? '⚠️' : 
                    rec.priority === 'MEDIUM' ? '📝' : 'ℹ️';
        console.log(`  ${icon} [${rec.priority}] ${rec.message}`);
      });
    }

    console.log('\n' + '='.repeat(50));
  }

  async generateStatusReport() {
    const status = await this.checkMigrationStatus();
    
    const reportFile = path.join(__dirname, '../../database/migration-backups', 
      `status-report-${Date.now()}.json`);
    
    try {
      await fs.mkdir(path.dirname(reportFile), { recursive: true });
      await fs.writeFile(reportFile, JSON.stringify(status, null, 2), 'utf8');
      console.log(`\n📄 Status report saved: ${reportFile}`);
    } catch (error) {
      console.error('Failed to save status report:', error.message);
    }

    return status;
  }

  async compareDataSample() {
    console.log('\n🔍 Comparing data samples...\n');

    const client = await this.pool.connect();
    try {
      // Get sample from product_sizes
      const sizeSample = await client.query(`
        SELECT id, product_id, name, size_name, sku, price 
        FROM product_sizes 
        LIMIT 5
      `);

      // Get corresponding variants
      for (const size of sizeSample.rows) {
        console.log(`📦 Size ID ${size.id} (Product ${size.product_id}):`);
        console.log(`   Original: ${size.name || size.size_name} | SKU: ${size.sku || 'none'}`);

        const variant = await client.query(`
          SELECT id, name, sku, size_name, size_value
          FROM product_variants 
          WHERE master_id = $1 
          AND (
            (sku IS NOT NULL AND sku = $2) OR
            (sku IS NULL AND name = $3)
          )
          LIMIT 1
        `, [size.product_id, size.sku, size.name || size.size_name]);

        if (variant.rows.length > 0) {
          const v = variant.rows[0];
          console.log(`   Migrated: ${v.name} | SKU: ${v.sku || 'none'} | Size: ${v.size_name || 'none'} ✅`);
        } else {
          console.log(`   NOT FOUND in variants ❌`);
        }
        console.log('');
      }

    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

// CLI interface
async function runStatusCheck() {
  const checker = new MigrationStatusChecker();
  
  try {
    await checker.generateStatusReport();
    await checker.compareDataSample();
  } catch (error) {
    console.error('Status check failed:', error.message);
    process.exit(1);
  } finally {
    await checker.close();
  }
}

module.exports = {
  MigrationStatusChecker
};

// Direct execution
if (require.main === module) {
  runStatusCheck();
}