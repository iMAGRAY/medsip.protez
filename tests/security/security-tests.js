#!/usr/bin/env node

/**
 * ТЕСТЫ БЕЗОПАСНОСТИ ДЛЯ MEDSIP.PROTEZ
 * Проверка защиты от SQL injection, XSS, CSRF и других уязвимостей
 * 
 * Запуск: node tests/security/security-tests.js
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');

// Конфигурация
const BASE_URL = process.env.TEST_URL || 'http://localhost:3009';
const TIMEOUT = 10000;

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
let vulnerabilities = [];

// Утилиты
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, message = '') {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
  log(`  ${icon} ${name}${message ? ': ' + message : ''}`, color);
}

function logGroup(name) {
  log(`\n🔒 ${name}`, 'cyan');
}

// HTTP клиент для тестирования
class SecurityTestClient {
  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url, BASE_URL);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: TIMEOUT
      };

      const req = client.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }
}

// Тестовая функция
async function test(name, testFn) {
  totalTests++;
  
  try {
    const result = await testFn();
    if (result.vulnerable) {
      failedTests++;
      vulnerabilities.push({
        name,
        severity: result.severity || 'medium',
        details: result.details
      });
      logTest(name, 'fail', result.message);
    } else {
      passedTests++;
      logTest(name, 'pass', result.message);
    }
    return result;
  } catch (error) {
    failedTests++;
    logTest(name, 'fail', error.message);
    return { vulnerable: true, error: error.message };
  }
}

// SQL INJECTION ТЕСТЫ
async function testSQLInjection(client) {
  logGroup('SQL INJECTION ТЕСТЫ');
  
  // Классические SQL injection попытки
  const sqlPayloads = [
    "' OR '1'='1",
    "1' OR '1'='1' --",
    "' OR 1=1 --",
    "admin' --",
    "' UNION SELECT * FROM users --",
    "'; DROP TABLE products; --",
    "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a) --",
    "' OR EXISTS(SELECT * FROM users WHERE username='admin') --",
    "1' AND ASCII(SUBSTRING((SELECT password FROM users LIMIT 1),1,1))>64 --",
    "' OR pg_sleep(5) --"
  ];
  
  // Тест поиска
  await test('SQL Injection в поиске', async () => {
    for (const payload of sqlPayloads) {
      const res = await client.request(`/api/products/search?q=${encodeURIComponent(payload)}`);
      
      // Проверяем что нет SQL ошибок в ответе
      if (res.data.includes('syntax error') || 
          res.data.includes('SQL') || 
          res.data.includes('PostgreSQL') ||
          res.data.includes('mysql') ||
          res.status === 500) {
        return {
          vulnerable: true,
          severity: 'critical',
          message: `Уязвим к SQL injection: ${payload}`,
          details: `Payload вызвал SQL ошибку`
        };
      }
      
      // Проверяем что не возвращаются все записи
      try {
        const parsed = JSON.parse(res.data);
        if (parsed.data && parsed.data.length > 100) {
          return {
            vulnerable: true,
            severity: 'critical',
            message: `Возможна SQL injection: ${payload}`,
            details: `Возвращено подозрительно много записей`
          };
        }
      } catch (e) {}
    }
    
    return { vulnerable: false, message: 'Защищен от SQL injection в поиске' };
  });
  
  // Тест ID параметров
  await test('SQL Injection в ID параметрах', async () => {
    const idPayloads = [
      "1 OR 1=1",
      "1' OR '1'='1",
      "1; DROP TABLE products",
      "-1 UNION SELECT * FROM users"
    ];
    
    for (const payload of idPayloads) {
      const res = await client.request(`/api/products/${encodeURIComponent(payload)}`);
      
      if (res.data.includes('syntax error') || res.data.includes('SQL')) {
        return {
          vulnerable: true,
          severity: 'critical',
          message: `Уязвим к SQL injection в ID: ${payload}`,
          details: `ID параметр не валидируется`
        };
      }
    }
    
    return { vulnerable: false, message: 'ID параметры защищены' };
  });
  
  // Тест фильтров
  await test('SQL Injection в фильтрах', async () => {
    const filterPayloads = [
      "1' OR '1'='1",
      "'; DELETE FROM products WHERE ''='"
    ];
    
    for (const payload of filterPayloads) {
      const res = await client.request(`/api/products?category_id=${encodeURIComponent(payload)}`);
      
      if (res.status === 500 || res.data.includes('error')) {
        // Ошибка может означать защиту, но проверяем детали
        if (res.data.includes('syntax') || res.data.includes('SQL')) {
          return {
            vulnerable: true,
            severity: 'high',
            message: `SQL injection в фильтрах: ${payload}`,
            details: `Фильтры не экранируются`
          };
        }
      }
    }
    
    return { vulnerable: false, message: 'Фильтры защищены от SQL injection' };
  });
}

// XSS ТЕСТЫ
async function testXSS(client) {
  logGroup('XSS (CROSS-SITE SCRIPTING) ТЕСТЫ');
  
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror="alert(\'XSS\')">',
    '<svg onload="alert(\'XSS\')">',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload="alert(\'XSS\')">',
    '"><script>alert("XSS")</script>',
    '<script>document.cookie</script>',
    '<a href="javascript:alert(\'XSS\')">click</a>',
    '${alert("XSS")}',
    '{{constructor.constructor("alert(1)")()}}' // Template injection
  ];
  
  // Тест reflected XSS в поиске
  await test('Reflected XSS в поиске', async () => {
    for (const payload of xssPayloads) {
      const res = await client.request(`/api/products/search?q=${encodeURIComponent(payload)}`);
      
      // Проверяем что payload не отражается без экранирования
      if (res.data.includes(payload) || 
          res.data.includes('<script>') && !res.data.includes('&lt;script&gt;')) {
        return {
          vulnerable: true,
          severity: 'high',
          message: `Reflected XSS найден: ${payload}`,
          details: `Пользовательский ввод не экранируется`
        };
      }
    }
    
    return { vulnerable: false, message: 'Защищен от reflected XSS' };
  });
  
  // Тест stored XSS (если есть возможность сохранения)
  await test('Stored XSS проверка', async () => {
    // Попытка создать продукт с XSS (если API доступен)
    const xssProduct = {
      name: '<script>alert("Stored XSS")</script>',
      description: '<img src=x onerror="alert(\'XSS\')">',
      price: 100
    };
    
    const createRes = await client.request('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(xssProduct)
    });
    
    if (createRes.status === 404 || createRes.status === 405) {
      return { vulnerable: false, message: 'Создание продуктов не доступно (тест пропущен)' };
    }
    
    if (createRes.status === 201 || createRes.status === 200) {
      // Проверяем что данные экранированы
      const data = JSON.parse(createRes.data);
      if (data.name && data.name.includes('<script>')) {
        return {
          vulnerable: true,
          severity: 'critical',
          message: 'Stored XSS возможен',
          details: 'HTML не экранируется при сохранении'
        };
      }
    }
    
    return { vulnerable: false, message: 'Защищен от stored XSS' };
  });
  
  // Тест DOM XSS
  await test('DOM-based XSS защита', async () => {
    const domPayloads = [
      '#<script>alert("XSS")</script>',
      '?redirect=javascript:alert("XSS")',
      '&callback=alert'
    ];
    
    for (const payload of domPayloads) {
      const res = await client.request(`/api/products${payload}`);
      
      if (res.data.includes('alert') && !res.data.includes('&lt;')) {
        return {
          vulnerable: true,
          severity: 'medium',
          message: `Потенциальный DOM XSS: ${payload}`,
          details: `URL параметры могут быть опасны`
        };
      }
    }
    
    return { vulnerable: false, message: 'Защищен от DOM XSS' };
  });
}

// CSRF ТЕСТЫ
async function testCSRF(client) {
  logGroup('CSRF (CROSS-SITE REQUEST FORGERY) ТЕСТЫ');
  
  // Проверка CSRF токенов
  await test('CSRF токены проверка', async () => {
    // Попытка изменения без токена
    const res = await client.request('/api/products/1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://evil.com'
      },
      body: JSON.stringify({ price: 1 })
    });
    
    if (res.status === 404 || res.status === 405) {
      return { vulnerable: false, message: 'Метод не доступен (тест пропущен)' };
    }
    
    if (res.status === 200 || res.status === 201) {
      return {
        vulnerable: true,
        severity: 'high',
        message: 'CSRF защита отсутствует',
        details: 'Изменения возможны без CSRF токена'
      };
    }
    
    return { vulnerable: false, message: 'CSRF токены требуются' };
  });
  
  // Проверка SameSite cookies
  await test('SameSite Cookie защита', async () => {
    const res = await client.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test' })
    });
    
    if (res.status === 404) {
      return { vulnerable: false, message: 'Аутентификация не реализована (тест пропущен)' };
    }
    
    if (res.headers['set-cookie']) {
      const cookies = res.headers['set-cookie'];
      const hasSameSite = cookies.some(cookie => 
        cookie.toLowerCase().includes('samesite=strict') || 
        cookie.toLowerCase().includes('samesite=lax')
      );
      
      if (!hasSameSite) {
        return {
          vulnerable: true,
          severity: 'medium',
          message: 'Cookies без SameSite атрибута',
          details: 'Уязвимы к CSRF атакам'
        };
      }
    }
    
    return { vulnerable: false, message: 'SameSite cookies настроены' };
  });
}

// AUTHENTICATION/AUTHORIZATION ТЕСТЫ
async function testAuthSecurity(client) {
  logGroup('АУТЕНТИФИКАЦИЯ И АВТОРИЗАЦИЯ');
  
  // Тест brute force защиты
  await test('Защита от brute force', async () => {
    const attempts = 10;
    let blocked = false;
    
    for (let i = 0; i < attempts; i++) {
      const res = await client.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: 'admin', 
          password: `wrong${i}` 
        })
      });
      
      if (res.status === 404) {
        return { vulnerable: false, message: 'Аутентификация не реализована (тест пропущен)' };
      }
      
      if (res.status === 429 || res.data.includes('rate limit')) {
        blocked = true;
        break;
      }
    }
    
    if (!blocked) {
      return {
        vulnerable: true,
        severity: 'high',
        message: 'Нет защиты от brute force',
        details: `${attempts} попыток без блокировки`
      };
    }
    
    return { vulnerable: false, message: 'Rate limiting работает' };
  });
  
  // Тест слабых паролей
  await test('Проверка политики паролей', async () => {
    const weakPasswords = ['123456', 'password', 'admin', '12345678'];
    
    for (const password of weakPasswords) {
      const res = await client.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: password,
          email: 'test@example.com'
        })
      });
      
      if (res.status === 404) {
        return { vulnerable: false, message: 'Регистрация не реализована (тест пропущен)' };
      }
      
      if (res.status === 201 || res.status === 200) {
        return {
          vulnerable: true,
          severity: 'medium',
          message: 'Слабые пароли принимаются',
          details: `Пароль "${password}" был принят`
        };
      }
    }
    
    return { vulnerable: false, message: 'Политика паролей соблюдается' };
  });
  
  // Тест JWT безопасности
  await test('JWT токены безопасность', async () => {
    // Попытка использовать невалидный токен
    const fakeToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMn0.';
    
    const res = await client.request('/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${fakeToken}`
      }
    });
    
    if (res.status === 404) {
      return { vulnerable: false, message: 'Профиль не реализован (тест пропущен)' };
    }
    
    if (res.status === 200) {
      return {
        vulnerable: true,
        severity: 'critical',
        message: 'JWT без подписи принимается',
        details: 'Алгоритм "none" не должен быть разрешен'
      };
    }
    
    return { vulnerable: false, message: 'JWT валидация работает' };
  });
}

// INJECTION ТЕСТЫ (другие типы)
async function testOtherInjections(client) {
  logGroup('ДРУГИЕ ТИПЫ ИНЪЕКЦИЙ');
  
  // NoSQL Injection
  await test('NoSQL Injection защита', async () => {
    const nosqlPayloads = [
      '{"$gt": ""}',
      '{"$ne": null}',
      '{"$regex": ".*"}',
      '{"password": {"$ne": "wrong"}}'
    ];
    
    for (const payload of nosqlPayloads) {
      const res = await client.request('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      
      if (res.status === 200 && res.data.includes('"data":[')) {
        const data = JSON.parse(res.data);
        if (data.data && data.data.length > 50) {
          return {
            vulnerable: true,
            severity: 'high',
            message: 'NoSQL injection возможна',
            details: `Payload ${payload} вернул все записи`
          };
        }
      }
    }
    
    return { vulnerable: false, message: 'Защищен от NoSQL injection' };
  });
  
  // Command Injection
  await test('Command Injection защита', async () => {
    const cmdPayloads = [
      '; ls -la',
      '| whoami',
      '`cat /etc/passwd`',
      '$(sleep 5)',
      '; ping -c 5 127.0.0.1'
    ];
    
    for (const payload of cmdPayloads) {
      const startTime = Date.now();
      const res = await client.request(`/api/products/export?format=${encodeURIComponent(payload)}`);
      const duration = Date.now() - startTime;
      
      // Проверка на задержку (sleep injection)
      if (duration > 4000 && payload.includes('sleep')) {
        return {
          vulnerable: true,
          severity: 'critical',
          message: 'Command injection обнаружена',
          details: `Sleep команда выполнена`
        };
      }
      
      // Проверка на вывод системных данных
      if (res.data.includes('root:') || res.data.includes('bin:')) {
        return {
          vulnerable: true,
          severity: 'critical',
          message: 'Command injection обнаружена',
          details: `Системные файлы доступны`
        };
      }
    }
    
    return { vulnerable: false, message: 'Защищен от command injection' };
  });
  
  // Path Traversal
  await test('Path Traversal защита', async () => {
    const pathPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '../.env',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];
    
    for (const payload of pathPayloads) {
      const res = await client.request(`/api/files/${encodeURIComponent(payload)}`);
      
      if (res.data.includes('root:') || 
          res.data.includes('password') || 
          res.data.includes('API_KEY')) {
        return {
          vulnerable: true,
          severity: 'critical',
          message: 'Path traversal уязвимость',
          details: `Доступ к системным файлам: ${payload}`
        };
      }
    }
    
    return { vulnerable: false, message: 'Защищен от path traversal' };
  });
}

// SECURITY HEADERS ТЕСТЫ
async function testSecurityHeaders(client) {
  logGroup('HTTP SECURITY HEADERS');
  
  await test('Security Headers проверка', async () => {
    const res = await client.request('/api/products');
    const headers = res.headers;
    const missing = [];
    
    // Проверяем критичные заголовки
    const requiredHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': ['DENY', 'SAMEORIGIN'],
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': 'max-age=',
      'content-security-policy': ['default-src', 'script-src']
    };
    
    for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
      const headerValue = headers[header.toLowerCase()];
      
      if (!headerValue) {
        missing.push(header);
      } else if (Array.isArray(expectedValue)) {
        const hasValidValue = expectedValue.some(val => 
          headerValue.toLowerCase().includes(val.toLowerCase())
        );
        if (!hasValidValue) {
          missing.push(`${header} (неверное значение)`);
        }
      } else if (!headerValue.toLowerCase().includes(expectedValue.toLowerCase())) {
        missing.push(`${header} (неверное значение)`);
      }
    }
    
    if (missing.length > 0) {
      return {
        vulnerable: true,
        severity: 'medium',
        message: 'Отсутствуют security headers',
        details: `Не хватает: ${missing.join(', ')}`
      };
    }
    
    return { vulnerable: false, message: 'Все security headers настроены' };
  });
  
  // CORS проверка
  await test('CORS конфигурация', async () => {
    const res = await client.request('/api/products', {
      headers: {
        'Origin': 'http://evil.com'
      }
    });
    
    const allowOrigin = res.headers['access-control-allow-origin'];
    
    if (allowOrigin === '*') {
      return {
        vulnerable: true,
        severity: 'medium',
        message: 'CORS разрешает все домены',
        details: 'Access-Control-Allow-Origin: *'
      };
    }
    
    if (allowOrigin === 'http://evil.com') {
      return {
        vulnerable: true,
        severity: 'high',
        message: 'CORS принимает любой Origin',
        details: 'Отражает Origin заголовок'
      };
    }
    
    return { vulnerable: false, message: 'CORS настроен корректно' };
  });
}

// SENSITIVE DATA EXPOSURE ТЕСТЫ
async function testDataExposure(client) {
  logGroup('УТЕЧКА ЧУВСТВИТЕЛЬНЫХ ДАННЫХ');
  
  await test('Утечка в error messages', async () => {
    // Провоцируем ошибку
    const res = await client.request('/api/products/abc123xyz');
    
    if (res.data.includes('PostgreSQL') || 
        res.data.includes('stack') || 
        res.data.includes('at Function') ||
        res.data.includes('/home/') ||
        res.data.includes('C:\\Users\\')) {
      return {
        vulnerable: true,
        severity: 'medium',
        message: 'Stack trace в production',
        details: 'Технические детали видны пользователю'
      };
    }
    
    return { vulnerable: false, message: 'Ошибки не раскрывают детали' };
  });
  
  await test('Утечка в API responses', async () => {
    const res = await client.request('/api/products/1');
    
    if (res.status === 200) {
      const sensitiveFields = [
        'password', 'token', 'secret', 'api_key', 
        'private_key', 'credit_card', 'ssn'
      ];
      
      const dataStr = res.data.toLowerCase();
      for (const field of sensitiveFields) {
        if (dataStr.includes(field)) {
          return {
            vulnerable: true,
            severity: 'critical',
            message: 'Чувствительные данные в API',
            details: `Поле "${field}" найдено в ответе`
          };
        }
      }
    }
    
    return { vulnerable: false, message: 'Чувствительные данные скрыты' };
  });
  
  await test('Debug mode в production', async () => {
    const res = await client.request('/api/debug');
    
    if (res.status === 200) {
      return {
        vulnerable: true,
        severity: 'high',
        message: 'Debug endpoint доступен',
        details: 'Debug информация не должна быть в production'
      };
    }
    
    // Проверка debug headers
    const debugRes = await client.request('/api/products');
    if (debugRes.headers['x-debug'] || 
        debugRes.headers['x-powered-by']) {
      return {
        vulnerable: true,
        severity: 'low',
        message: 'Debug headers обнаружены',
        details: 'Раскрывают информацию о сервере'
      };
    }
    
    return { vulnerable: false, message: 'Debug mode отключен' };
  });
}

// Главная функция
async function runSecurityTests() {
  log('\n' + '='.repeat(60), 'bold');
  log('🛡️  ТЕСТЫ БЕЗОПАСНОСТИ MEDSIP.PROTEZ', 'bold');
  log('='.repeat(60), 'bold');
  log(`📍 URL: ${BASE_URL}`, 'blue');
  log(`⏱️  Timeout: ${TIMEOUT}ms`, 'blue');
  
  const startTime = Date.now();
  const client = new SecurityTestClient();
  
  // Проверяем доступность сервера
  try {
    await client.request('/api/health');
  } catch (error) {
    log('\n❌ СЕРВЕР НЕДОСТУПЕН!', 'red');
    log(`Убедитесь что сервер запущен на ${BASE_URL}`, 'yellow');
    process.exit(1);
  }
  
  // Запускаем тесты
  await testSQLInjection(client);
  await testXSS(client);
  await testCSRF(client);
  await testAuthSecurity(client);
  await testOtherInjections(client);
  await testSecurityHeaders(client);
  await testDataExposure(client);
  
  // Итоги
  const duration = Date.now() - startTime;
  
  log('\n' + '='.repeat(60), 'bold');
  log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ БЕЗОПАСНОСТИ', 'bold');
  log('='.repeat(60), 'bold');
  
  if (vulnerabilities.length > 0) {
    log('\n⚠️  ОБНАРУЖЕННЫЕ УЯЗВИМОСТИ:', 'red');
    
    const critical = vulnerabilities.filter(v => v.severity === 'critical');
    const high = vulnerabilities.filter(v => v.severity === 'high');
    const medium = vulnerabilities.filter(v => v.severity === 'medium');
    const low = vulnerabilities.filter(v => v.severity === 'low');
    
    if (critical.length > 0) {
      log('\n🔴 КРИТИЧЕСКИЕ:', 'red');
      critical.forEach(v => {
        log(`  • ${v.name}`, 'red');
        log(`    ${v.details}`, 'dim');
      });
    }
    
    if (high.length > 0) {
      log('\n🟠 ВЫСОКИЕ:', 'yellow');
      high.forEach(v => {
        log(`  • ${v.name}`, 'yellow');
        log(`    ${v.details}`, 'dim');
      });
    }
    
    if (medium.length > 0) {
      log('\n🟡 СРЕДНИЕ:', 'yellow');
      medium.forEach(v => {
        log(`  • ${v.name}`, 'yellow');
        log(`    ${v.details}`, 'dim');
      });
    }
    
    if (low.length > 0) {
      log('\n⚪ НИЗКИЕ:', 'dim');
      low.forEach(v => {
        log(`  • ${v.name}`, 'dim');
        log(`    ${v.details}`, 'dim');
      });
    }
  }
  
  log(`\n⏱️  Время выполнения: ${duration}ms`, 'blue');
  log(`📝 Всего тестов: ${totalTests}`, 'blue');
  log(`✅ Пройдено: ${passedTests}`, 'green');
  log(`❌ Провалено: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  
  const securityScore = totalTests > 0 
    ? Math.round((passedTests / totalTests) * 100) 
    : 0;
  
  log(`\n🛡️  Security Score: ${securityScore}%`, 
    securityScore >= 90 ? 'green' : 
    securityScore >= 70 ? 'yellow' : 'red'
  );
  
  if (vulnerabilities.length === 0) {
    log('\n🎉 КРИТИЧЕСКИХ УЯЗВИМОСТЕЙ НЕ ОБНАРУЖЕНО!', 'green');
  } else {
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    if (criticalCount > 0) {
      log(`\n🚨 ОБНАРУЖЕНО ${criticalCount} КРИТИЧЕСКИХ УЯЗВИМОСТЕЙ!`, 'red');
      log('Требуется немедленное исправление!', 'red');
    }
  }
  
  // Exit код
  process.exit(failedTests > 0 ? 1 : 0);
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  log('\n💥 Критическая ошибка:', 'red');
  console.error(error);
  process.exit(1);
});

// Запуск
runSecurityTests().catch(error => {
  log('\n💥 Ошибка выполнения тестов безопасности:', 'red');
  console.error(error);
  process.exit(1);
});