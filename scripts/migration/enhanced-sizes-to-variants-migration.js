/**
 * Enhanced Migration Script: product_sizes → product_variants
 * 
 * Унифицированная миграция с comprehensive error handling, validation,
 * rollback procedures и performance tracking
 * 
 * Features:
 * - Pre-migration validation
 * - Post-migration verification
 * - Comprehensive error handling
 * - Rollback procedures
 * - Performance tracking
 * - Backup strategy
 * - Progress reporting
 * - Schema enhancement
 * - Data integrity checks
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: 'database.env' });

class EnhancedMigrationRunner {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 
        `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    this.migrationId = `migration_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.backupDir = path.join(__dirname, '../../database/migration-backups');
    this.logFile = path.join(this.backupDir, `${this.migrationId}.log`);
    
    this.stats = {
      startTime: null,
      endTime: null,
      totalProcessed: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      validationErrors: 0,
      performance: {
        preValidationTime: 0,
        schemaEnhancementTime: 0,
        migrationTime: 0,
        postVerificationTime: 0,
        backupTime: 0
      }
    };

    this.rollbackData = {
      backupCreated: false,
      schemaChanges: [],
      migratedRecords: [],
      errors: []
    };
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    console.log(`[${level}] ${message}`);
    
    try {
      await fs.appendFile(this.logFile, logEntry, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await this.log(`📁 Backup directory ensured: ${this.backupDir}`);
    } catch (error) {
      throw new Error(`Failed to create backup directory: ${error.message}`);
    }
  }

  async createBackup() {
    const startTime = Date.now();
    await this.log('💾 Starting database backup...');

    try {
      const client = await this.pool.connect();
      
      // Backup product_sizes table
      const sizesBackup = await client.query(`
        SELECT json_agg(row_to_json(product_sizes.*)) as data
        FROM product_sizes
      `);

      // Backup existing product_variants for rollback
      const variantsBackup = await client.query(`
        SELECT json_agg(row_to_json(product_variants.*)) as data
        FROM product_variants
      `);

      const backupData = {
        migrationId: this.migrationId,
        timestamp: new Date().toISOString(),
        product_sizes: sizesBackup.rows[0]?.data || [],
        product_variants_before: variantsBackup.rows[0]?.data || [],
        schema_version: await this.getSchemaVersion(client)
      };

      const backupFile = path.join(this.backupDir, `${this.migrationId}_backup.json`);
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf8');

      client.release();
      
      this.rollbackData.backupCreated = true;
      this.stats.performance.backupTime = Date.now() - startTime;
      
      await this.log(`✅ Backup created: ${backupFile}`);
      return backupFile;
    } catch (error) {
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  async getSchemaVersion(client) {
    try {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name IN ('product_sizes', 'product_variants')
        ORDER BY table_name, ordinal_position
      `);
      return result.rows;
    } catch (error) {
      return null;
    }
  }

  async preValidation() {
    const startTime = Date.now();
    await this.log('🔍 Starting pre-migration validation...');

    const client = await this.pool.connect();
    try {
      // Check table existence
      const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('product_sizes', 'product_variants')
      `);

      const existingTables = tableCheck.rows.map(row => row.table_name);
      
      if (!existingTables.includes('product_sizes')) {
        throw new Error('❌ Source table product_sizes does not exist');
      }

      if (!existingTables.includes('product_variants')) {
        throw new Error('❌ Target table product_variants does not exist');
      }

      // Check for foreign key constraints
      await this.validateForeignKeyConstraints(client);

      // Check data quality
      await this.validateDataQuality(client);

      // Check for potential conflicts
      await this.validatePotentialConflicts(client);

      await this.log('✅ Pre-migration validation completed successfully');
      
    } catch (error) {
      this.stats.validationErrors++;
      throw error;
    } finally {
      client.release();
      this.stats.performance.preValidationTime = Date.now() - startTime;
    }
  }

  async validateForeignKeyConstraints(client) {
    // Check if all product_ids in product_sizes exist in products table
    const orphanedRecords = await client.query(`
      SELECT ps.id, ps.product_id 
      FROM product_sizes ps
      LEFT JOIN products p ON ps.product_id = p.id
      WHERE p.id IS NULL
    `);

    if (orphanedRecords.rows.length > 0) {
      await this.log(`⚠️  Warning: Found ${orphanedRecords.rows.length} orphaned records in product_sizes`, 'WARN');
      for (const record of orphanedRecords.rows) {
        await this.log(`   - Size ID ${record.id} references non-existent product ${record.product_id}`, 'WARN');
      }
    }
  }

  async validateDataQuality(client) {
    // Check for duplicate SKUs
    const duplicateSkus = await client.query(`
      SELECT sku, COUNT(*) as count
      FROM product_sizes 
      WHERE sku IS NOT NULL AND sku != ''
      GROUP BY sku 
      HAVING COUNT(*) > 1
    `);

    if (duplicateSkus.rows.length > 0) {
      await this.log(`⚠️  Warning: Found ${duplicateSkus.rows.length} duplicate SKUs in product_sizes`, 'WARN');
      for (const dup of duplicateSkus.rows) {
        await this.log(`   - SKU "${dup.sku}" appears ${dup.count} times`, 'WARN');
      }
    }

    // Check for records without names
    const unnamedRecords = await client.query(`
      SELECT COUNT(*) as count
      FROM product_sizes 
      WHERE (name IS NULL OR name = '') 
      AND (size_name IS NULL OR size_name = '')
    `);

    if (unnamedRecords.rows[0].count > 0) {
      await this.log(`⚠️  Warning: Found ${unnamedRecords.rows[0].count} records without names`, 'WARN');
    }
  }

  async validatePotentialConflicts(client) {
    // Check for existing variants that might conflict
    const potentialConflicts = await client.query(`
      SELECT ps.id as size_id, ps.sku, ps.product_id,
             pv.id as variant_id, pv.sku as variant_sku
      FROM product_sizes ps
      INNER JOIN product_variants pv ON ps.product_id = pv.master_id
      WHERE (ps.sku IS NOT NULL AND ps.sku = pv.sku)
         OR (ps.sku IS NULL AND ps.name = pv.name)
    `);

    if (potentialConflicts.rows.length > 0) {
      await this.log(`⚠️  Warning: Found ${potentialConflicts.rows.length} potential conflicts`, 'WARN');
      this.stats.skipped = potentialConflicts.rows.length;
    }
  }

  async enhanceSchema() {
    const startTime = Date.now();
    await this.log('🔧 Enhancing product_variants schema...');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const schemaEnhancements = [
        'ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS size_name VARCHAR(100)',
        'ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS size_value VARCHAR(100)',
        'ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS dimensions JSONB',
        'ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS specifications JSONB',
        'CREATE INDEX IF NOT EXISTS idx_product_variants_size_name ON product_variants(size_name)',
        'CREATE INDEX IF NOT EXISTS idx_product_variants_size_value ON product_variants(size_value)',
        'CREATE INDEX IF NOT EXISTS idx_product_variants_dimensions ON product_variants USING GIN(dimensions)',
        'CREATE INDEX IF NOT EXISTS idx_product_variants_specifications ON product_variants USING GIN(specifications)'
      ];

      for (const sql of schemaEnhancements) {
        await client.query(sql);
        this.rollbackData.schemaChanges.push(sql);
        await this.log(`  ✓ ${sql.split(' ').slice(0, 6).join(' ')}...`);
      }

      await client.query('COMMIT');
      await this.log('✅ Schema enhancement completed');

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Schema enhancement failed: ${error.message}`);
    } finally {
      client.release();
      this.stats.performance.schemaEnhancementTime = Date.now() - startTime;
    }
  }

  async performMigration() {
    const startTime = Date.now();
    await this.log('🚀 Starting data migration...');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get all records from product_sizes with error handling
      const sizesResult = await client.query(`
        SELECT * FROM product_sizes 
        ORDER BY product_id, id
      `);

      this.stats.totalProcessed = sizesResult.rows.length;
      await this.log(`📊 Found ${this.stats.totalProcessed} records to migrate`);

      const batchSize = 100;
      const batches = Math.ceil(sizesResult.rows.length / batchSize);

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, sizesResult.rows.length);
        const batch = sizesResult.rows.slice(startIdx, endIdx);

        await this.log(`📦 Processing batch ${batchIndex + 1}/${batches} (${batch.length} records)`);

        for (const size of batch) {
          try {
            await this.migrateRecord(client, size);
          } catch (error) {
            await this.log(`❌ Error migrating record ${size.id}: ${error.message}`, 'ERROR');
            this.stats.errors++;
            this.rollbackData.errors.push({
              recordId: size.id,
              error: error.message,
              data: size
            });
          }
        }

        // Progress reporting
        const progress = ((batchIndex + 1) / batches * 100).toFixed(1);
        await this.log(`📈 Progress: ${progress}% (${endIdx}/${this.stats.totalProcessed})`);
      }

      await client.query('COMMIT');
      await this.log('✅ Data migration completed');

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed: ${error.message}`);
    } finally {
      client.release();
      this.stats.performance.migrationTime = Date.now() - startTime;
    }
  }

  async migrateRecord(client, size) {
    // Check for existing variant
    const existingCheck = await client.query(`
      SELECT id FROM product_variants 
      WHERE master_id = $1 AND (
        (sku IS NOT NULL AND sku = $2) OR 
        (sku IS NULL AND name = $3)
      )
    `, [size.product_id, size.sku, size.name || size.size_name || 'Без названия']);

    if (existingCheck.rows.length > 0) {
      await this.log(`⏭️  Skipped: variant for product ${size.product_id} already exists`);
      this.stats.skipped++;
      return;
    }

    // Prepare migration data with enhanced fields
    const variantData = {
      master_id: size.product_id,
      name: size.name || size.size_name || 'Без названия',
      sku: size.sku,
      description: size.description,
      price: size.price,
      discount_price: size.discount_price,
      stock_quantity: size.stock_quantity || 0,
      weight: size.weight,
      primary_image_url: size.image_url,
      images: size.images || [],
      is_featured: size.is_featured || false,
      is_new: size.is_new || false,
      is_bestseller: size.is_bestseller || false,
      is_active: size.is_available !== false,
      sort_order: size.sort_order || 0,
      warranty_months: size.warranty ? parseInt(size.warranty) : null,
      battery_life_hours: size.battery_life ? parseInt(size.battery_life) : null,
      meta_title: size.meta_title,
      meta_description: size.meta_description,
      meta_keywords: size.meta_keywords,
      custom_fields: size.custom_fields || {},
      attributes: {
        ...size.specifications,
        size_name: size.size_name,
        size_value: size.size_value,
        dimensions: size.dimensions
      },
      // Enhanced fields
      size_name: size.size_name,
      size_value: size.size_value,
      dimensions: size.dimensions,
      specifications: size.specifications
    };

    // Generate unique slug
    const slug = await this.generateUniqueSlug(client, variantData.name);

    // Insert into product_variants
    const insertResult = await client.query(`
      INSERT INTO product_variants (
        master_id, name, slug, sku, description,
        price, discount_price, stock_quantity, weight,
        primary_image_url, images, is_featured, is_new, is_bestseller,
        is_active, sort_order, warranty_months, battery_life_hours,
        meta_title, meta_description, meta_keywords,
        custom_fields, attributes, size_name, size_value, dimensions, specifications
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) RETURNING id
    `, [
      variantData.master_id, variantData.name, slug, variantData.sku, variantData.description,
      variantData.price, variantData.discount_price, variantData.stock_quantity, variantData.weight,
      variantData.primary_image_url, JSON.stringify(variantData.images), variantData.is_featured,
      variantData.is_new, variantData.is_bestseller, variantData.is_active, variantData.sort_order,
      variantData.warranty_months, variantData.battery_life_hours, variantData.meta_title,
      variantData.meta_description, variantData.meta_keywords, JSON.stringify(variantData.custom_fields),
      JSON.stringify(variantData.attributes), variantData.size_name, variantData.size_value,
      JSON.stringify(variantData.dimensions), JSON.stringify(variantData.specifications)
    ]);

    const newVariantId = insertResult.rows[0].id;
    this.rollbackData.migratedRecords.push(newVariantId);

    // Migrate characteristics if they exist
    await this.migrateCharacteristics(client, size, newVariantId);

    await this.log(`✅ Migrated: ${variantData.name} (SKU: ${variantData.sku || 'none'}) → ID: ${newVariantId}`);
    this.stats.migrated++;
  }

  async migrateCharacteristics(client, size, variantId) {
    if (!size.characteristics || typeof size.characteristics !== 'object') {
      return;
    }

    const characteristics = Array.isArray(size.characteristics) 
      ? size.characteristics 
      : Object.values(size.characteristics);

    for (const char of characteristics) {
      if (char.value_id) {
        try {
          await client.query(`
            INSERT INTO variant_characteristics_simple (variant_id, value_id, additional_value)
            VALUES ($1, $2, $3)
            ON CONFLICT (variant_id, value_id) DO NOTHING
          `, [variantId, char.value_id, char.additional_value || null]);
        } catch (charError) {
          await this.log(`⚠️  Warning: Failed to migrate characteristic for variant ${variantId}: ${charError.message}`, 'WARN');
        }
      }
    }
  }

  async generateUniqueSlug(client, name) {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await client.query(
        'SELECT id FROM product_variants WHERE slug = $1',
        [slug]
      );

      if (existing.rows.length === 0) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  async postVerification() {
    const startTime = Date.now();
    await this.log('🔍 Starting post-migration verification...');

    const client = await this.pool.connect();
    try {
      // Verify migration counts
      const [sizesCount, variantsCount, migratedCount] = await Promise.all([
        client.query('SELECT COUNT(*) FROM product_sizes'),
        client.query('SELECT COUNT(*) FROM product_variants'),
        client.query(`
          SELECT COUNT(*) FROM product_variants 
          WHERE size_name IS NOT NULL OR size_value IS NOT NULL
        `)
      ]);

      await this.log(`📊 Verification counts:`);
      await this.log(`   - Original product_sizes: ${sizesCount.rows[0].count}`);
      await this.log(`   - Total product_variants: ${variantsCount.rows[0].count}`);
      await this.log(`   - Migrated variants: ${migratedCount.rows[0].count}`);

      // Check data integrity
      await this.verifyDataIntegrity(client);

      // Check foreign key constraints
      await this.verifyForeignKeys(client);

      await this.log('✅ Post-migration verification completed successfully');

    } catch (error) {
      throw new Error(`Post-migration verification failed: ${error.message}`);
    } finally {
      client.release();
      this.stats.performance.postVerificationTime = Date.now() - startTime;
    }
  }

  async verifyDataIntegrity(client) {
    // Check for any null required fields
    const nullChecks = await client.query(`
      SELECT COUNT(*) as count FROM product_variants 
      WHERE master_id IS NULL OR name IS NULL OR name = ''
    `);

    if (nullChecks.rows[0].count > 0) {
      throw new Error(`Data integrity violation: ${nullChecks.rows[0].count} variants with missing required fields`);
    }

    // Verify no duplicate SKUs
    const duplicateSkus = await client.query(`
      SELECT sku, COUNT(*) as count FROM product_variants 
      WHERE sku IS NOT NULL AND sku != ''
      GROUP BY sku HAVING COUNT(*) > 1
    `);

    if (duplicateSkus.rows.length > 0) {
      await this.log(`⚠️  Warning: Found ${duplicateSkus.rows.length} duplicate SKUs in product_variants after migration`, 'WARN');
    }
  }

  async verifyForeignKeys(client) {
    const orphanedVariants = await client.query(`
      SELECT pv.id, pv.master_id 
      FROM product_variants pv
      LEFT JOIN products p ON pv.master_id = p.id
      WHERE p.id IS NULL
    `);

    if (orphanedVariants.rows.length > 0) {
      throw new Error(`Foreign key violation: ${orphanedVariants.rows.length} variants reference non-existent products`);
    }
  }

  async generateReport() {
    const report = {
      migrationId: this.migrationId,
      timestamp: new Date().toISOString(),
      duration: this.stats.endTime - this.stats.startTime,
      statistics: this.stats,
      rollbackData: {
        backupCreated: this.rollbackData.backupCreated,
        schemaChangesCount: this.rollbackData.schemaChanges.length,
        migratedRecordsCount: this.rollbackData.migratedRecords.length,
        errorsCount: this.rollbackData.errors.length
      },
      recommendations: this.generateRecommendations()
    };

    const reportFile = path.join(this.backupDir, `${this.migrationId}_report.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');

    // Console report
    await this.log('\n📊 MIGRATION REPORT:');
    await this.log(`🆔 Migration ID: ${this.migrationId}`);
    await this.log(`⏱️  Duration: ${(report.duration / 1000).toFixed(2)}s`);
    await this.log(`📋 Total processed: ${this.stats.totalProcessed}`);
    await this.log(`✅ Successfully migrated: ${this.stats.migrated}`);
    await this.log(`⏭️  Skipped (existing): ${this.stats.skipped}`);
    await this.log(`❌ Errors: ${this.stats.errors}`);
    await this.log(`⚠️  Validation errors: ${this.stats.validationErrors}`);
    
    await this.log('\n⏱️  Performance breakdown:');
    await this.log(`   - Backup: ${(this.stats.performance.backupTime / 1000).toFixed(2)}s`);
    await this.log(`   - Pre-validation: ${(this.stats.performance.preValidationTime / 1000).toFixed(2)}s`);
    await this.log(`   - Schema enhancement: ${(this.stats.performance.schemaEnhancementTime / 1000).toFixed(2)}s`);
    await this.log(`   - Migration: ${(this.stats.performance.migrationTime / 1000).toFixed(2)}s`);
    await this.log(`   - Post-verification: ${(this.stats.performance.postVerificationTime / 1000).toFixed(2)}s`);
    
    await this.log(`\n📄 Report saved: ${reportFile}`);
    
    return reportFile;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.stats.migrated > 0) {
      recommendations.push('✅ Review migrated data in product_variants table');
      recommendations.push('✅ Update API endpoints to use product_variants instead of product_sizes');
      recommendations.push('✅ Update frontend code to work with new schema');
    }

    if (this.stats.errors > 0) {
      recommendations.push('⚠️  Review error logs and fix data issues');
      recommendations.push('⚠️  Consider re-running migration for failed records');
    }

    if (this.stats.skipped > 0) {
      recommendations.push('🔍 Review skipped records for potential duplicates');
    }

    if (this.stats.migrated === this.stats.totalProcessed - this.stats.skipped) {
      recommendations.push('🗑️  Consider dropping product_sizes table after thorough testing');
    }

    recommendations.push('🧪 Run comprehensive tests before deploying to production');
    recommendations.push('📊 Monitor performance after deployment');

    return recommendations;
  }

  async rollback() {
    await this.log('🔄 Starting rollback procedure...');

    if (!this.rollbackData.backupCreated) {
      throw new Error('Cannot rollback: no backup was created');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Remove migrated records
      if (this.rollbackData.migratedRecords.length > 0) {
        await client.query(
          'DELETE FROM product_variants WHERE id = ANY($1)',
          [this.rollbackData.migratedRecords]
        );
        await this.log(`🗑️  Removed ${this.rollbackData.migratedRecords.length} migrated records`);
      }

      // Note: Schema changes are kept intentionally for safety
      // They can be manually reverted if needed

      await client.query('COMMIT');
      await this.log('✅ Rollback completed successfully');

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Rollback failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async run() {
    this.stats.startTime = Date.now();
    
    try {
      await this.log(`🚀 Starting Enhanced Migration: ${this.migrationId}`);
      await this.ensureBackupDirectory();
      
      // Step 1: Create backup
      await this.createBackup();
      
      // Step 2: Pre-migration validation
      await this.preValidation();
      
      // Step 3: Enhance schema
      await this.enhanceSchema();
      
      // Step 4: Perform migration
      await this.performMigration();
      
      // Step 5: Post-migration verification
      await this.postVerification();
      
      this.stats.endTime = Date.now();
      
      // Step 6: Generate report
      await this.generateReport();
      
      await this.log('🎉 Migration completed successfully!');
      
    } catch (error) {
      this.stats.endTime = Date.now();
      await this.log(`💥 Migration failed: ${error.message}`, 'ERROR');
      
      // Attempt rollback on failure
      try {
        await this.rollback();
      } catch (rollbackError) {
        await this.log(`💥 Rollback also failed: ${rollbackError.message}`, 'ERROR');
      }
      
      throw error;
    } finally {
      await this.pool.end();
    }
  }
}

// Utility functions for standalone usage
async function createEnhancedMigrationRunner() {
  return new EnhancedMigrationRunner();
}

async function runMigration() {
  const runner = await createEnhancedMigrationRunner();
  return runner.run();
}

// Export for module usage
module.exports = {
  EnhancedMigrationRunner,
  createEnhancedMigrationRunner,
  runMigration
};

// Direct execution
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n🎉 Enhanced migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Enhanced migration failed:', error.message);
      process.exit(1);
    });
}