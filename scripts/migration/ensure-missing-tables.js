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

async function createProductTags(pool) {
  const tags = 'product_tags'
  if (!(await tableExists(pool, tags))) {
    console.log(`Creating table ${tags} ...`)
    await pool.query(`
      CREATE TABLE product_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(120),
        color VARCHAR(16),
        bg_color VARCHAR(16),
        icon VARCHAR(64),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        product_id INTEGER NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS product_tags_active_idx ON product_tags(is_active);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS product_tags_product_idx ON product_tags(product_id);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS product_tags_variant_idx ON product_tags(variant_id);`)
  } else {
    console.log(`Skip: table ${tags} already exists`)
  }

  const rel = 'variant_tag_relations'
  if (!(await tableExists(pool, rel))) {
    console.log(`Creating table ${rel} ...`)
    await pool.query(`
      CREATE TABLE variant_tag_relations (
        variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(variant_id, tag_id)
      );
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS variant_tag_relations_tag_idx ON variant_tag_relations(tag_id);`)
  } else {
    console.log(`Skip: table ${rel} already exists`)
  }
}

async function createManufacturers(pool) {
  const name = 'manufacturers'
  if (await tableExists(pool, name)) { console.log(`Skip: table ${name} already exists`); return }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE manufacturers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      website_url VARCHAR(500),
      country VARCHAR(100),
      founded_year INTEGER,
      logo_url VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS manufacturers_active_idx ON manufacturers(is_active);`)
}

async function createModelSeries(pool) {
  const name = 'model_series'
  if (await tableExists(pool, name)) { console.log(`Skip: table ${name} already exists`); return }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE model_series (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      manufacturer_id INTEGER NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
      category_id INTEGER NULL REFERENCES product_categories(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS model_series_manufacturer_idx ON model_series(manufacturer_id);`)
  await pool.query(`CREATE INDEX IF NOT EXISTS model_series_active_idx ON model_series(is_active);`)
}

async function createProducts(pool) {
  const name = 'products'
  if (await tableExists(pool, name)) { console.log(`Skip: table ${name} already exists`); return }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      short_name VARCHAR(255),
      description TEXT,
      sku VARCHAR(100) UNIQUE,
      article_number VARCHAR(100),
      price NUMERIC(12,2),
      discount_price NUMERIC(12,2),
      image_url TEXT,
      images JSONB,
      series_id INTEGER NULL REFERENCES model_series(id) ON DELETE SET NULL,
      manufacturer_id INTEGER NULL REFERENCES manufacturers(id) ON DELETE SET NULL,
      category_id INTEGER NULL REFERENCES product_categories(id) ON DELETE SET NULL,
      in_stock BOOLEAN DEFAULT true,
      stock_quantity INTEGER DEFAULT 0,
      stock_status VARCHAR(32) DEFAULT 'in_stock',
      weight VARCHAR(64),
      battery_life VARCHAR(64),
      warranty VARCHAR(255),
      show_price BOOLEAN DEFAULT true,
      is_deleted BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);`)
  await pool.query(`CREATE INDEX IF NOT EXISTS products_manufacturer_idx ON products(manufacturer_id);`)
  await pool.query(`CREATE INDEX IF NOT EXISTS products_deleted_idx ON products(is_deleted);`)
}

async function createProductImages(pool) {
  const name = 'product_images'
  if (await tableExists(pool, name)) { console.log(`Skip: table ${name} already exists`); return }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE product_images (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      is_main BOOLEAN DEFAULT false,
      image_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images(product_id);`)
  await pool.query(`CREATE INDEX IF NOT EXISTS product_images_order_idx ON product_images(product_id, image_order);`)
}

async function createProductSizes(pool) {
  const name = 'product_sizes'
  if (await tableExists(pool, name)) { console.log(`Skip: table ${name} already exists`); return }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE product_sizes (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size_name VARCHAR(64),
      price NUMERIC(12,2),
      discount_price NUMERIC(12,2),
      is_available BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS product_sizes_product_idx ON product_sizes(product_id);`)
}

async function createMediaFiles(pool) {
  const name = 'media_files'
  if (await tableExists(pool, name)) { console.log(`Skip: table ${name} already exists`); return }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE media_files (
      id SERIAL PRIMARY KEY,
      file_key TEXT NOT NULL,
      file_url TEXT NOT NULL,
      mime_type VARCHAR(128),
      size_bytes BIGINT,
      width INTEGER,
      height INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS media_files_key_idx ON media_files(file_key);`)
}

async function createCharacteristicsSimple(pool) {
  // groups
  if (!(await tableExists(pool, 'characteristics_groups_simple'))) {
    console.log('Creating table characteristics_groups_simple ...')
    await pool.query(`
      CREATE TABLE characteristics_groups_simple (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_id INTEGER NULL REFERENCES characteristics_groups_simple(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS char_groups_parent_idx ON characteristics_groups_simple(parent_id);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS char_groups_active_idx ON characteristics_groups_simple(is_active);`)
  } else {
    console.log('Skip: table characteristics_groups_simple already exists')
  }
  // values
  if (!(await tableExists(pool, 'characteristics_values_simple'))) {
    console.log('Creating table characteristics_values_simple ...')
    await pool.query(`
      CREATE TABLE characteristics_values_simple (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES characteristics_groups_simple(id) ON DELETE CASCADE,
        value VARCHAR(255) NOT NULL,
        color_hex VARCHAR(16),
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS char_values_group_idx ON characteristics_values_simple(group_id);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS char_values_active_idx ON characteristics_values_simple(is_active);`)
  } else {
    console.log('Skip: table characteristics_values_simple already exists')
  }
  // product_characteristics_simple
  if (!(await tableExists(pool, 'product_characteristics_simple'))) {
    console.log('Creating table product_characteristics_simple ...')
    await pool.query(`
      CREATE TABLE product_characteristics_simple (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        value_id INTEGER NOT NULL REFERENCES characteristics_values_simple(id) ON DELETE CASCADE,
        additional_value VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS pcs_product_idx ON product_characteristics_simple(product_id);`)
    await pool.query(`CREATE INDEX IF NOT EXISTS pcs_value_idx ON product_characteristics_simple(value_id);`)
  } else {
    console.log('Skip: table product_characteristics_simple already exists')
  }
}

