#!/usr/bin/env node

/**
 * Применение performance индексов в базе данных
 * Запуск: node database/apply-indexes.js
 */

const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Прямое использование pg без TypeScript модуля
const { Pool } = require('pg');

// Создаем простое подключение для применения индексов
let pool;

function getPool() {
  if (!pool) {
    const config = {
      connectionString: process.env.DATABASE_URL || undefined,
      host: process.env.DB_HOST || process.env.POSTGRESQL_HOST || "localhost",
      port: Number(process.env.DB_PORT || process.env.POSTGRESQL_PORT || 5432),
      user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
      password: process.env.DB_PASSWORD || process.env.POSTGRESQL_PASSWORD || "",
      database: process.env.DB_NAME || process.env.POSTGRESQL_DBNAME || "medsip_protez",
      max: 5, // Небольшой pool для скрипта
      ssl: (process.env.PGSSL === "true" || process.env.DATABASE_SSL === "true") ? { rejectUnauthorized: false } : undefined,
    };
    
    pool = new Pool(config);
  }
  return pool;
}

async function executeQuery(query, params = []) {
  const client = getPool();
  return await client.query(query, params);
}

async function testConnection() {
  try {
    await executeQuery('SELECT 1');
    return true;
  } catch (error) {
    console.error('Connection test failed:', error.message);
    return false;
  }
}

async function applyIndexes() {
  console.log('🏗️  Применение performance индексов...');
  
  try {
    // Проверяем подключение к базе данных
    console.log('📡 Проверка подключения к базе данных...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Не удалось подключиться к базе данных');
      process.exit(1);
    }
    
    console.log('✅ Подключение к базе данных успешно');
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'performance-indexes.sql');
    console.log(`📄 Читаем SQL файл: ${sqlPath}`);
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Разбиваем на отдельные команды
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`📋 Найдено ${commands.length} SQL команд`);
    
    // Выполняем команды по одной
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      // Пропускаем комментарии
      if (command.startsWith('--') || command.trim() === '') {
        continue;
      }
      
      try {
        console.log(`⏳ Выполнение команды ${i + 1}/${commands.length}...`);
        
        if (command.includes('CREATE INDEX')) {
          const indexName = command.match(/idx_[a-zA-Z0-9_]+/);
          console.log(`   📊 Создание индекса: ${indexName ? indexName[0] : 'unknown'}`);
        }
        
        await executeQuery(command + ';');
        successCount++;
        console.log(`   ✅ Команда ${i + 1} выполнена успешно`);
        
      } catch (error) {
        errorCount++;
        
        // Игнорируем ошибки о существующих индексах
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  Команда ${i + 1}: индекс уже существует`);
          successCount++;
          errorCount--;
        } else {
          console.error(`   ❌ Ошибка в команде ${i + 1}:`, error.message);
        }
      }
    }
    
    console.log('\n📊 Результаты применения индексов:');
    console.log(`✅ Успешно: ${successCount}`);
    console.log(`❌ Ошибки: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Все индексы успешно применены!');
      console.log('📈 Производительность базы данных должна улучшиться');
    } else {
      console.log('\n⚠️  Некоторые индексы не были созданы из-за ошибок');
    }
    
    // Запускаем ANALYZE для обновления статистики
    console.log('\n📊 Обновление статистики таблиц...');
    
    const tables = [
      'products', 
      'product_variants', 
      'product_characteristics_simple',
      'characteristics_values_simple',
      'characteristics_groups_simple',
      'product_categories',
      'manufacturers',
      'model_series'
    ];
    
    for (const table of tables) {
      try {
        await executeQuery(`ANALYZE ${table}`);
        console.log(`   ✅ ${table} проанализирована`);
      } catch (error) {
        console.log(`   ⚠️  ${table}: ${error.message}`);
      }
    }
    
    console.log('\n🏁 Применение индексов завершено');
    
  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запускаем применение индексов
applyIndexes().catch(error => {
  console.error('💥 Ошибка выполнения скрипта:', error);
  process.exit(1);
});