const { Client } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function systemHealthCheck() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  let healthScore = 0;
  const maxScore = 10;

  try {
    // 1. Database Connection
    await client.connect();
    console.log('✅ Connected to PostgreSQL:', process.env.DATABASE_URL.split('@')[1]);
    healthScore++;

    // 2. Users Table
    const usersCount = await client.query('SELECT COUNT(*) as count FROM users');
    healthScore++;

    // 3. Roles System
    const rolesCount = await client.query('SELECT COUNT(*) as count FROM roles');
    healthScore++;

    // 4. Super Admin Check
    const superAdminCheck = await client.query(`
      SELECT u.username, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'super_admin' AND u.status = 'active'
    `);

    if (superAdminCheck.rows.length > 0) {
      healthScore++;
    } else {
    }

    // 5. Sessions Table
    const sessionsInfo = await client.query(`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_sessions
      FROM user_sessions
    `);
    healthScore++;

    // 6. Audit Log
    const auditCount = await client.query('SELECT COUNT(*) as count FROM user_audit_log');
    healthScore++;

    // 7. Permission Function
    const permissionTest = await client.query('SELECT user_has_permission(1, $1) as result', ['products.create']);
    if (permissionTest.rows[0].result) {
      healthScore++;
    } else {
    }

    // 8. Database Functions
    const functionsCheck = await client.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname IN ('user_has_permission', 'cleanup_expired_sessions', 'update_updated_at_column')
    `);
    if (functionsCheck.rows.length === 3) healthScore++;

    // 9. Password Security
    const passwordCheck = await client.query(`
      SELECT password_hash
      FROM users
      WHERE username = 'medsip_admin'
    `);

    if (passwordCheck.rows.length > 0) {
      const hash = passwordCheck.rows[0].password_hash;
      if (hash.startsWith('$2b$12$')) {
        healthScore++;
      } else {
      }
    }

    // 10. System Environment
    const envChecks = [
      process.env.DATABASE_URL ? '✅ DATABASE_URL' : '❌ DATABASE_URL missing',
      process.env.JWT_SECRET ? '✅ JWT_SECRET' : '❌ JWT_SECRET missing',
      process.env.SESSION_SECRET ? '✅ SESSION_SECRET' : '❌ SESSION_SECRET missing'
    ];
    envChecks.forEach(check => console.log(`   ${check}`));
    if (envChecks.filter(c => c.includes('✅')).length === 3) healthScore++;

  } catch (error) {
    console.error('❌ System check failed:', error.message);
  } finally {
    await client.end();
  }

  // Final Score
  console.log('\n' + '='.repeat(50));
  if (healthScore === maxScore) {
  } else if (healthScore >= 8) {
  } else {
  }
  return healthScore;
}

if (require.main === module) {
  systemHealthCheck();
}

module.exports = systemHealthCheck;