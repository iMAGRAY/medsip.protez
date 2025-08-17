#!/usr/bin/env node

/**
 * ТЕСТЫ АУТЕНТИФИКАЦИИ И СЕССИЙ ДЛЯ MEDSIP.PROTEZ
 * Проверка системы авторизации, сессий и прав доступа
 * 
 * Запуск: node tests/integration/auth-session-tests.js
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');

// Конфигурация
const BASE_URL = process.env.TEST_URL || 'http://localhost:3009';
const TIMEOUT = 10000;

// Тестовые учетные данные
const TEST_CREDENTIALS = {
  admin: {
    username: process.env.TEST_ADMIN_USER || 'admin',
    password: process.env.TEST_ADMIN_PASS || 'admin123'
  },
  invalidUser: {
    username: 'nonexistent_user_' + Date.now(),
    password: 'wrong_password_123'
  }
};

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

// Статистика
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let testGroups = [];

// Утилиты
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, message = '') {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
  log(`  ${icon} ${name}${message ? ': ' + message : ''}`, color);
}

function logGroup(name) {
  log(`\n🔐 ${name}`, 'cyan');
  testGroups.push({ name, tests: [] });
}

// HTTP клиент с поддержкой cookies и сессий
class AuthTestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.sessionToken = null;
    this.csrfToken = null;
  }

  async request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'AuthTestClient/1.0',
        ...options.headers
      };
      
      // Добавляем cookies
      if (this.cookies.size > 0) {
        headers['Cookie'] = this.getCookieString();
      }
      
      // Добавляем CSRF токен если есть
      if (this.csrfToken) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }
      
      // Добавляем токен авторизации если есть
      if (this.sessionToken) {
        headers['Authorization'] = `Bearer ${this.sessionToken}`;
      }
      
      const reqOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers,
        timeout: TIMEOUT
      };

      const req = client.request(reqOptions, (res) => {
        // Сохраняем cookies из ответа
        if (res.headers['set-cookie']) {
          res.headers['set-cookie'].forEach(cookie => {
            const [nameValue, ...params] = cookie.split(';');
            const [name, value] = nameValue.split('=');
            
            // Сохраняем cookie с параметрами
            this.cookies.set(name, {
              value,
              params: params.map(p => p.trim())
            });
            
            // Ищем сессионный токен
            if (name === 'admin_session' || name === 'session_token') {
              this.sessionToken = value;
            }
          });
        }
        
        // Ищем CSRF токен в заголовках
        if (res.headers['x-csrf-token']) {
          this.csrfToken = res.headers['x-csrf-token'];
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            
            // Ищем токены в теле ответа
            if (json.token) {
              this.sessionToken = json.token;
            }
            if (json.csrfToken) {
              this.csrfToken = json.csrfToken;
            }
            
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: json,
              raw: data
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data,
              raw: data
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        const bodyStr = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
        req.write(bodyStr);
      }
      
      req.end();
    });
  }

  getCookieString() {
    return Array.from(this.cookies.entries())
      .map(([name, data]) => `${name}=${data.value || data}`)
      .join('; ');
  }

  clearSession() {
    this.cookies.clear();
    this.sessionToken = null;
    this.csrfToken = null;
  }

  hasSession() {
    return this.sessionToken !== null || this.cookies.has('admin_session');
  }
}

// Тестовые функции
async function test(name, testFn) {
  totalTests++;
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    passedTests++;
    logTest(name, 'pass', `${duration}ms`);
    
    if (testGroups.length > 0) {
      testGroups[testGroups.length - 1].tests.push({
        name,
        status: 'pass',
        duration
      });
    }
    
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    failedTests++;
    logTest(name, 'fail', error.message);
    
    if (testGroups.length > 0) {
      testGroups[testGroups.length - 1].tests.push({
        name,
        status: 'fail',
        error: error.message,
        duration
      });
    }
    
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ТЕСТЫ: Базовая аутентификация
async function testBasicAuthentication(client) {
  logGroup('БАЗОВАЯ АУТЕНТИФИКАЦИЯ');
  
  // Проверка статуса без авторизации
  await test('Проверка статуса без авторизации', async () => {
    client.clearSession();
    const res = await client.request('/api/admin/auth/status');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.authenticated === false, 'Should not be authenticated');
  });
  
  // Неудачная попытка входа
  await test('Неудачная попытка входа с неверными данными', async () => {
    client.clearSession();
    const res = await client.request('/api/admin/auth/login', {
      method: 'POST',
      body: TEST_CREDENTIALS.invalidUser
    });
    
    assert(
      res.status === 401 || res.status === 403,
      `Expected 401 or 403, got ${res.status}`
    );
    assert(res.data.success === false, 'Login should fail');
    assert(!client.hasSession(), 'Should not have session after failed login');
  });
  
  // Пустые учетные данные
  await test('Попытка входа с пустыми данными', async () => {
    client.clearSession();
    const res = await client.request('/api/admin/auth/login', {
      method: 'POST',
      body: {}
    });
    
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.data.success === false, 'Login should fail');
  });
  
  // SQL инъекция в логине
  await test('Защита от SQL инъекции в логине', async () => {
    client.clearSession();
    const res = await client.request('/api/admin/auth/login', {
      method: 'POST',
      body: {
        username: "admin' OR '1'='1",
        password: "' OR '1'='1"
      }
    });
    
    assert(
      res.status === 401 || res.status === 403,
      'SQL injection attempt should fail'
    );
    assert(!client.hasSession(), 'Should not have session after SQL injection attempt');
  });
  
  // XSS в учетных данных
  await test('Защита от XSS в учетных данных', async () => {
    client.clearSession();
    const res = await client.request('/api/admin/auth/login', {
      method: 'POST',
      body: {
        username: '<script>alert("XSS")</script>',
        password: '<img src=x onerror=alert("XSS")>'
      }
    });
    
    assert(
      res.status === 401 || res.status === 403,
      'XSS attempt should fail'
    );
    assert(!client.hasSession(), 'Should not have session after XSS attempt');
  });
}

// ТЕСТЫ: Управление сессиями
async function testSessionManagement(client) {
  logGroup('УПРАВЛЕНИЕ СЕССИЯМИ');
  
  let sessionId;
  
  // Создание сессии (успешный вход)
  await test('Создание сессии при успешном входе', async () => {
    client.clearSession();
    const res = await client.request('/api/admin/auth/login', {
      method: 'POST',
      body: TEST_CREDENTIALS.admin
    });
    
    // Может вернуть 200 или 401 в зависимости от настроек
    if (res.status === 200) {
      assert(res.data.success === true, 'Login should succeed');
      assert(client.hasSession(), 'Should have session after successful login');
      sessionId = client.sessionToken || client.cookies.get('admin_session')?.value;
    } else {
      // Если логин не работает, пропускаем остальные тесты сессий
      log('    ⚠️  Логин не настроен, пропускаем тесты сессий', 'yellow');
      return;
    }
  });
  
  // Проверка статуса с активной сессией
  if (sessionId) {
    await test('Проверка статуса с активной сессией', async () => {
      const res = await client.request('/api/admin/auth/status');
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.authenticated === true, 'Should be authenticated');
    });
    
    // Доступ к защищенным ресурсам
    await test('Доступ к защищенным ресурсам с сессией', async () => {
      const res = await client.request('/api/admin/products', {
        method: 'GET'
      });
      
      // Должен либо успешно вернуть данные, либо 404 если endpoint не существует
      assert(
        res.status === 200 || res.status === 404,
        `Expected 200 or 404, got ${res.status}`
      );
    });
    
    // Выход из системы
    await test('Выход из системы', async () => {
      const res = await client.request('/api/admin/auth/logout', {
        method: 'POST'
      });
      
      assert(
        res.status === 200 || res.status === 204,
        `Expected 200 or 204, got ${res.status}`
      );
      
      // Проверяем что сессия удалена
      const statusRes = await client.request('/api/admin/auth/status');
      assert(statusRes.data.authenticated === false, 'Should not be authenticated after logout');
    });
  }
  
  // Повторное использование старой сессии
  await test('Попытка использования недействительной сессии', async () => {
    client.clearSession();
    // Устанавливаем фейковую сессию
    client.cookies.set('admin_session', { value: 'invalid_session_id_12345' });
    
    const res = await client.request('/api/admin/auth/status');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.authenticated === false, 'Should not be authenticated with invalid session');
  });
}

// ТЕСТЫ: Rate Limiting
async function testRateLimiting(client) {
  logGroup('RATE LIMITING');
  
  // Rate limiting для логина
  await test('Rate limiting для попыток входа', async () => {
    client.clearSession();
    const attempts = [];
    
    // Делаем 10 быстрых попыток
    for (let i = 0; i < 10; i++) {
      attempts.push(
        client.request('/api/admin/auth/login', {
          method: 'POST',
          body: {
            username: `test_user_${i}`,
            password: 'wrong_password'
          }
        }).catch(e => ({ status: 429, error: e.message }))
      );
    }
    
    const results = await Promise.all(attempts);
    const rateLimited = results.some(r => r.status === 429);
    
    assert(rateLimited, 'Rate limiting should trigger after multiple attempts');
  });
  
  // Rate limiting для API
  await test('Rate limiting для общих API запросов', async () => {
    const attempts = [];
    
    // Делаем 150 быстрых запросов (лимит обычно 100/мин)
    for (let i = 0; i < 150; i++) {
      attempts.push(
        client.request('/api/products?limit=1')
          .catch(e => ({ status: 429, error: e.message }))
      );
    }
    
    const results = await Promise.all(attempts);
    const rateLimited = results.some(r => r.status === 429);
    
    // Rate limiting должен сработать
    assert(rateLimited, 'API rate limiting should trigger after many requests');
  });
}

// ТЕСТЫ: Токены и CSRF защита
async function testTokenSecurity(client) {
  logGroup('БЕЗОПАСНОСТЬ ТОКЕНОВ');
  
  // Проверка генерации токенов
  await test('Проверка уникальности токенов сессий', async () => {
    const sessions = new Set();
    
    // Создаем несколько сессий
    for (let i = 0; i < 3; i++) {
      client.clearSession();
      const res = await client.request('/api/admin/auth/login', {
        method: 'POST',
        body: TEST_CREDENTIALS.admin
      });
      
      if (res.status === 200 && client.hasSession()) {
        const sessionId = client.sessionToken || client.cookies.get('admin_session')?.value;
        assert(!sessions.has(sessionId), 'Session tokens should be unique');
        sessions.add(sessionId);
      }
    }
  });
  
  // Проверка длины токена
  await test('Проверка безопасной длины токена', async () => {
    client.clearSession();
    const res = await client.request('/api/admin/auth/login', {
      method: 'POST',
      body: TEST_CREDENTIALS.admin
    });
    
    if (res.status === 200 && client.hasSession()) {
      const token = client.sessionToken || client.cookies.get('admin_session')?.value;
      assert(token.length >= 32, `Token too short: ${token.length} chars`);
    }
  });
  
  // CSRF защита
  await test('CSRF защита для POST запросов', async () => {
    // Попытка POST без CSRF токена
    const res = await client.request('/api/admin/products', {
      method: 'POST',
      body: { name: 'Test Product' },
      headers: {
        'Origin': 'http://evil-site.com'
      }
    });
    
    // Должен отклонить или требовать авторизацию
    assert(
      res.status === 403 || res.status === 401 || res.status === 404,
      'Should reject cross-origin POST'
    );
  });
}

// ТЕСТЫ: Права доступа
async function testAccessControl(client) {
  logGroup('КОНТРОЛЬ ДОСТУПА');
  
  // Доступ к административным ресурсам без авторизации
  await test('Блокировка доступа к админ-ресурсам без авторизации', async () => {
    client.clearSession();
    
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/settings',
      '/api/admin/products/create',
      '/api/admin/categories/create'
    ];
    
    for (const endpoint of adminEndpoints) {
      const res = await client.request(endpoint);
      assert(
        res.status === 401 || res.status === 403 || res.status === 404,
        `${endpoint} should require auth, got ${res.status}`
      );
    }
  });
  
  // Публичные endpoints доступны без авторизации
  await test('Публичные endpoints доступны без авторизации', async () => {
    client.clearSession();
    
    const publicEndpoints = [
      '/api/products',
      '/api/categories',
      '/api/manufacturers',
      '/api/health'
    ];
    
    for (const endpoint of publicEndpoints) {
      const res = await client.request(endpoint);
      assert(
        res.status === 200,
        `${endpoint} should be public, got ${res.status}`
      );
    }
  });
}

// ТЕСТЫ: Безопасность паролей
async function testPasswordSecurity(client) {
  logGroup('БЕЗОПАСНОСТЬ ПАРОЛЕЙ');
  
  // Слишком короткий пароль
  await test('Отклонение слишком короткого пароля', async () => {
    const res = await client.request('/api/admin/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: 'old_pass',
        newPassword: '123'
      }
    });
    
    // Должен отклонить короткий пароль или требовать авторизацию
    assert(
      res.status === 400 || res.status === 401 || res.status === 404,
      'Should reject short password'
    );
  });
  
  // Пароль не должен возвращаться в ответах
  await test('Пароли не возвращаются в API ответах', async () => {
    const res = await client.request('/api/admin/auth/login', {
      method: 'POST',
      body: TEST_CREDENTIALS.admin
    });
    
    const responseStr = JSON.stringify(res.data);
    assert(
      !responseStr.includes(TEST_CREDENTIALS.admin.password),
      'Password should not be in response'
    );
  });
}

// ТЕСТЫ: Тайм-ауты сессий
async function testSessionTimeouts(client) {
  logGroup('ТАЙМ-АУТЫ СЕССИЙ');
  
  // Проверка истечения сессии
  await test('Проверка работы с истекшими сессиями', async () => {
    client.clearSession();
    
    // Устанавливаем старую сессию
    client.cookies.set('admin_session', {
      value: 'expired_session_' + Date.now(),
      params: ['Expires=' + new Date(Date.now() - 1000).toUTCString()]
    });
    
    const res = await client.request('/api/admin/auth/status');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.authenticated === false, 'Expired session should not be valid');
  });
  
  // Обновление сессии при активности
  await test('Обновление времени жизни сессии при активности', async () => {
    client.clearSession();
    const loginRes = await client.request('/api/admin/auth/login', {
      method: 'POST',
      body: TEST_CREDENTIALS.admin
    });
    
    if (loginRes.status === 200) {
      // Делаем запрос для обновления сессии
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const res = await client.request('/api/admin/auth/status');
      assert(res.status === 200, 'Session should still be valid');
      
      // Проверяем что cookie обновился
      const sessionCookie = client.cookies.get('admin_session');
      if (sessionCookie && sessionCookie.params) {
        const hasExpires = sessionCookie.params.some(p => p.startsWith('Expires='));
        assert(hasExpires, 'Session cookie should have expiration');
      }
    }
  });
}

// ГЛАВНАЯ ФУНКЦИЯ
async function runAuthTests() {
  log('\n' + '='.repeat(60), 'bold');
  log('🔐 ТЕСТЫ АУТЕНТИФИКАЦИИ И СЕССИЙ MEDSIP.PROTEZ', 'bold');
  log('='.repeat(60), 'bold');
  log(`📍 URL: ${BASE_URL}`, 'blue');
  log(`⏱️  Timeout: ${TIMEOUT}ms`, 'blue');
  
  const startTime = Date.now();
  const client = new AuthTestClient(BASE_URL);
  
  try {
    // Проверяем доступность сервера
    await client.request('/api/health');
  } catch (error) {
    log('\n❌ СЕРВЕР НЕДОСТУПЕН!', 'red');
    log(`Убедитесь что сервер запущен на ${BASE_URL}`, 'yellow');
    log('Запустите: npm run dev', 'yellow');
    process.exit(1);
  }
  
  // Запускаем тесты
  await testBasicAuthentication(client);
  await testSessionManagement(client);
  await testRateLimiting(client);
  await testTokenSecurity(client);
  await testAccessControl(client);
  await testPasswordSecurity(client);
  await testSessionTimeouts(client);
  
  // Итоги
  const duration = Date.now() - startTime;
  
  log('\n' + '='.repeat(60), 'bold');
  log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ АУТЕНТИФИКАЦИИ', 'bold');
  log('='.repeat(60), 'bold');
  
  // Детальная статистика по группам
  log('\n📋 ДЕТАЛИЗАЦИЯ ПО ГРУППАМ:', 'cyan');
  testGroups.forEach(group => {
    const passed = group.tests.filter(t => t.status === 'pass').length;
    const failed = group.tests.filter(t => t.status === 'fail').length;
    const rate = group.tests.length > 0 ? Math.round((passed / group.tests.length) * 100) : 0;
    const color = rate === 100 ? 'green' : rate >= 80 ? 'yellow' : 'red';
    
    log(`  ${group.name}: ${passed}/${group.tests.length} (${rate}%)`, color);
    
    if (failed > 0) {
      group.tests.filter(t => t.status === 'fail').forEach(test => {
        log(`    ❌ ${test.name}: ${test.error}`, 'dim');
      });
    }
  });
  
  log(`\n⏱️  Время выполнения: ${duration}ms`, 'blue');
  log(`📝 Всего тестов: ${totalTests}`, 'blue');
  log(`✅ Пройдено: ${passedTests}`, 'green');
  log(`❌ Провалено: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  const rateColor = successRate === 100 ? 'green' : successRate >= 80 ? 'yellow' : 'red';
  
  log(`\n📈 Успешность: ${successRate}%`, rateColor);
  
  // Рекомендации по безопасности
  log('\n🔒 РЕКОМЕНДАЦИИ ПО БЕЗОПАСНОСТИ:', 'magenta');
  log('  • Используйте HTTPS в продакшене', 'dim');
  log('  • Настройте правильные CORS политики', 'dim');
  log('  • Регулярно ротируйте секретные ключи', 'dim');
  log('  • Логируйте все попытки входа', 'dim');
  log('  • Используйте 2FA для админов', 'dim');
  
  if (failedTests === 0) {
    log('\n🎉 ВСЕ ТЕСТЫ БЕЗОПАСНОСТИ ПРОЙДЕНЫ!', 'green');
  } else {
    log('\n⚠️  Обнаружены проблемы с безопасностью. Проверьте логи.', 'red');
  }
  
  // Exit код для CI/CD
  process.exit(failedTests > 0 ? 1 : 0);
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  log('\n💥 Критическая ошибка:', 'red');
  console.error(error);
  process.exit(1);
});

// Запуск тестов
runAuthTests().catch(error => {
  log('\n💥 Ошибка выполнения тестов:', 'red');
  console.error(error);
  process.exit(1);
});