async function createWarehouseCore(pool) {
  async function ensure(name, ddl, indexes = []) {
    if (await tableExists(pool, name)) {
      console.log(`Skip: table ${name} already exists`)
      return
    }
    console.log(`Creating table ${name} ...`)
    await pool.query(ddl)
    for (const idx of indexes) await pool.query(idx)
  }

  await ensure('warehouse_regions', `
    CREATE TABLE warehouse_regions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(16) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE UNIQUE INDEX IF NOT EXISTS warehouse_regions_code_idx ON warehouse_regions(code);`
  ])

  await ensure('warehouse_cities', `
    CREATE TABLE warehouse_cities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      region_id INTEGER NOT NULL REFERENCES warehouse_regions(id) ON DELETE CASCADE,
      code VARCHAR(32),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE INDEX IF NOT EXISTS warehouse_cities_region_idx ON warehouse_cities(region_id);`
  ])

  await ensure('warehouse_warehouses', `
    CREATE TABLE warehouse_warehouses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      city_id INTEGER NOT NULL REFERENCES warehouse_cities(id) ON DELETE CASCADE,
      code VARCHAR(32),
      address TEXT,
      phone VARCHAR(64),
      manager_name VARCHAR(255),
      total_capacity INTEGER,
      warehouse_type VARCHAR(64),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE INDEX IF NOT EXISTS warehouse_warehouses_city_idx ON warehouse_warehouses(city_id);`
  ])

  await ensure('warehouse_zones', `
    CREATE TABLE warehouse_zones (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      warehouse_id INTEGER NOT NULL REFERENCES warehouse_warehouses(id) ON DELETE CASCADE,
      code VARCHAR(32),
      capacity INTEGER,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE INDEX IF NOT EXISTS warehouse_zones_warehouse_idx ON warehouse_zones(warehouse_id);`
  ])

  await ensure('warehouse_sections', `
    CREATE TABLE warehouse_sections (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      zone_id INTEGER NOT NULL REFERENCES warehouse_zones(id) ON DELETE CASCADE,
      code VARCHAR(32),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE INDEX IF NOT EXISTS warehouse_sections_zone_idx ON warehouse_sections(zone_id);`
  ])

  await ensure('warehouse_inventory', `
    CREATE TABLE warehouse_inventory (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NULL REFERENCES products(id) ON DELETE SET NULL,
      sku VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      section_id INTEGER NOT NULL REFERENCES warehouse_sections(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      max_stock INTEGER DEFAULT 0,
      unit_price NUMERIC(12,2),
      status VARCHAR(32) DEFAULT 'active',
      expiry_date DATE,
      batch_number VARCHAR(64),
      supplier VARCHAR(255),
      last_counted TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE INDEX IF NOT EXISTS warehouse_inventory_section_idx ON warehouse_inventory(section_id);`,
    `CREATE INDEX IF NOT EXISTS warehouse_inventory_product_idx ON warehouse_inventory(product_id);`,
    `CREATE INDEX IF NOT EXISTS warehouse_inventory_status_idx ON warehouse_inventory(status);`
  ])

  await ensure('warehouse_movements', `
    CREATE TABLE warehouse_movements (
      id SERIAL PRIMARY KEY,
      inventory_id INTEGER NOT NULL REFERENCES warehouse_inventory(id) ON DELETE CASCADE,
      movement_type VARCHAR(32) NOT NULL,
      quantity INTEGER NOT NULL,
      from_section_id INTEGER NULL REFERENCES warehouse_sections(id) ON DELETE SET NULL,
      to_section_id INTEGER NULL REFERENCES warehouse_sections(id) ON DELETE SET NULL,
      reason TEXT,
      user_name VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE INDEX IF NOT EXISTS warehouse_movements_inventory_idx ON warehouse_movements(inventory_id);`
  ])
}

async function createCatalogMenuSettings(pool) {
  const name = 'catalog_menu_settings'
  if (await tableExists(pool, name)) {
    console.log(`Skip: table ${name} already exists`)
    return
  }
  console.log(`Creating table ${name} ...`)
  await pool.query(`
    CREATE TABLE catalog_menu_settings (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(64),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_visible BOOLEAN DEFAULT true,
      is_expanded BOOLEAN DEFAULT false,
      show_in_main_menu BOOLEAN DEFAULT true,
      parent_id INTEGER NULL REFERENCES catalog_menu_settings(id) ON DELETE SET NULL,
      icon VARCHAR(64),
      css_class VARCHAR(64),
      custom_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS catalog_menu_settings_parent_idx ON catalog_menu_settings(parent_id);`)
}

async function main() {
  const pool = buildPool()
  try {
    await createProductCategories(pool)
    await createManufacturers(pool)
    await createModelSeries(pool)
    await createProducts(pool)
    await createProductImages(pool)
    await createProductSizes(pool)
    await createFormTemplates(pool)
    await createWarehouseSettings(pool)
    await createProductTags(pool)
    await createWarehouseCore(pool)
    await createCatalogMenuSettings(pool)
    await createMediaFiles(pool)
    await createProductSpecifications(pool)
    await createCharacteristicsSimple(pool)
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