#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bright: '\x1b[1m'
};

class CredentialsFixer {
  constructor() {
    this.replacements = [
      {
        search: 'Q1w2e3r4t5!@',
        replace: 'process.env.POSTGRESQL_PASSWORD || ""',
        context: 'password'
      },
      {
        search: '212.113.118.141',
        replace: 'process.env.POSTGRESQL_HOST || "localhost"',
        context: 'host'
      },
      {
        search: 'gen_user',
        replace: 'process.env.POSTGRESQL_USER || "postgres"',
        context: 'user'
      }
    ];

    this.fixedFiles = [];
    this.errors = [];
  }

  async fixFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      let changes = [];

      for (const { search, replace, context } of this.replacements) {
        if (content.includes(search)) {
          // Для строк подключения к БД
          if (content.includes(`"${search}"`)) {
            content = content.replace(new RegExp(`"${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'), replace);
            modified = true;
            changes.push(`${context}: "${search}" → ${replace}`);
          }
          // Для отдельных значений в конфигурации
          else if (content.includes(`'${search}'`)) {
            content = content.replace(new RegExp(`'${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'), replace);
            modified = true;
            changes.push(`${context}: '${search}' → ${replace}`);
          }
          // Для объектов конфигурации с прямыми значениями
          else {
            // Осторожная замена только в контексте конфигурации БД
            const patterns = [
              `host: "${search}"`,
              `user: "${search}"`,
              `password: "${search}"`,
              `host: '${search}'`,
              `user: '${search}'`,
              `password: '${search}'`
            ];

            for (const pattern of patterns) {
              if (content.includes(pattern)) {
                const newPattern = pattern.replace(new RegExp(`["']${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`), replace);
                content = content.replace(pattern, newPattern);
                modified = true;
                changes.push(`${context}: ${pattern} → ${newPattern}`);
              }
            }
          }
        }
      }

      if (modified) {
        // Добавляем проверку dotenv если его нет
        if (!content.includes('require(\'dotenv\')') && !content.includes('from \'dotenv\'')) {
          if (content.includes('const ') || content.includes('require(')) {
            const firstRequire = content.indexOf('require(');
            if (firstRequire !== -1) {
              const insertPoint = content.lastIndexOf('\n', firstRequire) + 1;
              content = content.slice(0, insertPoint) +
                      "require('dotenv').config();\n" +
                      content.slice(insertPoint);
            }
          }
        }

        fs.writeFileSync(filePath, content, 'utf8');
        this.fixedFiles.push({ path: filePath, changes });
        changes.forEach(change => console.log(`   ${colors.blue}→ ${change}${colors.reset}`));
      }

    } catch (error) {
      this.errors.push({ path: filePath, error: error.message });
    }
  }

  getFilesToFix() {
    const files = [];
    const excludeFiles = [
      'scripts/security-audit.js',
      'scripts/fix-all-hardcoded-credentials.js'
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
          if (['.js', '.ts', '.tsx'].includes(ext)) {
            const normalizedPath = fullPath.replace(/\\/g, '/');
            if (!excludeFiles.includes(normalizedPath)) {
              files.push(fullPath);
            }
          }
        }
      }
    };

    scanDir('.');
    return files;
  }

  async run() {
    const files = this.getFilesToFix();
    for (const file of files) {
      await this.fixFile(file);
    }

    console.log('\n' + '='.repeat(60));
    console.log('='.repeat(60));

    if (this.fixedFiles.length > 0) {
      this.fixedFiles.forEach(({ path, changes }) => {
      });
    } else {
    }

    if (this.errors.length > 0) {
      this.errors.forEach(({ path, error }) => {
      });
    }
    console.log('\n' + '='.repeat(60));
  }
}

// Запуск исправления
if (require.main === module) {
  const fixer = new CredentialsFixer();
  fixer.run().catch(error => {
    console.error(`${colors.red}Критическая ошибка: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = CredentialsFixer;