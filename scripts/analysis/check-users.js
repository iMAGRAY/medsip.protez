const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkUsers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    // Проверяем пользователей
    const usersResult = await client.query(`
      SELECT u.id, u.username, u.email, u.status, u.created_at,
             r.name as role_name, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id
    `);

    if (usersResult.rows.length === 0) {
      return;
    }
    usersResult.rows.forEach(user => {
    });

    // Проверяем активные сессии
    const sessionsResult = await client.query(`
      SELECT COUNT(*) as session_count,
             COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_sessions
      FROM user_sessions
    `);

    const { session_count, active_sessions } = sessionsResult.rows[0];
    // Проверяем роли
    const rolesResult = await client.query('SELECT * FROM roles ORDER BY name');
    rolesResult.rows.forEach(role => {
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await client.end();
  }
}

checkUsers();