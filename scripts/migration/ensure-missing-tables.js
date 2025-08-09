#!/usr/bin/env node

const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })

function buildPool() {
  const connectionString = process.env.DATABASE_URL || (
    `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}` +
    `@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`
  )
  const ssl = process.env.NODE_ENV === 'production' || /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : false
  return new Pool({ connectionString, ssl })
}

async function tableExists(pool, name) {
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1
    ) AS exists
  `, [name])
  return !!rows[0]?.exists
}

async function createProductSpecifications(pool) {
  const name = 'product_specifications'
  if (await tableExists(pool, name)) {
    console.log(`Skip: table ${name} already exists`)
    return
  }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE product_specifications (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      spec_name VARCHAR(255) NOT NULL,
      spec_value TEXT,
      unit VARCHAR(64),
      sort_order INTEGER DEFAULT 0,
      is_primary BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS product_specifications_product_id_idx ON product_specifications(product_id);`)
  await pool.query(`CREATE INDEX IF NOT EXISTS product_specifications_product_id_sort_idx ON product_specifications(product_id, sort_order);`)
}

async function createFormTemplates(pool) {
  const name = 'form_templates'
  if (await tableExists(pool, name)) {
    console.log(`Skip: table ${name} already exists`)
    return
  }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE form_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      characteristics JSONB NOT NULL DEFAULT '[]',
      template_data JSONB NOT NULL DEFAULT '{}',
      is_favorite BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_templates_name ON form_templates(name);`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_templates_created_at ON form_templates(created_at);`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_templates_is_favorite ON form_templates(is_favorite);`)
}

async function createWarehouseSettings(pool) {
  const name = 'warehouse_settings'
  if (await tableExists(pool, name)) {
    console.log(`Skip: table ${name} already exists`)
    return
  }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE warehouse_settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(255) UNIQUE NOT NULL,
      setting_value TEXT,
      data_type VARCHAR(50) DEFAULT 'string',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS warehouse_settings_key_idx ON warehouse_settings(setting_key);`)
}

async function createProductCategories(pool) {
  const name = 'product_categories'
  if (await tableExists(pool, name)) {
    console.log(`Skip: table ${name} already exists`)
    return
  }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE product_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      parent_id INTEGER REFERENCES product_categories(id),
      type VARCHAR(64),
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS product_categories_parent_idx ON product_categories(parent_id);`)
  await pool.query(`CREATE INDEX IF NOT EXISTS product_categories_active_idx ON product_categories(is_active);`)
}

async function main() {
  const pool = buildPool()
  try {
    await createProductCategories(pool)
    await createProductSpecifications(pool)
    await createFormTemplates(pool)
    await createWarehouseSettings(pool)
    console.log('✅ ensure-missing-tables completed')
  } catch (e) {
    console.error('❌ ensure-missing-tables failed:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  main()
}