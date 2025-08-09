const fs = require('fs');
const path = require('path');

// Массив замен для исправления API endpoints
const replacements = [
  {
    from: 'FROM spec_groups',
    to: 'FROM characteristics_groups_simple'
  },
  {
    from: 'FROM spec_enums',
    to: 'FROM characteristics_values_simple'
  },
  {
    from: 'JOIN spec_groups',
    to: 'JOIN characteristics_groups_simple'
  },
  {
    from: 'JOIN spec_enums',
    to: 'JOIN characteristics_values_simple'
  },
  {
    from: 'spec_groups sg',
    to: 'characteristics_groups_simple sg'
  },
  {
    from: 'spec_enums se',
    to: 'characteristics_values_simple se'
  }
];

// Функция для рекурсивного поиска файлов
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Пропускаем node_modules и .git
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        findFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Функция для замены текста в файле
function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(replacement => {
    if (content.includes(replacement.from)) {
      content = content.replace(new RegExp(replacement.from, 'g'), replacement.to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Обновлен файл: ${filePath}`);
    return true;
  }
  
  return false;
}

// Основная функция
function main() {
  console.log('🔍 Поиск файлов для обновления...\n');
  
  // Ищем файлы в директориях app, lib, components, services
  const directories = ['app', 'lib', 'components', 'services'];
  let allFiles = [];
  
  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = findFiles(dir);
      allFiles = allFiles.concat(files);
    }
  });
  
  console.log(`📁 Найдено ${allFiles.length} файлов для проверки\n`);
  
  let updatedCount = 0;
  
  // Обрабатываем каждый файл
  allFiles.forEach(filePath => {
    if (replaceInFile(filePath)) {
      updatedCount++;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`✨ Обновление завершено!`);
  console.log(`📊 Обновлено файлов: ${updatedCount}`);
  console.log('='.repeat(50));
  
  if (updatedCount > 0) {
    console.log('\n⚠️  Рекомендации:');
    console.log('1. Перезапустите сервер разработки');
    console.log('2. Проверьте работу API endpoints');
    console.log('3. Убедитесь, что все представления созданы в БД');
  }
}

// Запускаем скрипт
main();