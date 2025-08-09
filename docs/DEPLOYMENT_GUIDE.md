# Руководство по развертыванию в продакшен

## Предварительные требования

### Серверные требования
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- Nginx (для reverse proxy)
- PM2 (для управления процессами)
- Минимум 2GB RAM
- 20GB свободного места на диске

### Необходимые сервисы
- SSL сертификат (Let's Encrypt)
- CDN (CloudFlare, AWS CloudFront)
- S3-совместимое хранилище для бэкапов
- SMTP сервер для email
- Мониторинг (Sentry, New Relic)

## Шаги развертывания

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y nginx postgresql redis-server certbot python3-certbot-nginx

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PM2
sudo npm install -g pm2

# Создание пользователя для приложения
sudo useradd -m -s /bin/bash prosthetic
sudo usermod -aG sudo prosthetic
```

### 2. Настройка базы данных

```bash
# Создание БД и пользователя
sudo -u postgres psql

CREATE DATABASE prosthetic_prod;
CREATE USER prosthetic_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE prosthetic_prod TO prosthetic_user;

# Настройка PostgreSQL для продакшена
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Рекомендуемые настройки:
```
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

### 3. Настройка Redis

```bash
sudo nano /etc/redis/redis.conf
```

Изменения:
```
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 4. Клонирование и настройка приложения

```bash
# Переключение на пользователя приложения
sudo su - prosthetic

# Клонирование репозитория
git clone https://github.com/your-repo/prosthetic-store.git
cd prosthetic-store

# Установка зависимостей
npm ci --production

# Создание .env файла
cp .env.example .env.production
nano .env.production
```

### 5. Переменные окружения (.env.production)

```env
# База данных
DATABASE_URL=postgresql://prosthetic_user:your_secure_password@localhost:5432/prosthetic_prod

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Безопасность
JWT_SECRET=your_very_long_random_string
SESSION_SECRET=another_very_long_random_string

# URL приложения
NEXT_PUBLIC_APP_URL=https://prosthetic-store.ru
ALLOWED_ORIGINS=https://prosthetic-store.ru

# S3 для изображений и бэкапов
S3_ACCESS_KEY=your_s3_access_key
S3_SECRET_KEY=your_s3_secret_key
S3_BUCKET=prosthetic-store-prod
S3_REGION=eu-central-1

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Мониторинг
SENTRY_DSN=https://your_sentry_dsn
NEW_RELIC_LICENSE_KEY=your_new_relic_key

# Другое
NODE_ENV=production
LOG_LEVEL=info
```

### 6. Сборка приложения

```bash
# Сборка Next.js приложения
npm run build

# Запуск миграций БД
npm run migrate:prod

# Очистка и оптимизация БД
node scripts/production-cleanup.js
```

### 7. Настройка PM2

Создайте файл `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'prosthetic-store',
    script: 'npm',
    args: 'start',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    cron_restart: '0 3 * * *',
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.next'],
  }]
};
```

Запуск:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8. Настройка Nginx

```nginx
server {
    server_name prosthetic-store.ru www.prosthetic-store.ru;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Статические файлы
    location /_next/static {
        alias /home/prosthetic/prosthetic-store/.next/static;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    location /images {
        alias /home/prosthetic/prosthetic-store/public/images;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # API rate limiting
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Основное приложение
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/prosthetic-store.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prosthetic-store.ru/privkey.pem;
}

# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name prosthetic-store.ru www.prosthetic-store.ru;
    return 301 https://$server_name$request_uri;
}
```

### 9. SSL сертификат

```bash
sudo certbot --nginx -d prosthetic-store.ru -d www.prosthetic-store.ru
```

### 10. Настройка бэкапов

Создайте скрипт `/home/prosthetic/backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/prosthetic/backups"
DB_NAME="prosthetic_prod"
S3_BUCKET="prosthetic-store-backups"

# Создание директории для бэкапов
mkdir -p $BACKUP_DIR

# Бэкап БД
pg_dump $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Загрузка в S3
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://$S3_BUCKET/db/

# Удаление старых локальных бэкапов (старше 7 дней)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Добавьте в crontab:
```bash
0 3 * * * /home/prosthetic/backup.sh
```

### 11. Мониторинг

#### Настройка health check endpoint

Endpoint уже создан в `/api/health`. Настройте мониторинг:

- **UptimeRobot**: для проверки доступности
- **New Relic**: для APM мониторинга
- **Sentry**: для отслеживания ошибок
- **Google Analytics**: для аналитики

#### Логирование

Настройте ротацию логов:

```bash
sudo nano /etc/logrotate.d/prosthetic-store
```

```
/home/prosthetic/prosthetic-store/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 prosthetic prosthetic
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 12. Оптимизация производительности

1. **Включите HTTP/2** в Nginx
2. **Настройте CDN** (CloudFlare)
3. **Оптимизируйте изображения** через Sharp
4. **Включите Brotli сжатие** в Nginx
5. **Настройте кэширование** в Redis

### 13. Безопасность

1. **Настройте файрвол**:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **Fail2ban** для защиты от брутфорса:
```bash
sudo apt install fail2ban
```

3. **Регулярные обновления**:
```bash
# Автоматические обновления безопасности
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Чеклист перед запуском

- [ ] Все переменные окружения настроены
- [ ] База данных создана и мигрирована
- [ ] SSL сертификат установлен
- [ ] Бэкапы настроены и протестированы
- [ ] Мониторинг настроен
- [ ] Логирование работает
- [ ] Redis настроен и работает
- [ ] Nginx конфигурация проверена
- [ ] PM2 запущен и настроен на автозапуск
- [ ] Файрвол настроен
- [ ] Health check endpoint отвечает

## Команды для управления

```bash
# Перезапуск приложения
pm2 restart prosthetic-store

# Просмотр логов
pm2 logs prosthetic-store

# Мониторинг
pm2 monit

# Обновление приложения
git pull
npm ci --production
npm run build
pm2 reload prosthetic-store

# Проверка статуса
systemctl status nginx
systemctl status postgresql
systemctl status redis
pm2 status
```