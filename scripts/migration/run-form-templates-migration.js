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
    const migrationPath = path.join(__dirname, '../database/migrations/20241201_create_form_templates_table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Execute migration
    await pool.query(migrationSQL)
    // Verify the table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'form_templates'
      ORDER BY ordinal_position
    `)
    console.table(tableInfo.rows)

    // Check if table exists and has correct structure
    if (tableInfo.rows.length > 0) {
      // Insert a sample template if table is empty
      const countResult = await pool.query('SELECT COUNT(*) FROM form_templates')
      const count = parseInt(countResult.rows[0].count)

      if (count === 0) {
        const sampleTemplate = {
          characteristics: [
            {
              id: 'sample_1',
              group_id: 1,
              group_name: 'Основные характеристики',
              characteristic_type: 'text',
              label: 'Материал',
              value_text: 'Силикон',
              is_primary: true,
              is_required: true,
              sort_order: 0
            },
            {
              id: 'sample_2',
              group_id: 1,
              group_name: 'Основные характеристики',
              characteristic_type: 'select',
              label: 'Цвет',
              selected_enum_id: 1,
              is_primary: false,
              is_required: false,
              sort_order: 1
            }
          ],
          version: '1.0'
        }

        await pool.query(
          'INSERT INTO form_templates (name, description, template_data, is_favorite) VALUES ($1, $2, $3, $4)',
          [
            'Базовый шаблон',
            'Пример шаблона с основными характеристиками',
            JSON.stringify(sampleTemplate),
            true
          ]
        )
      }
    } else {
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
  } finally {
    await pool.end()
  }
}

runMigration()