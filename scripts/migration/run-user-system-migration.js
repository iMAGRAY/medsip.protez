const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function runUserSystemMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    // Проверяем, есть ли уже таблица пользователей
    const checkTable = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'roles', 'user_sessions')
    `);

    if (checkTable.rows.length > 0) {
      checkTable.rows.forEach(row => console.log(`   - ${row.table_name}`));

      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('Продолжить выполнение миграции? (y/N): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        return;
      }
    }

    // Читаем миграцию
    const migrationPath = path.join(__dirname, '../database/migrations/20250130_create_user_management_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    // Выполняем миграцию
    await client.query(migrationSQL);
    // Проверяем созданные таблицы
    const tablesResult = await client.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'roles', 'user_sessions', 'user_audit_log')
      ORDER BY table_name
    `);
    tablesResult.rows.forEach(row => {
    });

    // Проверяем созданные роли
    const rolesResult = await client.query('SELECT name, display_name FROM roles ORDER BY id');
    rolesResult.rows.forEach(role => {
    });

    // Проверяем функции
    const functionsResult = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('user_has_permission', 'cleanup_expired_sessions', 'update_updated_at_column')
    `);
    functionsResult.rows.forEach(func => {
    });
  } catch (error) {
    console.error('❌ Ошибка выполнения миграции:', error);
    console.error('Подробности:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Запускаем миграцию если файл вызывается напрямую
if (require.main === module) {
  runUserSystemMigration();
}

module.exports = runUserSystemMigration;