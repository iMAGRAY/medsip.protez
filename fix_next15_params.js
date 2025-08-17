#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Найти все файлы с динамическими маршрутами
const findDynamicRoutes = () => {
  try {
    const result = execSync('find app/api -type f -name "route.ts" | grep "\\["', { encoding: 'utf8' });
    return result.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    console.error('Error finding dynamic routes:', error.message);
    return [];
  }
};

// Исправить один файл
const fixFile = (filePath) => {
  try {
    console.log(`Fixing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Паттерны для замены
    const patterns = [
      {
        from: /\{ params \}: \{ params: \{ id: string \} \}/g,
        to: '{ params }: { params: Promise<{ id: string }> }'
      },
      {
        from: /\{ params \}: \{ params: \{ itemId: string \} \}/g,
        to: '{ params }: { params: Promise<{ itemId: string }> }'
      },
      {
        from: /\{ params \}: \{ params: \{ tagId: string \} \}/g,
        to: '{ params }: { params: Promise<{ tagId: string }> }'
      },
      {
        from: /\{ params \}: \{ params: \{ table: string \} \}/g,
        to: '{ params }: { params: Promise<{ table: string }> }'
      },
      {
        from: /\{ params \}: \{ params: \{ id: string; itemId: string \} \}/g,
        to: '{ params }: { params: Promise<{ id: string; itemId: string }> }'
      }
    ];

    // Применить замены типов
    patterns.forEach(pattern => {
      if (pattern.from.test(content)) {
        content = content.replace(pattern.from, pattern.to);
        modified = true;
      }
    });

    // Найти и заменить использование params.id, params.itemId и т.д.
    const usagePatterns = [
      {
        from: /const\s+(\w+)\s*=\s*parseInt\(params\.id\)/g,
        to: (match, varName) => `const resolvedParams = await params\n    const ${varName} = parseInt(resolvedParams.id)`
      },
      {
        from: /const\s+(\w+)\s*=\s*params\.id/g,
        to: (match, varName) => `const resolvedParams = await params\n    const ${varName} = resolvedParams.id`
      },
      {
        from: /const\s+(\w+)\s*=\s*parseInt\(params\.itemId\)/g,
        to: (match, varName) => `const resolvedParams = await params\n    const ${varName} = parseInt(resolvedParams.itemId)`
      },
      {
        from: /const\s+(\w+)\s*=\s*params\.itemId/g,
        to: (match, varName) => `const resolvedParams = await params\n    const ${varName} = resolvedParams.itemId`
      },
      {
        from: /const\s+(\w+)\s*=\s*params\.tagId/g,
        to: (match, varName) => `const resolvedParams = await params\n    const ${varName} = resolvedParams.tagId`
      },
      {
        from: /const\s+(\w+)\s*=\s*params\.table/g,
        to: (match, varName) => `const resolvedParams = await params\n    const ${varName} = resolvedParams.table`
      }
    ];

    // Применить замены использования
    usagePatterns.forEach(pattern => {
      if (pattern.from.test(content)) {
        content = content.replace(pattern.from, pattern.to);
        modified = true;
      }
    });

    // Обработать случаи с множественными параметрами
    if (content.includes('params.id') && content.includes('params.itemId')) {
      // Заменить прямое использование params на resolvedParams
      content = content.replace(/params\.id/g, 'resolvedParams.id');
      content = content.replace(/params\.itemId/g, 'resolvedParams.itemId');
      
      // Добавить await params в начало функции если его нет
      if (!content.includes('resolvedParams = await params')) {
        content = content.replace(
          /(export async function \w+\([^)]+\) \{\s*try \{)/,
          '$1\n    const resolvedParams = await params'
        );
      }
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️  No changes needed for ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
};

// Главная функция
const main = () => {
  console.log('🔧 Fixing Next.js 15 async params...\n');
  
  const dynamicRoutes = findDynamicRoutes();
  console.log(`Found ${dynamicRoutes.length} dynamic route files\n`);
  
  let fixedCount = 0;
  dynamicRoutes.forEach(filePath => {
    if (fixFile(filePath)) {
      fixedCount++;
    }
  });
  
  console.log(`\n✨ Fixed ${fixedCount} files out of ${dynamicRoutes.length} total`);
  console.log('🎉 Next.js 15 async params migration complete!');
};

if (require.main === module) {
  main();
}

module.exports = { fixFile, findDynamicRoutes };