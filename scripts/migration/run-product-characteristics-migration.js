#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Database connection
const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'default_db',
  user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD || process.env.DB_PASSWORD,
  ssl: false
})

async function runMigration() {
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/20241201_add_is_primary_to_product_characteristics.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Execute migration
    await pool.query(migrationSQL)
    // Verify the table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'product_characteristics'
      ORDER BY ordinal_position
    `)
    console.table(tableInfo.rows)

    // Check if is_primary column exists
    const isPrimaryColumn = tableInfo.rows.find(row => row.column_name === 'is_primary')
    if (isPrimaryColumn) {
    } else {
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
  } finally {
    await pool.end()
  }
}

runMigration()