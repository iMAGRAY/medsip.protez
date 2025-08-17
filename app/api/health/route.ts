import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import os from 'os';

export async function GET() {
  const startTime = Date.now();
  
  // Fast path - minimal health check
  const quickCheck = process.env.QUICK_HEALTH_CHECK === 'true';
  
  if (quickCheck) {
    try {
      // Just ping the database
      await pool.query('SELECT 1');
      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      }, { status: 200 });
    } catch (error) {
      return NextResponse.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: 'Database unavailable'
      }, { status: 503 });
    }
  }
  
  const health: {
    status: string;
    timestamp: string;
    uptime: number;
    responseTime?: number;
    checks: {
      database: { 
        status: string; 
        latency: number;
        database?: string;
        time?: any;
        error?: string;
      };
      memory: { status: string; usage: any };
      disk: { status: string; usage: any };
      tables: { 
        status: string; 
        issues: Array<{
          type: string;
          count?: number;
          description: string;
          recommendation: string;
        }>;
        error?: string;
      };
    };
    environment: {
      node: string;
      platform: string;
      env: string;
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: 'unknown', latency: 0 },
      memory: { status: 'unknown', usage: {} },
      disk: { status: 'unknown', usage: {} },
      tables: { status: 'unknown', issues: [] }
    },
    environment: {
      node: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development'
    }
  };

  try {
    // 1. Проверка базы данных
    const dbStart = Date.now();
    try {
      const result = await pool.query('SELECT NOW() as time, current_database() as db');
      health.checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
        database: result.rows[0].db,
        time: result.rows[0].time
      };
    } catch (dbError) {
      health.status = 'unhealthy';
      health.checks.database = {
        status: 'unhealthy',
        error: dbError.message,
        latency: Date.now() - dbStart
      };
    }

    // 2. Проверка памяти
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;

    health.checks.memory = {
      status: memUsagePercent > 90 ? 'warning' : 'healthy',
      usage: {
        total: formatBytes(totalMem),
        used: formatBytes(usedMem),
        free: formatBytes(freeMem),
        percent: Math.round(memUsagePercent)
      }
    };

    // 3. Быстрая проверка основных таблиц
    if (health.checks.database.status === 'healthy') {
      try {
        // Проверяем только существование основных таблиц
        const basicCheck = await pool.query(`
          SELECT 
            EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'products') as products_exists,
            EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') as categories_exists
        `);

        const row = basicCheck.rows[0];
        if (!row.products_exists) {
          health.checks.tables.issues.push({
            type: 'missing_table',
            description: 'Таблица products не найдена',
            recommendation: 'Проверьте миграции базы данных'
          });
        }

        health.checks.tables.status = health.checks.tables.issues.length > 0 ? 'warning' : 'healthy';

      } catch (tableError) {
        health.checks.tables = {
          status: 'healthy', // Не блокируем health check из-за проблем с таблицами
          issues: []
        }
      }
    }

    // 4. Общий статус
    if (health.checks.database.status === 'unhealthy') {
      health.status = 'unhealthy';
    } else if (health.checks.memory.status === 'warning' || health.checks.tables.status === 'warning') {
      health.status = 'degraded';
    }

    // Добавляем время ответа
    health.responseTime = Date.now() - startTime;

    // Возвращаем соответствующий HTTP статус
    const httpStatus = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: httpStatus });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime
    }, { status: 503 });
  }
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}