// Конфигурация для продакшен окружения

export const productionConfig = {
  // База данных
  database: {
    // Используем пул соединений для оптимизации
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    // SSL для безопасности
    ssl: {
      rejectUnauthorized: false // В продакшене должно быть true с валидным сертификатом
    }
  },

  // Кэширование
  cache: {
    // Redis конфигурация
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'prosthetic:',
    },
    // TTL для разных типов данных (в секундах)
    ttl: {
      products: 3600,        // 1 час
      categories: 7200,      // 2 часа
      characteristics: 7200, // 2 часа
      manufacturers: 7200,   // 2 часа
      siteSettings: 86400,   // 24 часа
      userSession: 3600,     // 1 час
    }
  },

  // Безопасность
  security: {
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 минут
      max: 100, // максимум запросов с одного IP
      message: 'Слишком много запросов с этого IP, попробуйте позже',
      // Специальные лимиты для разных endpoints
      endpoints: {
        '/api/auth/login': { windowMs: 15 * 60 * 1000, max: 5 },
        '/api/auth/register': { windowMs: 60 * 60 * 1000, max: 3 },
        '/api/upload': { windowMs: 60 * 60 * 1000, max: 20 },
      }
    },
    // CORS
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://prosthetic-store.ru'],
      credentials: true,
      maxAge: 86400,
    },
    // Заголовки безопасности
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    },
    // JWT
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: '7d',
      refreshExpiresIn: '30d',
    }
  },

  // Производительность
  performance: {
    // Сжатие
    compression: {
      level: 6,
      threshold: 1024, // байт
    },
    // Оптимизация изображений
    images: {
      quality: 85,
      formats: ['webp', 'jpg'],
      sizes: {
        thumbnail: { width: 150, height: 150 },
        small: { width: 300, height: 300 },
        medium: { width: 600, height: 600 },
        large: { width: 1200, height: 1200 },
      },
      // Lazy loading
      lazyLoadOffset: 50,
    },
    // Пагинация
    pagination: {
      defaultPageSize: 20,
      maxPageSize: 100,
    }
  },

  // Логирование
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    // Форматы логов
    formats: {
      production: 'json',
      development: 'pretty',
    },
    // Что логировать
    logRequests: true,
    logErrors: true,
    logDatabase: false, // В продакшене обычно выключено
    // Куда отправлять логи
    transports: {
      console: true,
      file: {
        enabled: true,
        filename: 'logs/app.log',
        maxSize: '20m',
        maxFiles: 5,
      },
      // Внешние сервисы (Sentry, LogRocket и т.д.)
      external: {
        sentry: {
          enabled: true,
          dsn: process.env.SENTRY_DSN,
        }
      }
    }
  },

  // Мониторинг
  monitoring: {
    // Health checks
    healthCheck: {
      enabled: true,
      path: '/health',
      checks: {
        database: true,
        redis: true,
        disk: true,
        memory: true,
      }
    },
    // Метрики
    metrics: {
      enabled: true,
      path: '/metrics',
      collectDefaultMetrics: true,
      // Кастомные метрики
      custom: {
        httpRequestDuration: true,
        databaseQueryDuration: true,
        cacheHitRate: true,
      }
    }
  },

  // Email
  email: {
    provider: 'smtp', // или 'sendgrid', 'mailgun', etc.
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    },
    from: {
      name: 'Prosthetic Store',
      email: 'noreply@prosthetic-store.ru',
    },
    templates: {
      orderConfirmation: 'order-confirmation',
      passwordReset: 'password-reset',
      welcome: 'welcome',
    }
  },

  // Backup
  backup: {
    enabled: true,
    schedule: '0 3 * * *', // Каждый день в 3 часа ночи
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 3,
    },
    storage: {
      type: 's3', // или 'local', 'ftp'
      s3: {
        bucket: process.env.BACKUP_S3_BUCKET,
        region: process.env.BACKUP_S3_REGION,
        accessKeyId: process.env.BACKUP_S3_ACCESS_KEY,
        secretAccessKey: process.env.BACKUP_S3_SECRET_KEY,
      }
    }
  },

  // CDN
  cdn: {
    enabled: true,
    url: process.env.CDN_URL || 'https://cdn.prosthetic-store.ru',
    // Какие файлы отдавать через CDN
    patterns: [
      '/images/**',
      '/css/**',
      '/js/**',
      '/fonts/**',
    ]
  },

  // Поисковая оптимизация
  seo: {
    // Sitemap
    sitemap: {
      enabled: true,
      changefreq: {
        products: 'weekly',
        categories: 'monthly',
        static: 'yearly',
      },
      priority: {
        home: 1.0,
        products: 0.8,
        categories: 0.7,
        static: 0.5,
      }
    },
    // Robots.txt
    robots: {
      userAgent: '*',
      allow: ['/'],
      disallow: ['/admin', '/api', '/auth'],
      sitemap: 'https://prosthetic-store.ru/sitemap.xml',
    }
  }
};

// Функция для валидации конфигурации
export function validateConfig() {
  const requiredBase = [
    'JWT_SECRET',
    'REDIS_HOST',
  ];

  const missingBase = requiredBase.filter(key => !process.env[key]);

  // База данных: допускаем либо DATABASE_URL, либо набор POSTGRESQL_*
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasPgParts = !!(process.env.POSTGRESQL_HOST && process.env.POSTGRESQL_USER && process.env.POSTGRESQL_DBNAME);

  const missing: string[] = [...missingBase];
  if (!hasDatabaseUrl && !hasPgParts) {
    missing.push('DATABASE_URL|POSTGRESQL_HOST+POSTGRESQL_USER+POSTGRESQL_DBNAME');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Экспорт типизированной конфигурации
export type ProductionConfig = typeof productionConfig;