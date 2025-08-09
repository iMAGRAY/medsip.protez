#!/usr/bin/env node

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${process.env.POSTGRESQL_PASSWORD}@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'medsip_db'}`
})

async function showAllImages() {
  try {
    const result = await pool.query('SELECT id, product_id, image_url FROM product_images ORDER BY id')
    console.log('='.repeat(50))

    if (result.rows.length === 0) {
      return
    }

    result.rows.forEach((row, i) => {
    })
  } catch (error) {
    console.error('Ошибка:', error.message)
  } finally {
    await pool.end()
  }
}

showAllImages()