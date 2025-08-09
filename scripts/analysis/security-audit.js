#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  critical: (msg) => console.log(`${colors.red}${colors.bright}🚨 КРИТИЧНО: ${msg}${colors.reset}`)
};

class SecurityAuditor {
  constructor() {
    this.issues = {
      critical: [],
      warning: [],
      info: []
    };
  }

  // Проверка переменных окружения
  checkEnvironmentSecurity() {
    log.info('Проверка безопасности переменных окружения...');

    const requiredEnvVars = [
      'DATABASE_URL',
      'ADMIN_USERNAME',
      'ADMIN_PASSWORD',
      'JWT_SECRET',
      'SESSION_SECRET'
    ];

    const envExamplePath = '.env.example';
    const envLocalPath = '.env.local';

    // Проверяем наличие .env.example
    if (!fs.existsSync(envExamplePath)) {
      this.issues.critical.push('Отсутствует файл .env.example');
    } else {
      log.success('Файл .env.example найден');
    }

    // Проверяем наличие .env.local
    if (!fs.existsSync(envLocalPath)) {
      this.issues.warning.push('Отсутствует файл .env.local - создайте его на основе .env.example');
    }

    // Проверяем hardcoded credentials
    this.checkHardcodedCredentials();
  }

  // Поиск захардкоженных учетных данных
  checkHardcodedCredentials() {
    log.info('Поиск захардкоженных учетных данных...');

    const dangerousPatterns = [
      'Q1w2e3r4t5!@',
      '212.113.118.141',
      'gen_user',
      'admin123',
      'password123'
    ];

    const filesToCheck = this.getFilesToScan(['.ts', '.tsx', '.js', '.jsx']);
    let foundIssues = 0;

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of dangerousPatterns) {
        if (content.includes(pattern)) {
          this.issues.critical.push(`Захардкоженные данные в ${file}: найден '${pattern}'`);
          foundIssues++;
        }
      }
    }

    if (foundIssues === 0) {
      log.success('Захардкоженные учетные данные не найдены');
    }
  }

  // Проверка конфигурационных файлов
  checkConfigurationSecurity() {
    log.info('Проверка безопасности конфигурации...');

    // Проверяем next.config.mjs
    this.checkNextConfig();

    // Проверяем tsconfig.json
    this.checkTsConfig();

    // Проверяем package.json
    this.checkPackageJson();
  }

  checkNextConfig() {
    const configPath = 'next.config.mjs';
    if (!fs.existsSync(configPath)) {
      this.issues.warning.push('Файл next.config.mjs не найден');
      return;
    }

    const content = fs.readFileSync(configPath, 'utf8');

    if (content.includes('ignoreDuringBuilds: true')) {
      this.issues.critical.push('ESLint отключен при сборке (ignoreDuringBuilds: true)');
    }

    if (content.includes('ignoreBuildErrors: true')) {
      this.issues.critical.push('TypeScript ошибки игнорируются при сборке (ignoreBuildErrors: true)');
    }

    if (content.includes('dangerouslyAllowSVG: true')) {
      this.issues.warning.push('Разрешено небезопасное использование SVG (dangerouslyAllowSVG: true)');
    }

    log.success('Конфигурация Next.js проверена');
  }

  checkTsConfig() {
    const configPath = 'tsconfig.json';
    if (!fs.existsSync(configPath)) {
      this.issues.warning.push('Файл tsconfig.json не найден');
      return;
    }

    try {
      const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const compilerOptions = content.compilerOptions || {};

      if (compilerOptions.useUnknownInCatchVariables === false) {
        this.issues.warning.push('Отключена строгая проверка типов в catch блоках');
      }

      if (!compilerOptions.strict) {
        this.issues.warning.push('Отключен строгий режим TypeScript');
      }

      log.success('Конфигурация TypeScript проверена');
    } catch (error) {
      this.issues.error.push('Ошибка парсинга tsconfig.json');
    }
  }

  checkPackageJson() {
    const packagePath = 'package.json';
    if (!fs.existsSync(packagePath)) {
      this.issues.critical.push('Файл package.json не найден');
      return;
    }

    try {
      const content = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const deps = { ...content.dependencies, ...content.devDependencies };

      // Проверяем на "latest" версии
      let latestCount = 0;
      for (const [name, version] of Object.entries(deps)) {
        if (version === 'latest') {
          this.issues.warning.push(`Пакет ${name} использует нефиксированную версию "latest"`);
          latestCount++;
        }
      }

      if (latestCount === 0) {
        log.success('Все зависимости имеют фиксированные версии');
      }

      // Проверяем дублирование AWS SDK
      if (deps['aws-sdk'] && deps['@aws-sdk/client-s3']) {
        this.issues.warning.push('Обнаружено дублирование AWS SDK (v2 и v3)');
      }

      log.success('package.json проверен');
    } catch (error) {
      this.issues.critical.push('Ошибка парсинга package.json');
    }
  }

  // Проверка Git статуса
  checkGitStatus() {
    log.info('Проверка статуса Git...');

    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        const lines = status.trim().split('\n');
        this.issues.warning.push(`Незакоммиченные изменения (${lines.length} файлов)`);
        lines.forEach(line => {
          this.issues.info.push(`Git: ${line}`);
        });
      } else {
        log.success('Все изменения закоммичены');
      }
    } catch (error) {
      this.issues.warning.push('Не удается проверить статус Git');
    }
  }

  // Проверка зависимостей на уязвимости
  checkDependencyVulnerabilities() {
    log.info('Проверка зависимостей на уязвимости...');

    try {
      execSync('npm audit --audit-level=moderate', { stdio: 'pipe' });
      log.success('Критических уязвимостей в зависимостях не найдено');
    } catch (error) {
      this.issues.warning.push('Обнаружены уязвимости в зависимостях. Запустите: npm audit');
    }
  }

  // Проверка неиспользуемых зависимостей
  checkUnusedDependencies() {
    log.info('Проверка неиспользуемых зависимостей...');

    try {
      const result = execSync('npx depcheck --json', { encoding: 'utf8' });
      const depcheck = JSON.parse(result);

      if (depcheck.dependencies.length > 0) {
        this.issues.info.push(`Неиспользуемые зависимости: ${depcheck.dependencies.join(', ')}`);
      }

      if (depcheck.devDependencies.length > 0) {
        this.issues.info.push(`Неиспользуемые dev-зависимости: ${depcheck.devDependencies.join(', ')}`);
      }

      if (depcheck.dependencies.length === 0 && depcheck.devDependencies.length === 0) {
        log.success('Неиспользуемые зависимости не найдены');
      }
    } catch (error) {
      this.issues.info.push('Не удается проверить неиспользуемые зависимости');
    }
  }

  // Проверка качества кода
  checkCodeQuality() {
    log.info('Проверка качества кода...');

    try {
      execSync('npm run type-check', { stdio: 'pipe' });
      log.success('Проверка типов TypeScript прошла успешно');
    } catch (error) {
      this.issues.warning.push('Обнаружены ошибки TypeScript. Запустите: npm run type-check');
    }

    try {
      execSync('npm run lint', { stdio: 'pipe' });
      log.success('ESLint проверка прошла успешно');
    } catch (error) {
      this.issues.warning.push('Обнаружены проблемы ESLint. Запустите: npm run lint');
    }
  }

  // Получение списка файлов для сканирования
  getFilesToScan(extensions) {
    const files = [];
    const excludeFiles = [
      'scripts/security-audit.js',  // Исключаем сам скрипт
      'scripts/fix-all-hardcoded-credentials.js'  // Исключаем скрипт исправления
    ];

    const scanDir = (dir) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !['node_modules', '.next', '.git', 'dist', 'build'].includes(item)) {
          scanDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext) && !excludeFiles.includes(fullPath.replace(/\\/g, '/'))) {
            files.push(fullPath);
          }
        }
      }
    };

    scanDir('.');
    return files;
  }

  // Генерация отчета
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('='.repeat(60));

    const totalIssues = this.issues.critical.length + this.issues.warning.length + this.issues.info.length;

    if (totalIssues === 0) {
      log.success('Проблем не обнаружено! Проект соответствует стандартам безопасности.');
      return 0;
    }

    // Критические проблемы
    if (this.issues.critical.length > 0) {
      this.issues.critical.forEach((issue, i) => {
      });
    }

    // Предупреждения
    if (this.issues.warning.length > 0) {
      this.issues.warning.forEach((issue, i) => {
      });
    }

    // Информационные сообщения
    if (this.issues.info.length > 0) {
      this.issues.info.forEach((issue, i) => {
      });
    }

    // Рекомендации
    console.log('\n' + '='.repeat(60));

    // Возвращаем код выхода
    return this.issues.critical.length > 0 ? 1 : 0;
  }

  // Основной метод аудита
  async runAudit() {
    this.checkEnvironmentSecurity();
    this.checkConfigurationSecurity();
    this.checkGitStatus();
    this.checkDependencyVulnerabilities();
    this.checkUnusedDependencies();
    this.checkCodeQuality();

    const exitCode = this.generateReport();
    process.exit(exitCode);
  }
}

// Запуск аудита
if (require.main === module) {
  const auditor = new SecurityAuditor();
  auditor.runAudit().catch(error => {
    console.error(`${colors.red}Ошибка выполнения аудита: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = SecurityAuditor;