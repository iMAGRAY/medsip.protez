import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import os from 'os';

export async function GET() {
  const startTime = Date.now();
  
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

    // 3. Проверка проблемных таблиц
    if (health.checks.database.status === 'healthy') {
      try {
        // Проверяем дублирующие системы
        const duplicateCheck = await pool.query(`
          SELECT 
            'product_sizes vs product_variants' as issue,
            (SELECT COUNT(*) FROM product_sizes) as table1_count,
            (SELECT COUNT(*) FROM product_variants) as table2_count
        `);

        const row = duplicateCheck.rows[0];
        if (row.table1_count > 0 && row.table2_count > 0) {
          health.checks.tables.issues.push({
            type: 'duplicate_system',
            description: 'Обе таблицы product_sizes и product_variants содержат данные',
            recommendation: 'Выполните миграцию с product_sizes на product_variants'
          });
        }

        // Проверяем пустые таблицы
        const _emptyTables = await pool.query(`
          SELECT table_name
          FROM information_schema.tables t
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = t.table_name 
            AND column_name = 'id'
          )
          LIMIT 10
        `);

        // Проверяем legacy таблицы
        const legacyCheck = await pool.query(`
          SELECT COUNT(*) as count
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name LIKE '%_legacy'
        `);

        if (legacyCheck.rows[0].count > 0) {
          health.checks.tables.issues.push({
            type: 'legacy_tables',
            count: parseInt(legacyCheck.rows[0].count),
            description: 'Найдены устаревшие таблицы с суффиксом _legacy',
            recommendation: 'Мигрируйте данные и удалите legacy таблицы'
          });
        }

        health.checks.tables.status = health.checks.tables.issues.length > 0 ? 'warning' : 'healthy';

      } catch (tableError) {
        health.status = 'unhealthy'
        health.checks.tables = {
          status: 'unhealthy',
          issues: [],
          error: tableError.message
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