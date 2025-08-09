const { Client } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Константы безопасности
const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 12;

async function createInitialAdmin() {
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
      SELECT u.username, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'super_admin'
    `);

    if (existingAdmin.rows.length > 0) {
      existingAdmin.rows.forEach(admin => {
      });

      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('Создать дополнительного супер-админа? (y/N): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        return;
      }
    }

    // Интерактивный ввод данных администратора
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    // Ввод имени пользователя
    const username = await new Promise(resolve => {
      readline.question('Введите имя пользователя (admin): ', (answer) => {
        resolve(answer.trim() || 'admin');
      });
    });

    // Ввод email
    const email = await new Promise(resolve => {
      readline.question('Введите email: ', resolve);
    });

    if (!email || !email.includes('@')) {
      readline.close();
      return;
    }

    // Ввод пароля
    let password;
    while (true) {
      password = await new Promise(resolve => {
        process.stdout.write('Введите пароль (минимум 12 символов): ');
        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        let password = '';
        stdin.on('data', function(char) {
          char = char + '';
          switch(char) {
            case '\n':
            case '\r':
            case '\u0004':
              stdin.setRawMode(false);
              stdin.pause();
              resolve(password);
              break;
            case '\u0003':
              process.exit();
              break;
            case '\u007f': // backspace
              if (password.length > 0) {
                password = password.slice(0, -1);
                process.stdout.write('\b \b');
              }
              break;
            default:
              password += char;
              process.stdout.write('*');
              break;
          }
        });
      });

      if (password.length >= PASSWORD_MIN_LENGTH) {
        break;
      } else {
      }
    }

    // Подтверждение пароля
    const passwordConfirm = await new Promise(resolve => {
      process.stdout.write('Подтвердите пароль: ');
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      let password = '';
      stdin.on('data', function(char) {
        char = char + '';
        switch(char) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.setRawMode(false);
            stdin.pause();
            resolve(password);
            break;
          case '\u0003':
            process.exit();
            break;
          case '\u007f': // backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            password += char;
            process.stdout.write('*');
            break;
        }
      });
    });

    if (password !== passwordConfirm) {
      readline.close();
      return;
    }

    // Ввод имени и фамилии
    const firstName = await new Promise(resolve => {
      readline.question('Введите имя (необязательно): ', resolve);
    });

    const lastName = await new Promise(resolve => {
      readline.question('Введите фамилию (необязательно): ', resolve);
    });

    readline.close();
    // Проверяем уникальность username и email
    const duplicateCheck = await client.query(`
      SELECT username, email FROM users
      WHERE username = $1 OR email = $2
    `, [username, email]);

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
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Создаем пользователя
    const createUserResult = await client.query(`
      INSERT INTO users (
        username, email, password_hash, role_id,
        first_name, last_name, status, email_verified,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, username, email, created_at
    `, [
      username, email, passwordHash, superAdminRoleId,
      firstName || null, lastName || null
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
        created_by: 'system_migration'
      })
    ]);
    // Проверяем функцию прав доступа
    const permissionTest = await client.query(`
      SELECT user_has_permission($1, 'products.create') as can_create_products,
             user_has_permission($1, 'users.manage') as can_manage_users
    `, [newUser.id]);
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
  createInitialAdmin();
}

module.exports = createInitialAdmin;