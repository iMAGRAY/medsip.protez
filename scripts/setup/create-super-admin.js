const { Client } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Генерация безопасного пароля
function generateSecurePassword(length = 16) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';

  // Обязательно включаем по одному символу каждого типа
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += symbols[crypto.randomInt(symbols.length)];

  // Заполняем остальные позиции случайными символами
  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Перемешиваем символы
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

const BCRYPT_ROUNDS = 12;

async function createSuperAdmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    // Проверяем, есть ли таблица users
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

    if (tableCheck.rows.length === 0) {
      return;
    }

    // Проверяем, есть ли уже супер-админ
    const existingAdmin = await client.query(`
      SELECT u.username, u.email, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'super_admin'
    `);

    if (existingAdmin.rows.length > 0) {
      existingAdmin.rows.forEach(admin => {
      });
      return;
    }
    // Данные нового администратора
    const adminData = {
      username: 'medsip_admin',
      email: 'admin@medsip-protez.local',
      password: generateSecurePassword(20),
      firstName: 'Системный',
      lastName: 'Администратор'
    };
    // Проверяем уникальность
    const duplicateCheck = await client.query(`
      SELECT username, email FROM users
      WHERE username = $1 OR email = $2
    `, [adminData.username, adminData.email]);

    if (duplicateCheck.rows.length > 0) {
      return;
    }

    // Получаем ID роли super_admin
    const roleResult = await client.query(`
      SELECT id FROM roles WHERE name = 'super_admin'
    `);

    if (roleResult.rows.length === 0) {
      return;
    }

    const superAdminRoleId = roleResult.rows[0].id;

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(adminData.password, BCRYPT_ROUNDS);

    // Создаем пользователя
    const createUserResult = await client.query(`
      INSERT INTO users (
        username, email, password_hash, role_id,
        first_name, last_name, status, email_verified,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, username, email, created_at
    `, [
      adminData.username, adminData.email, passwordHash, superAdminRoleId,
      adminData.firstName, adminData.lastName
    ]);

    const newUser = createUserResult.rows[0];

    // Добавляем запись в audit log
    await client.query(`
      INSERT INTO user_audit_log (
        user_id, action, resource_type, resource_id,
        details, created_at
      ) VALUES ($1, 'user_created', 'user', $2, $3, CURRENT_TIMESTAMP)
    `, [
      newUser.id, newUser.id,
      JSON.stringify({
        username: newUser.username,
        email: newUser.email,
        role: 'super_admin',
        created_by: 'system_script',
        timestamp: new Date().toISOString()
      })
    ]);
    // Проверяем функцию прав доступа
    const permissionTest = await client.query(`
      SELECT user_has_permission($1, 'products.create') as can_create_products,
             user_has_permission($1, 'users.manage') as can_manage_users,
             user_has_permission($1, 'admin.settings') as can_manage_settings,
             user_has_permission($1, 'media.upload') as can_upload_media
    `, [newUser.id]);

    const results = permissionTest.rows[0];
    // Записываем данные в файл для безопасности
    const fs = require('fs');
    const credentialsFile = path.join(__dirname, '../.admin-credentials.txt');
    const credentialsData = `MedSIP-Protez Супер-Администратор
==========================================
Создан: ${new Date().toISOString()}
==========================================
URL: http://localhost:3000/admin
Логин: ${adminData.username}
Пароль: ${adminData.password}
Email: ${adminData.email}
==========================================
⚠️ УДАЛИТЕ ЭТОТ ФАЙЛ ПОСЛЕ СОХРАНЕНИЯ ДАННЫХ!
`;

    fs.writeFileSync(credentialsFile, credentialsData, 'utf8');
  } catch (error) {
    console.error('❌ Ошибка создания администратора:', error);
    console.error('Подробности:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Запускаем если файл вызывается напрямую
if (require.main === module) {
  createSuperAdmin();
}

module.exports = createSuperAdmin;