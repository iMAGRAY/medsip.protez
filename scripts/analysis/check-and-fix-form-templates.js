#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg')

// Database connection
const pool = new Pool({
  host: process.env.POSTGRESQL_HOST || process.env.PGHOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'default_db',
  user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
  password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD || process.env.DB_PASSWORD,
  ssl: false
})

async function checkAndFixTable() {
  try {
    // Check if table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'form_templates'
      )
    `)

    if (!tableExists.rows[0].exists) {
      await pool.query(`
        CREATE TABLE form_templates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          template_data JSONB NOT NULL DEFAULT '{}',
          is_favorite BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `)
    } else {
      // Get current structure
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'form_templates'
        ORDER BY ordinal_position
      `)
      console.table(columns.rows)

      const columnNames = columns.rows.map(row => row.column_name)

      // Check and add missing columns
      if (!columnNames.includes('template_data')) {
        await pool.query(`
          ALTER TABLE form_templates
          ADD COLUMN template_data JSONB DEFAULT '{}'
        `)
      }

      if (!columnNames.includes('is_favorite')) {
        await pool.query(`
          ALTER TABLE form_templates
          ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE
        `)
      }

      // Update old form_config to template_data if exists
      if (columnNames.includes('form_config') && columnNames.includes('template_data')) {
        await pool.query(`
          UPDATE form_templates
          SET template_data = COALESCE(form_config, '{}')
          WHERE template_data = '{}'
        `)
      }
    }

    // Create indexes if they don't exist
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_form_templates_name ON form_templates(name)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_form_templates_is_favorite ON form_templates(is_favorite)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_form_templates_created_at ON form_templates(created_at)
      `)
    } catch (error) {
    }

    // Final structure check
    const finalColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'form_templates'
      ORDER BY ordinal_position
    `)
    console.table(finalColumns.rows)

    // Insert sample template if table is empty
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
  } catch (error) {
    console.error('❌ Ошибка:', error)
  } finally {
    await pool.end()
  }
}

checkAndFixTable()