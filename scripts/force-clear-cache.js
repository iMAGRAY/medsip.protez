const fs = require('fs');
const path = require('path');

console.log('=== FORCE CLEARING ALL CACHES ===\n');

// 1. Очистка .next/cache
const nextCachePath = path.join(process.cwd(), '.next', 'cache');
if (fs.existsSync(nextCachePath)) {
  try {
    fs.rmSync(nextCachePath, { recursive: true, force: true });
    console.log('✅ Cleared .next/cache directory');
  } catch (err) {
    console.log('⚠️ Could not clear .next/cache:', err.message);
  }
} else {
  console.log('ℹ️ .next/cache directory not found');
}

// 2. Очистка .next/server
const nextServerPath = path.join(process.cwd(), '.next', 'server');
if (fs.existsSync(nextServerPath)) {
  try {
    fs.rmSync(nextServerPath, { recursive: true, force: true });
    console.log('✅ Cleared .next/server directory');
  } catch (err) {
    console.log('⚠️ Could not clear .next/server:', err.message);
  }
} else {
  console.log('ℹ️ .next/server directory not found');
}

// 3. Попытка подключения к Redis для очистки
const redis = require('ioredis');
const client = new redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: () => null, // Не пытаемся переподключиться
  enableOfflineQueue: false
});

client.on('ready', async () => {
  try {
    await client.flushall();
    console.log('✅ Cleared Redis cache');
  } catch (err) {
    console.log('⚠️ Could not clear Redis:', err.message);
  } finally {
    client.disconnect();
  }
});

client.on('error', (err) => {
  console.log('ℹ️ Redis not available - skipping Redis cache clear');
  client.disconnect();
});

// 4. Очистка временных файлов
setTimeout(() => {
  console.log('\n=== CACHE CLEAR COMPLETE ===');
  console.log('');
  console.log('⚠️ IMPORTANT: You need to restart the Next.js dev server for changes to take effect!');
  console.log('');
  console.log('Run these commands:');
  console.log('1. Stop the server (Ctrl+C or close terminal)');
  console.log('2. npm run dev');
  console.log('');
  process.exit(0);
}, 2000);