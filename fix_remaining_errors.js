#!/usr/bin/env node

const fs = require('fs');

// Список файлов с конкретными исправлениями
const fixes = [
  {
    file: 'app/api/product-specifications/[id]/route.ts',
    replacements: [
      { from: 'params.id', to: 'resolvedParams.id' },
    ],
    addAwait: true
  },
  {
    file: 'app/api/sql-table/[table]/route.ts', 
    replacements: [
      { from: 'params.table', to: 'resolvedParams.table' },
    ],
    addAwait: true
  },
  {
    file: 'app/api/variants/[id]/tags/route.ts',
    replacements: [
      { from: 'params.id', to: 'resolvedParams.id' },
    ],
    addAwait: true
  },
  {
    file: 'app/api/warehouse/sections/[id]/route.ts',
    replacements: [
      { from: 'params.id', to: 'resolvedParams.id' },
    ],
    addAwait: true
  }
];

fixes.forEach(fix => {
  try {
    console.log(`Fixing ${fix.file}...`);
    let content = fs.readFileSync(fix.file, 'utf8');
    
    // Добавить await params если нужно
    if (fix.addAwait && !content.includes('resolvedParams = await params')) {
      // Найти первое использование params. и добавить await перед ним
      const lines = content.split('\n');
      let added = false;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('params.') && !added) {
          // Найти отступ
          const indent = lines[i].match(/^(\s*)/)[1];
          lines.splice(i, 0, `${indent}const resolvedParams = await params`);
          added = true;
          break;
        }
      }
      
      content = lines.join('\n');
    }
    
    // Применить замены
    fix.replacements.forEach(replacement => {
      content = content.replace(new RegExp(replacement.from, 'g'), replacement.to);
    });
    
    fs.writeFileSync(fix.file, content, 'utf8');
    console.log(`✅ Fixed ${fix.file}`);
  } catch (error) {
    console.error(`❌ Error fixing ${fix.file}:`, error.message);
  }
});

console.log('🎉 Manual fixes complete!');