const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.POSTGRESQL_HOST,
  port: process.env.POSTGRESQL_PORT,
  database: process.env.POSTGRESQL_DBNAME,
  user: process.env.POSTGRESQL_USER,
  password: process.env.POSTGRESQL_PASSWORD,
  ssl: false
});

async function checkTableColumns() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to PostgreSQL database successfully!\n');
    
    const tables = ['products', 'product_variants', 'media_files', 'warehouse_transactions'];
    
    for (const tableName of tables) {
      console.log(`=== Columns for table: ${tableName} ===`);
      
      // Check if table exists
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `;
      
      const tableExistsResult = await client.query(tableExistsQuery, [tableName]);
      
      if (!tableExistsResult.rows[0].exists) {
        console.log(`❌ Table '${tableName}' does not exist\n`);
        continue;
      }
      
      // Get column information
      const columnQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const result = await client.query(columnQuery, [tableName]);
      
      if (result.rows.length === 0) {
        console.log(`❌ No columns found for table '${tableName}'\n`);
        continue;
      }
      
      console.log('Column Name | Data Type | Nullable | Default | Max Length');
      console.log('------------|-----------|----------|---------|------------');
      
      result.rows.forEach(row => {
        const maxLength = row.character_maximum_length || 'N/A';
        const defaultValue = row.column_default || 'N/A';
        console.log(`${row.column_name.padEnd(11)} | ${row.data_type.padEnd(9)} | ${row.is_nullable.padEnd(8)} | ${defaultValue.padEnd(7)} | ${maxLength}`);
      });
      
      console.log(`\nTotal columns: ${result.rows.length}\n`);
    }
    
  } catch (error) {
    console.error('Error checking database columns:', error.message);
    console.error('Full error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTableColumns();