#!/usr/bin/env node

const fs = require('fs');

// Исправить sql-table/[table]/route.ts
try {
  const filePath = 'app/api/sql-table/[table]/route.ts';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Заменить params.table на resolvedParams.table
  content = content.replace(/params\.table/g, 'resolvedParams.table');
  
  // Добавить const resolvedParams = await params перед первым использованием
  if (!content.includes('resolvedParams = await params')) {
    content = content.replace(
      /(try\s*\{[^}]*?)(\s+if\s*\([^)]*resolvedParams\.table)/,
      '$1\n    const resolvedParams = await params$2'
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed sql-table/[table]/route.ts');
} catch (error) {
  console.error('❌ Error fixing sql-table:', error.message);
}

// Исправить variants/[id]/tags/route.ts
try {
  const filePath = 'app/api/variants/[id]/tags/route.ts';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Найти место где используется resolvedParams.id без объявления
  const lines = content.split('\n');
  let functionStart = -1;
  let needsAwait = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export async function') && lines[i].includes('params')) {
      functionStart = i;
    }
    if (lines[i].includes('resolvedParams.id') && functionStart > -1) {
      needsAwait = i;
      break;
    }
  }
  
  if (needsAwait > -1 && functionStart > -1) {
    // Найти начало try блока после функции
    for (let i = functionStart; i < needsAwait; i++) {
      if (lines[i].includes('try {')) {
        const indent = lines[i].match(/^(\s*)/)[1];
        lines.splice(i + 1, 0, `${indent}  const resolvedParams = await params`);
        break;
      }
    }
  }
  
  content = lines.join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed variants/[id]/tags/route.ts');
} catch (error) {
  console.error('❌ Error fixing variants/tags:', error.message);
}

// Исправить warehouse/sections/[id]/route.ts
try {
  const filePath = 'app/api/warehouse/sections/[id]/route.ts';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Заменить params.id на resolvedParams.id
  content = content.replace(/params\.id/g, 'resolvedParams.id');
  
  // Добавить await params в каждую функцию
  content = content.replace(
    /(export async function \w+\([^)]+\) \{\s*try \{)/g,
    '$1\n    const resolvedParams = await params'
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed warehouse/sections/[id]/route.ts');
} catch (error) {
  console.error('❌ Error fixing warehouse/sections:', error.message);
}

console.log('🎉 Specific fixes complete!');